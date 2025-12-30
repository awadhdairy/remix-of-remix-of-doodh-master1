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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

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

    // Check if phone number already exists
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

    // Create the auth user
    const email = `${phone}@dairy.local`
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
      console.error('Error creating user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id

    // Update the profile with correct role and PIN hash
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
        role: role,
        pin_hash: await hashPin(pin, supabaseAdmin)
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    // Update the user_roles table
    const { error: roleUpdateError } = await supabaseAdmin
      .from('user_roles')
      .update({ role: role })
      .eq('user_id', userId)

    if (roleUpdateError) {
      console.error('Error updating role:', roleUpdateError)
    }

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

async function hashPin(pin: string, supabase: any): Promise<string> {
  // Use pgcrypto's crypt function via a database call
  const { data, error } = await supabase.rpc('crypt_pin', { _pin: pin })
  if (error) {
    console.error('Error hashing PIN:', error)
    // Fallback - the profile trigger should handle this
    return ''
  }
  return data
}
