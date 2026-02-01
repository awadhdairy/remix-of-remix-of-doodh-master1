import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Use the EXTERNAL Supabase (where actual data lives)
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') || 'https://htsfxnuttobkdquxwvjj.supabase.co'
    const externalServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')
    const externalAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2Z4bnV0dG9ia2RxdXh3dmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1ODQ1ODgsImV4cCI6MjA4NTE2MDU4OH0.kM-uVIvO_bGqBeBQgoXBLlzTbTyQGVRgL6aVYMG2OcM'

    if (!externalServiceKey) {
      console.error('Missing EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing service role key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client for external Supabase
    const supabaseAdmin = createClient(externalUrl, externalServiceKey)

    // Get session token from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sessionToken = authHeader.replace('Bearer ', '')

    // Validate session using the external database's validate_session function
    const { data: sessionResult, error: sessionError } = await supabaseAdmin.rpc('validate_session', {
      _session_token: sessionToken
    })

    if (sessionError || !sessionResult?.success) {
      console.error('Session validation failed:', sessionError || sessionResult?.error)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session. Please login again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestingUserId = sessionResult.user?.id
    const requestingUserRole = sessionResult.user?.role

    // Check if requesting user is super_admin
    if (requestingUserRole !== 'super_admin') {
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
      // If inactive, we can reactivate - but let's use the reactivate flow instead
      return new Response(
        JSON.stringify({ error: 'This phone number belongs to a deactivated user. Please reactivate the account instead.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the auth user in EXTERNAL Supabase
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
        errorMessage = 'A user with this phone number already exists. Please use a different phone number.'
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
    console.log('Upserting profile for user:', userId)
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        phone: phone,
        role: role,
        is_active: true
      }, { onConflict: 'id' })

    if (profileUpsertError) {
      console.error('Error upserting profile:', profileUpsertError)
    } else {
      console.log('Profile upserted successfully')
    }

    // Set PIN hash using the database function
    console.log('Setting PIN hash for user:', userId)
    const { error: pinError } = await supabaseAdmin.rpc('update_pin_only', {
      _user_id: userId,
      _pin: pin
    })

    if (pinError) {
      console.error('Error setting PIN hash:', pinError)
      // Try alternative method
      const { error: altPinError } = await supabaseAdmin.rpc('update_user_profile_with_pin', {
        _user_id: userId,
        _full_name: fullName,
        _phone: phone,
        _role: role,
        _pin: pin
      })
      if (altPinError) {
        console.error('Alternative PIN set also failed:', altPinError)
      } else {
        console.log('PIN set via alternative method')
      }
    } else {
      console.log('PIN hash set successfully')
    }

    // Upsert the user_roles entry
    console.log('Upserting user role:', role)
    const { error: roleUpsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: role
      }, { onConflict: 'user_id' })

    if (roleUpsertError) {
      console.error('Error upserting role:', roleUpsertError)
    } else {
      console.log('User role upserted successfully')
    }

    // Log activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: requestingUserId,
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
