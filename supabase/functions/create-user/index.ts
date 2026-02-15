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
    const supabaseAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error('Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get the JWT token from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Create a client with the user's token to verify their identity
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    // Verify the user's JWT by calling getUser
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !requestingUser) {
      console.error('User verification failed:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authenticated user:', requestingUser.id, requestingUser.email)

    // Check if requesting user is super_admin using safe query pattern
    const { data: roleRows, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .eq('role', 'super_admin')
      .limit(1)

    if (roleError) {
      console.error('Role lookup error:', roleError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify user permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isSuperAdmin = roleRows && roleRows.length > 0
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only super admin can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { phone, pin, fullName, role } = await req.json()

    if (!phone || !pin || !fullName || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: phone, pin, fullName, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate PIN format (6 digits)
    if (!/^\d{6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate role
    const validRoles = ['super_admin', 'manager', 'accountant', 'delivery_staff', 'farm_worker', 'vet_staff', 'auditor']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if phone number already exists in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, is_active, full_name')
      .eq('phone', phone)
      .maybeSingle()

    if (existingProfile) {
      // Check if this profile has a matching auth user
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id)
      
      if (!authUser?.user) {
        // This is an ORPHANED profile - clean it up automatically
        console.log(`[CREATE-USER] Found orphaned profile ${existingProfile.id}, cleaning up...`)
        
        // Delete sessions first
        await supabaseAdmin.from('auth_sessions').delete().eq('user_id', existingProfile.id)
        
        // Delete user_roles 
        await supabaseAdmin.from('user_roles').delete().eq('user_id', existingProfile.id)
        
        // Delete orphaned profile
        const { error: deleteError } = await supabaseAdmin.from('profiles').delete().eq('id', existingProfile.id)
        
        if (deleteError) {
          console.error('[CREATE-USER] Failed to delete orphaned profile:', deleteError)
          return new Response(
            JSON.stringify({ error: 'Failed to clean up orphaned data. Please try again.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        console.log(`[CREATE-USER] Orphaned profile ${existingProfile.id} cleaned up successfully`)
        // Now proceed with normal user creation
      } else if (existingProfile.is_active) {
        return new Response(
          JSON.stringify({ error: 'A user with this phone number already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else {
        return new Response(
          JSON.stringify({ error: 'This phone number belongs to a deactivated user. Please reactivate the account instead.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Also check for orphaned auth users with the same email pattern
    const email = `${phone}@awadhdairy.com`
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers?.users?.find(u => u.email === email)
    
    if (existingAuthUser) {
      // Check if this auth user has a matching profile
      const { data: matchingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', existingAuthUser.id)
        .maybeSingle()
      
      if (!matchingProfile) {
        // Auth user exists but no profile - delete the orphaned auth user
        console.log(`[CREATE-USER] Found orphaned auth user ${existingAuthUser.id}, cleaning up...`)
        await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id)
        console.log(`[CREATE-USER] Orphaned auth user ${existingAuthUser.id} deleted`)
      }
    }

    // Create the auth user
    console.log(`Creating auth user for phone: ${phone}, email: ${email}`)

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone
      }
    })

    if (createError) {
      console.error('Error creating auth user:', createError)
      let errorMessage = 'Failed to create user'
      if (createError.message?.includes('already been registered')) {
        errorMessage = 'A user with this phone number already exists'
      } else if (createError.message) {
        errorMessage = createError.message
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id
    console.log('Created auth user with ID:', userId)

    // Upsert the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        phone: phone,
        role: role,
        is_active: true
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Error upserting profile:', profileError)
      
      // If profile creation fails due to phone constraint, try to clean up and retry
      if (profileError.code === '23505' && profileError.message?.includes('phone')) {
        console.log('[CREATE-USER] Phone conflict detected, forcing cleanup...')
        
        // Force delete any profile with this phone that isn't this user
        await supabaseAdmin.from('profiles').delete().eq('phone', phone).neq('id', userId)
        
        // Retry the upsert
        const { error: retryError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: userId,
            full_name: fullName,
            phone: phone,
            role: role,
            is_active: true
          }, { onConflict: 'id' })
        
        if (retryError) {
          console.error('Error upserting profile after cleanup:', retryError)
        }
      }
    }

    // Set PIN hash
    const { error: pinError } = await supabaseAdmin.rpc('update_pin_only', {
      _user_id: userId,
      _pin: pin
    })

    if (pinError) {
      console.error('Error setting PIN:', pinError)
      // Try alternative method
      await supabaseAdmin.rpc('update_user_profile_with_pin', {
        _user_id: userId,
        _full_name: fullName,
        _phone: phone,
        _role: role,
        _pin: pin
      })
    }

    // Upsert the user_roles entry
    const { error: roleUpsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: role
      }, { onConflict: 'user_id' })

    if (roleUpsertError) {
      console.error('Error upserting role:', roleUpsertError)
    }

    // Log activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: requestingUser.id,
        action: 'user_created',
        entity_type: 'user',
        entity_id: userId,
        details: { created_user_name: fullName, created_user_role: role }
      })

    console.log('User created successfully:', userId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        userId: userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error in create-user function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: 'Internal server error: ' + errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
