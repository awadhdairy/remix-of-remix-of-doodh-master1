-- =====================================================
-- AWADH DAIRY - COMPREHENSIVE ADMIN USER CREATION FIX
-- =====================================================
-- Run this entire script in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste & Run
-- =====================================================

-- ============================================
-- STEP 1: Fix admin_create_staff_user function
-- This is the main function that creates users with correct roles
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_create_staff_user(
  _user_id uuid,
  _full_name text,
  _phone text,
  _role user_role,
  _pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _profile_updated boolean := false;
BEGIN
  -- Verify caller is super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can create users');
  END IF;

  -- Validate PIN format
  IF NOT (_pin ~ '^\d{6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 6 digits');
  END IF;

  -- Validate user_id corresponds to an existing auth user
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid user ID - auth user does not exist');
  END IF;

  -- Check phone uniqueness (excluding the target user)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone AND id != _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Phone number already in use by another user');
  END IF;

  -- Update the profile that was created by handle_new_user trigger
  UPDATE public.profiles
  SET 
    full_name = _full_name,
    phone = _phone,
    role = _role,
    pin_hash = crypt(_pin, gen_salt('bf')),
    is_active = true
  WHERE id = _user_id;

  _profile_updated := FOUND;

  -- If profile doesn't exist yet, create it
  IF NOT _profile_updated THEN
    INSERT INTO public.profiles (id, full_name, phone, role, pin_hash, is_active)
    VALUES (_user_id, _full_name, _phone, _role, crypt(_pin, gen_salt('bf')), true)
    ON CONFLICT (id) DO UPDATE
    SET 
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      pin_hash = EXCLUDED.pin_hash,
      is_active = EXCLUDED.is_active;
  END IF;

  -- Update user_roles table (authoritative source for RLS policies)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN json_build_object('success', true, 'message', 'User created successfully');

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- STEP 2: Fix admin_update_user_status function
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  _target_user_id uuid,
  _is_active boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_role text;
BEGIN
  -- Verify caller is super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can update user status');
  END IF;

  -- Prevent self-deactivation
  IF _target_user_id = auth.uid() AND NOT _is_active THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deactivate your own account');
  END IF;

  -- Check if target is super_admin
  SELECT role INTO _target_role FROM public.user_roles WHERE user_id = _target_user_id;
  IF _target_role = 'super_admin' AND NOT _is_active THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deactivate super admin account');
  END IF;

  -- Update the user's status
  UPDATE public.profiles
  SET is_active = _is_active
  WHERE id = _target_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object(
    'success', true, 
    'message', CASE WHEN _is_active THEN 'User activated successfully' ELSE 'User deactivated successfully' END
  );
END;
$$;

-- ============================================
-- STEP 3: Fix admin_reset_user_pin function
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_reset_user_pin(
  _target_user_id uuid,
  _new_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _target_role text;
BEGIN
  -- Verify caller is super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can reset PINs');
  END IF;

  -- Validate PIN format
  IF NOT (_new_pin ~ '^\d{6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 6 digits');
  END IF;

  -- Check if target is super_admin (only allow self-reset for super_admin)
  SELECT role INTO _target_role FROM public.user_roles WHERE user_id = _target_user_id;
  IF _target_role = 'super_admin' AND _target_user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot reset another super admin PIN');
  END IF;

  -- Update the user's PIN
  UPDATE public.profiles
  SET pin_hash = crypt(_new_pin, gen_salt('bf'))
  WHERE id = _target_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'PIN reset successfully');
END;
$$;

-- ============================================
-- STEP 4: Fix admin_delete_user function
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_delete_user(_target_user_id uuid, _permanent boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target_role text;
BEGIN
  -- Verify caller is super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can delete users');
  END IF;
  
  -- Prevent self-deletion
  IF _target_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete your own account');
  END IF;
  
  -- Check if target is super_admin
  SELECT role INTO _target_role FROM public.user_roles WHERE user_id = _target_user_id;
  IF _target_role = 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete super admin account');
  END IF;
  
  -- Remove from user_roles
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  IF _permanent THEN
    DELETE FROM public.profiles WHERE id = _target_user_id;
    RETURN json_build_object('success', true, 'message', 'User profile permanently deleted');
  ELSE
    UPDATE public.profiles 
    SET is_active = false, pin_hash = NULL 
    WHERE id = _target_user_id;
    RETURN json_build_object('success', true, 'message', 'User deactivated successfully');
  END IF;
END;
$$;

-- ============================================
-- STEP 5: Fix admin_reactivate_user function
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_reactivate_user(
  _user_id uuid,
  _full_name text,
  _role user_role,
  _pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  -- Verify caller is super_admin
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can reactivate users');
  END IF;
  
  -- Validate PIN format
  IF NOT (_pin ~ '^\d{6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 6 digits');
  END IF;
  
  -- Check user exists and is inactive
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND is_active = false) THEN
    RETURN json_build_object('success', false, 'error', 'User not found or already active');
  END IF;
  
  -- Update profile with new details
  UPDATE public.profiles
  SET 
    full_name = _full_name,
    role = _role,
    is_active = true,
    pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE id = _user_id;
  
  -- Upsert role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  
  RETURN json_build_object('success', true, 'message', 'User reactivated successfully');
END;
$$;

-- ============================================
-- STEP 6: Grant execute permissions
-- ============================================

GRANT EXECUTE ON FUNCTION public.admin_create_staff_user(uuid, text, text, user_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_user(uuid, text, user_role, text) TO authenticated;

-- ============================================
-- STEP 7: Verify has_role function exists
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, user_role) TO authenticated;

-- ============================================
-- VERIFICATION: Check functions are created
-- ============================================

SELECT 
  proname as function_name,
  'EXISTS' as status
FROM pg_proc 
WHERE proname IN (
  'admin_create_staff_user',
  'admin_update_user_status', 
  'admin_reset_user_pin',
  'admin_delete_user',
  'admin_reactivate_user',
  'has_role'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
