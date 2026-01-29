import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const supabaseAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!

    // Create admin client for creating users
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the requesting user is a super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if requesting user is super_admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single()

    if (roleError || roleData?.role !== 'super_admin') {
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
      .select('id')
      .eq('phone', phone)
      .single()

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: 'A user with this phone number already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the auth user - MUST match domain used in Auth.tsx login
    const email = `${phone}@awadhdairy.com`

    // Check if email already exists in auth (handles edge case where profile was deleted but auth user remains)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingUsers?.users?.some(u => u.email === email)
    
    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'A user with this phone number already exists in the system. Please use a different phone number or contact support to reset the existing account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // DIRECTLY UPSERT the profile - don't rely on trigger
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
      // Don't fail - the trigger might have created a partial profile
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

    // UPSERT the user_roles entry - don't rely on trigger
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

    // Verify profile was created
    const { data: verifyProfile, error: verifyError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, role')
      .eq('id', userId)
      .single()

    if (verifyError || !verifyProfile) {
      console.error('Profile verification failed:', verifyError)
      // Cleanup: delete the auth user since profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User created and verified successfully:', verifyProfile)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User created successfully',
        userId: userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in create-user function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
