import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Use Supabase's built-in environment variables (auto-provided by Supabase)
    const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Check if the requesting user is a super_admin using safe query (avoids .single() errors)
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'super_admin')
      .limit(1)

    const isSuperAdmin = !roleError && roleRows && roleRows.length > 0

    if (!isSuperAdmin) {
      console.error('Authorization failed:', { roleError, roleRows, userId: requestingUser.id })
      return new Response(
        JSON.stringify({ 
          error: 'Only super_admin can delete users',
          debug: { roleError: roleError?.message, hasRoles: !!roleRows?.length }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const { userId, action, userIds } = body

    // ========================================
    // ACTION: Comprehensive cleanup of ALL orphan types
    // ========================================
    if (action === 'cleanup-all-orphan-types') {
      console.log('[DELETE-USER] Starting comprehensive orphan cleanup...')
      
      const results = {
        orphanedProfiles: 0,
        orphanedRoles: 0,
        orphanedAuthUsers: 0,
        orphanedSessions: 0,
        details: [] as { type: string; id: string; success: boolean; error?: string }[]
      }
      
      try {
        // 1. Get all auth users
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
        const authUserIds = new Set(authUsers?.users?.map(u => u.id) || [])
        
        // 2. Get all profiles
        const { data: profiles } = await supabaseAdmin.from('profiles').select('id, phone')
        const profileIds = new Set(profiles?.map(p => p.id) || [])
        
        // 3. Delete profiles without matching auth users
        for (const profile of (profiles || [])) {
          if (!authUserIds.has(profile.id)) {
            console.log(`[DELETE-USER] Cleaning orphaned profile: ${profile.id}`)
            
            // Delete sessions first
            await supabaseAdmin.from('auth_sessions').delete().eq('user_id', profile.id)
            
            // Delete user_roles
            await supabaseAdmin.from('user_roles').delete().eq('user_id', profile.id)
            
            // Delete profile
            const { error } = await supabaseAdmin.from('profiles').delete().eq('id', profile.id)
            
            if (!error) {
              results.orphanedProfiles++
              results.details.push({ type: 'profile', id: profile.id, success: true })
            } else {
              results.details.push({ type: 'profile', id: profile.id, success: false, error: error.message })
            }
          }
        }
        
        // 4. Delete auth users (staff-created: @awadhdairy.com) without matching profiles
        for (const authUser of (authUsers?.users || [])) {
          if (authUser.email?.endsWith('@awadhdairy.com') && !profileIds.has(authUser.id)) {
            // Never delete the requesting user
            if (authUser.id === requestingUser.id) continue
            
            console.log(`[DELETE-USER] Cleaning orphaned auth user: ${authUser.id}`)
            
            // Delete sessions first
            await supabaseAdmin.from('auth_sessions').delete().eq('user_id', authUser.id)
            
            // Delete any leftover user_roles
            await supabaseAdmin.from('user_roles').delete().eq('user_id', authUser.id)
            
            const { error } = await supabaseAdmin.auth.admin.deleteUser(authUser.id)
            
            if (!error) {
              results.orphanedAuthUsers++
              results.details.push({ type: 'auth_user', id: authUser.id, success: true })
            } else {
              results.details.push({ type: 'auth_user', id: authUser.id, success: false, error: error.message })
            }
          }
        }
        
        // 5. Delete user_roles without matching profiles or auth users
        const { data: allRoles } = await supabaseAdmin.from('user_roles').select('user_id')
        for (const role of (allRoles || [])) {
          if (!profileIds.has(role.user_id) && !authUserIds.has(role.user_id)) {
            console.log(`[DELETE-USER] Cleaning orphaned user_role: ${role.user_id}`)
            
            const { error } = await supabaseAdmin.from('user_roles').delete().eq('user_id', role.user_id)
            
            if (!error) {
              results.orphanedRoles++
              results.details.push({ type: 'user_role', id: role.user_id, success: true })
            } else {
              results.details.push({ type: 'user_role', id: role.user_id, success: false, error: error.message })
            }
          }
        }
        
        // 6. Delete orphaned sessions (user_id not in profiles)
        const { data: allSessions } = await supabaseAdmin.from('auth_sessions').select('id, user_id')
        for (const session of (allSessions || [])) {
          if (!profileIds.has(session.user_id) && !authUserIds.has(session.user_id)) {
            const { error } = await supabaseAdmin.from('auth_sessions').delete().eq('id', session.id)
            
            if (!error) {
              results.orphanedSessions++
              results.details.push({ type: 'session', id: session.id, success: true })
            }
          }
        }
        
        // Log the cleanup action
        await supabaseAdmin
          .from('activity_logs')
          .insert({
            user_id: requestingUser.id,
            action: 'comprehensive_orphan_cleanup',
            entity_type: 'system',
            details: {
              orphanedProfiles: results.orphanedProfiles,
              orphanedRoles: results.orphanedRoles,
              orphanedAuthUsers: results.orphanedAuthUsers,
              orphanedSessions: results.orphanedSessions,
              cleaned_by: requestingUser.email,
            },
          })
        
        console.log('[DELETE-USER] Comprehensive cleanup complete:', results)
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Cleaned up ${results.orphanedProfiles} profiles, ${results.orphanedAuthUsers} auth users, ${results.orphanedRoles} roles, ${results.orphanedSessions} sessions`,
            ...results
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
        
      } catch (error) {
        console.error('[DELETE-USER] Comprehensive cleanup error:', error)
        return new Response(
          JSON.stringify({ error: 'Cleanup failed', details: String(error) }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

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
          // Clean up related data first
          await supabaseAdmin.from('auth_sessions').delete().eq('user_id', orphan.id)
          await supabaseAdmin.from('user_roles').delete().eq('user_id', orphan.id)
          
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
          // Clean up related data first
          await supabaseAdmin.from('auth_sessions').delete().eq('user_id', id)
          await supabaseAdmin.from('user_roles').delete().eq('user_id', id)
          
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

    // Clean up all related data first
    await supabaseAdmin.from('auth_sessions').delete().eq('user_id', userId)

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
