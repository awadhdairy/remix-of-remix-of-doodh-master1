-- ============================================
-- STEP 1: Create missing verify_staff_pin function
-- ============================================
CREATE OR REPLACE FUNCTION public.verify_staff_pin(_phone text, _pin text)
RETURNS TABLE (user_id uuid, is_active boolean, full_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.is_active, p.full_name, p.role::text
  FROM public.profiles p
  WHERE p.phone = _phone
    AND p.pin_hash = crypt(_pin, p.pin_hash);
END;
$$;

-- ============================================
-- STEP 2: Grant execute permissions on functions
-- ============================================

-- Login functions (need anon access for pre-auth)
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_customer_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_account(text, text) TO anon, authenticated;

-- Admin functions (authenticated only, function itself checks super_admin role)
GRANT EXECUTE ON FUNCTION public.admin_create_staff_user(uuid, text, text, user_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_own_pin(text, text) TO authenticated;

-- Helper functions
GRANT EXECUTE ON FUNCTION public.has_role(uuid, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin(uuid) TO authenticated;

-- ============================================
-- STEP 3: Grant SELECT on profiles_safe view
-- ============================================
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;