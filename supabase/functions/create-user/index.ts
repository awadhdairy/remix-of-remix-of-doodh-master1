import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Hardcode external Supabase credentials (deployed to external project)
const EXTERNAL_URL = 'https://htsfxnuttobkdquxwvjj.supabase.co'
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2Z4bnV0dG9ia2RxdXh3dmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1ODQ1ODgsImV4cCI6MjA4NTE2MDU4OH0.kM-uVIvO_bGqBeBQgoXBLlzTbTyQGVRgL6aVYMG2OcM'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the service role key from environment (set via CLI)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!serviceRoleKey) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(EXTERNAL_URL, serviceRoleKey)

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
    const supabaseClient = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
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

    // Check if requesting user is super_admin using service role client
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single()

    if (roleError) {
      console.error('Role lookup error:', roleError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify user permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (roleData?.role !== 'super_admin') {
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
      .select('id, is_active')
      .eq('phone', phone)
      .single()

    if (existingProfile) {
      if (existingProfile.is_active) {
        return new Response(
          JSON.stringify({ error: 'A user with this phone number already exists' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: 'This phone number belongs to a deactivated user. Please reactivate the account instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the auth user
    const email = `${phone}@awadhdairy.com`
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
