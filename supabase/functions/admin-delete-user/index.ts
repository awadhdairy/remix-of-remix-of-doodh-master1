import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Use EXTERNAL Supabase (user's own backend) for all operations
    const externalSupabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
    const externalServiceRoleKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;

    if (!externalSupabaseUrl || !externalServiceRoleKey) {
      throw new Error('External Supabase credentials not configured');
    }

    // Create client with user's JWT to verify identity against EXTERNAL backend
    const userClient = createClient(externalSupabaseUrl, externalServiceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[admin-delete-user] Auth error:', userError?.message);
      throw new Error('Not authenticated');
    }

    console.log('[admin-delete-user] Caller:', user.id);

    // Verify caller is super_admin using RPC on EXTERNAL backend
    const { data: roleCheck, error: roleError } = await userClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'super_admin',
    });

    if (roleError) {
      console.error('[admin-delete-user] Role check error:', roleError.message);
      throw new Error('Failed to verify permissions');
    }

    if (!roleCheck) {
      console.warn('[admin-delete-user] Non-admin access attempt by:', user.id);
      throw new Error('Only super_admin can permanently delete users');
    }

    // Get target user ID from request body
    const body = await req.json();
    const { target_user_id } = body;

    if (!target_user_id) {
      throw new Error('Missing target_user_id in request body');
    }

    console.log('[admin-delete-user] Target user:', target_user_id);

    // Prevent self-deletion
    if (target_user_id === user.id) {
      throw new Error('Cannot delete your own account');
    }

    // Create admin client with service_role key for privileged operations on EXTERNAL backend
    const adminClient = createClient(externalSupabaseUrl, externalServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if target is a super_admin (cannot delete other super_admins)
    const { data: targetRole, error: targetRoleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', target_user_id)
      .maybeSingle();

    if (targetRoleError) {
      console.error('[admin-delete-user] Target role check error:', targetRoleError.message);
      throw new Error('Failed to verify target user role');
    }

    if (targetRole?.role === 'super_admin') {
      console.warn('[admin-delete-user] Attempted to delete super_admin:', target_user_id);
      throw new Error('Cannot delete super_admin account');
    }

    // First, clean up the user_roles and profiles tables
    console.log('[admin-delete-user] Cleaning up user_roles...');
    const { error: rolesDeleteError } = await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', target_user_id);

    if (rolesDeleteError) {
      console.error('[admin-delete-user] Failed to delete from user_roles:', rolesDeleteError.message);
      // Continue anyway, as auth deletion is the main goal
    }

    console.log('[admin-delete-user] Cleaning up profiles...');
    const { error: profilesDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', target_user_id);

    if (profilesDeleteError) {
      console.error('[admin-delete-user] Failed to delete from profiles:', profilesDeleteError.message);
      // Continue anyway, as auth deletion is the main goal
    }

    // Delete from auth.users using Admin API on EXTERNAL backend
    console.log('[admin-delete-user] Deleting from auth.users...');
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(target_user_id);

    if (deleteError) {
      console.error('[admin-delete-user] Auth deletion error:', deleteError.message);
      throw new Error(`Failed to delete user from auth: ${deleteError.message}`);
    }

    console.log('[admin-delete-user] User permanently deleted:', target_user_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User permanently deleted',
        deleted_user_id: target_user_id 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('[admin-delete-user] Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
