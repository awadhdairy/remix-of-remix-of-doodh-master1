import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { phone, pin } = await req.json()

    // Get admin credentials from environment variables
    const ADMIN_PHONE = Deno.env.get('BOOTSTRAP_ADMIN_PHONE')
    const ADMIN_PIN = Deno.env.get('BOOTSTRAP_ADMIN_PIN')

    // Validate that environment variables are configured
    if (!ADMIN_PHONE || !ADMIN_PIN) {
      console.error('Bootstrap admin credentials not configured in environment')
      return new Response(
        JSON.stringify({ error: 'Bootstrap not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate input against secure environment credentials
    if (phone !== ADMIN_PHONE || pin !== ADMIN_PIN) {
      return new Response(
        JSON.stringify({ error: 'Invalid bootstrap credentials' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const email = `${phone}@awadhdairy.com`

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // User exists, ensure they have super_admin role
      const { error: roleUpdateError } = await supabaseAdmin
        .from('user_roles')
        .update({ role: 'super_admin' })
        .eq('user_id', existingUser.id)

      if (roleUpdateError) {
        console.error('Role update error:', roleUpdateError)
      }

      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: 'super_admin', full_name: 'Super Admin' })
        .eq('id', existingUser.id)

      if (profileUpdateError) {
        console.error('Profile update error:', profileUpdateError)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Admin account ready. You can now login.',
          user_id: existingUser.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the super admin user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: {
        phone: phone,
        full_name: 'Super Admin'
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id

    // Directly upsert profile - don't rely on trigger (matches create-user pattern)
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        full_name: 'Super Admin',
        phone: phone,
        role: 'super_admin',
        is_active: true
      }, { onConflict: 'id' })

    if (profileUpsertError) {
      console.error('Profile upsert error:', profileUpsertError)
    }

    // Upsert user_roles to super_admin
    const { error: roleUpsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, role: 'super_admin' }, { onConflict: 'user_id' })

    if (roleUpsertError) {
      console.error('Role upsert error:', roleUpsertError)
    }

    // Set PIN hash using database function
    const { error: pinError } = await supabaseAdmin.rpc('update_pin_only', {
      _user_id: userId,
      _pin: pin
    })

    if (pinError) {
      console.error('PIN set error:', pinError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Super admin account created successfully. You can now login.',
        user_id: userId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Bootstrap error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
