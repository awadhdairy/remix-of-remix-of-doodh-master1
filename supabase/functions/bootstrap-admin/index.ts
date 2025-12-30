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

    // Validate input - only allow the specific admin credentials
    if (phone !== '7897716792' || pin !== '101101') {
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

    const email = `${phone}@doodhwallah.app`

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // User exists, ensure they have super_admin role
      await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: existingUser.id, role: 'super_admin' }, { onConflict: 'user_id' })

      await supabaseAdmin
        .from('profiles')
        .update({ role: 'super_admin', full_name: 'Super Admin' })
        .eq('id', existingUser.id)

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

    // Wait a bit for the trigger to create profile/role
    await new Promise(resolve => setTimeout(resolve, 500))

    // Update user_roles to super_admin
    await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, role: 'super_admin' }, { onConflict: 'user_id' })

    // Update profiles to super_admin
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'super_admin', full_name: 'Super Admin', phone: phone })
      .eq('id', userId)

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
