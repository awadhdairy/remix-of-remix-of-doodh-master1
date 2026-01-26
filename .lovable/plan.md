# Edge Function Migration - COMPLETED

All Edge Functions have been migrated to database RPCs on the external Supabase.

## Summary

- **Permanent user deletion** now uses `admin_permanent_delete_user` RPC instead of Edge Function
- All Edge Function files removed from repository
- Website is now completely independent of Lovable Cloud Edge Functions

## Required: Run SQL on External Supabase

Execute this SQL in your external Supabase SQL Editor (https://supabase.com/dashboard/project/rihedsukjinwqvsvufls):

```sql
CREATE OR REPLACE FUNCTION public.admin_permanent_delete_user(_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  _caller_id uuid;
  _target_role text;
BEGIN
  _caller_id := auth.uid();
  
  IF _caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF NOT public.has_role(_caller_id, 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can permanently delete users');
  END IF;
  
  IF _target_user_id = _caller_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete your own account');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  SELECT role INTO _target_role FROM public.user_roles WHERE user_id = _target_user_id;
  IF _target_role = 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete super admin account');
  END IF;
  
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  DELETE FROM public.profiles WHERE id = _target_user_id;
  DELETE FROM auth.users WHERE id = _target_user_id;
  
  RETURN json_build_object('success', true, 'message', 'User permanently deleted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_permanent_delete_user(uuid) TO authenticated;
```
