import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Use EXTERNAL Supabase variables
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Extract and validate the Bearer token manually
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract the token from the header
    const token = authHeader.replace('Bearer ', '')

    // Create client for user verification
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    })

    // CRITICAL: Pass token explicitly for manual JWT verification (required when verify_jwt=false)
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !requestingUser) {
      console.error('JWT validation failed:', userError?.message || 'No user found')
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('User authenticated:', requestingUser.id, requestingUser.email)

    // Check if the requesting user is a super_admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single()

    if (roleError || roleData?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Only super_admin can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const { userId, action, userIds } = body

    // Handle find-and-cleanup-orphaned action (dynamic detection)
    if (action === 'find-and-cleanup-orphaned') {
      console.log('Finding and cleaning up orphaned users dynamically...')
      
      // Get all auth users
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      if (listError) {
        console.error('Failed to list auth users:', listError)
        return new Response(
          JSON.stringify({ error: 'Failed to list auth users' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get all profile IDs
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id')

      if (profilesError) {
        console.error('Failed to list profiles:', profilesError)
        return new Response(
          JSON.stringify({ error: 'Failed to list profiles' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const profileIds = new Set(profiles?.map(p => p.id) || [])
      
      // Filter for staff-created users (emails ending with @awadhdairy.com) that have no profile
      const orphanedUsers = authUsers?.users?.filter(u => 
        u.email?.endsWith('@awadhdairy.com') && 
        !profileIds.has(u.id) &&
        u.id !== requestingUser.id // Never delete the requesting user
      ) || []

      console.log(`Found ${orphanedUsers.length} orphaned users`)

      if (orphanedUsers.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'No orphaned users found',
            deleted_count: 0
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const results = []
      for (const orphan of orphanedUsers) {
        try {
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(orphan.id)
          if (deleteError) {
            console.error(`Failed to delete orphaned user ${orphan.id}:`, deleteError)
            results.push({ id: orphan.id, email: orphan.email, success: false, error: deleteError.message })
          } else {
            console.log(`Deleted orphaned user: ${orphan.id} (${orphan.email})`)
            results.push({ id: orphan.id, email: orphan.email, success: true })
          }
        } catch (err) {
          console.error(`Error deleting orphaned user ${orphan.id}:`, err)
          results.push({ id: orphan.id, email: orphan.email, success: false, error: String(err) })
        }
      }

      const deletedCount = results.filter(r => r.success).length

      // Log the cleanup action
      await supabaseAdmin
        .from('activity_logs')
        .insert({
          user_id: requestingUser.id,
          action: 'orphaned_users_cleanup',
          entity_type: 'user',
          details: {
            deleted_count: deletedCount,
            failed_count: results.filter(r => !r.success).length,
            results,
            deleted_by: requestingUser.email,
          },
        })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Cleaned up ${deletedCount} orphaned user(s)`,
          deleted_count: deletedCount,
          results 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle cleanup-orphaned action (legacy - accepts explicit IDs)
    if (action === 'cleanup-orphaned' && userIds && Array.isArray(userIds)) {
      console.log('Cleaning up orphaned users (legacy):', userIds)
      const results = []
      
      for (const id of userIds) {
        try {
          const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id)
          if (deleteError) {
            console.error(`Failed to delete orphaned user ${id}:`, deleteError)
            results.push({ id, success: false, error: deleteError.message })
          } else {
            console.log(`Deleted orphaned user: ${id}`)
            results.push({ id, success: true })
          }
        } catch (err) {
          console.error(`Error deleting orphaned user ${id}:`, err)
          results.push({ id, success: false, error: String(err) })
        }
      }

      // Log the cleanup action
      await supabaseAdmin
        .from('activity_logs')
        .insert({
          user_id: requestingUser.id,
          action: 'orphaned_users_cleanup',
          entity_type: 'user',
          details: {
            deleted_count: results.filter(r => r.success).length,
            failed_count: results.filter(r => !r.success).length,
            results,
            deleted_by: requestingUser.email,
          },
        })

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Cleaned up ${results.filter(r => r.success).length} orphaned users`,
          results 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Standard single user deletion
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prevent self-deletion
    if (userId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if target user is a super_admin (prevent deleting other super_admins)
    const { data: targetRoleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (targetRoleData?.role === 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Cannot delete super_admin accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user info for logging before deletion
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, phone')
      .eq('id', userId)
      .single()

    // HYBRID DELETION: Handle both auth-based users and profile-only users
    // Try to delete from auth.users first
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      // Check if it's a "User not found" error (user only exists in profiles table)
      const isUserNotFound = authDeleteError.status === 404 || 
                             authDeleteError.message?.includes('not found') ||
                             authDeleteError.message?.includes('User not found')
      
      if (isUserNotFound) {
        console.log('User not in auth.users, deleting from profiles/user_roles directly')
        
        // Delete from user_roles first (child table)
        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
        
        if (rolesError) {
          console.error('Error deleting user_roles:', rolesError)
          // Continue anyway - user_roles might not exist
        }
        
        // Delete from profiles (main table)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', userId)
        
        if (profileError) {
          console.error('Error deleting profile:', profileError)
          return new Response(
            JSON.stringify({ error: 'Failed to delete user profile' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        console.log('Successfully deleted profile-only user:', userId)
      } else {
        // Some other auth error - fail the request
        console.error('Error deleting user from auth:', authDeleteError)
        return new Response(
          JSON.stringify({ error: 'Failed to delete user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Auth user deleted successfully, also clean up profiles/user_roles
      // (explicit cleanup since there's no FK cascade from auth.users)
      console.log('Auth user deleted, cleaning up profiles/user_roles...')
      
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      
      console.log('Successfully deleted auth user and cleaned up:', userId)
    }

    // Log the deletion
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: requestingUser.id,
        action: 'user_deleted',
        entity_type: 'user',
        entity_id: userId,
        details: {
          deleted_user_name: targetProfile?.full_name,
          deleted_user_phone: targetProfile?.phone,
          deleted_by: requestingUser.email,
        },
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `User ${targetProfile?.full_name || 'unknown'} has been permanently deleted` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
