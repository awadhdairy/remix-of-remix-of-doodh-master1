-- Update admin_delete_user to support both soft and hard delete
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
    -- Hard delete: remove profile entirely (auth.users deletion handled via Edge Function)
    DELETE FROM public.profiles WHERE id = _target_user_id;
    RETURN json_build_object('success', true, 'message', 'User profile permanently deleted');
  ELSE
    -- Soft delete: mark inactive and clear sensitive data
    UPDATE public.profiles 
    SET is_active = false, pin_hash = NULL 
    WHERE id = _target_user_id;
    RETURN json_build_object('success', true, 'message', 'User deactivated successfully');
  END IF;
END;
$$;

-- Function to check if phone number can be reused or if user can be reactivated
CREATE OR REPLACE FUNCTION public.check_phone_availability(_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing RECORD;
BEGIN
  SELECT id, full_name, is_active, role INTO _existing
  FROM public.profiles
  WHERE phone = _phone;
  
  IF _existing IS NULL THEN
    RETURN json_build_object('available', true);
  ELSIF NOT _existing.is_active THEN
    RETURN json_build_object(
      'available', false, 
      'reactivatable', true,
      'user_id', _existing.id,
      'full_name', _existing.full_name,
      'previous_role', _existing.role
    );
  ELSE
    RETURN json_build_object(
      'available', false, 
      'reactivatable', false,
      'error', 'Phone number already in use by active user'
    );
  END IF;
END;
$$;

-- Function to reactivate a soft-deleted user
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
  
  -- Upsert role in user_roles table (authoritative source)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  
  RETURN json_build_object('success', true, 'message', 'User reactivated successfully');
END;
$$;

-- Grant execute permissions to authenticated users (admin check is inside functions)
GRANT EXECUTE ON FUNCTION public.check_phone_availability(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_user(uuid, text, user_role, text) TO authenticated;