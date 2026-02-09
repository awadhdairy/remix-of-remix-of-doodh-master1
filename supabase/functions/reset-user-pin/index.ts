import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Use Supabase's built-in environment variables (auto-provided by Supabase)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

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
        JSON.stringify({ error: 'Only super admin can reset user PINs' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { userId, newPin } = await req.json()

    if (!userId || !newPin) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, newPin' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate new PIN format
    if (!/^\d{6}$/.test(newPin)) {
      return new Response(
        JSON.stringify({ error: 'PIN must be exactly 6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's phone for logging
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, phone')
      .eq('id', userId)
      .single()

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the PIN hash using the fixed function
    console.log(`Attempting to reset PIN for user ${userId}`)
    const { error: updatePinError } = await supabaseAdmin.rpc('update_pin_only', {
      _user_id: userId,
      _pin: newPin
    })

    if (updatePinError) {
      console.error('Error updating PIN hash:', updatePinError)
      return new Response(
        JSON.stringify({ error: 'Failed to reset PIN: ' + updatePinError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`PIN hash updated successfully for user ${userId}`)

    // Also update the auth password for consistency
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPin
    })

    if (authError) {
      console.error('Error updating auth password (non-critical):', authError)
      // Don't fail - PIN hash is the primary auth method
    } else {
      console.log(`Auth password updated successfully for user ${userId}`)
    }

    console.log(`PIN reset completed for user ${targetProfile.full_name} (${userId}) by admin ${requestingUser.id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `PIN reset successfully for ${targetProfile.full_name}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in reset-user-pin function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
