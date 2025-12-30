-- Create a function to update user profile with PIN hash
CREATE OR REPLACE FUNCTION public.update_user_profile_with_pin(
  _user_id uuid,
  _full_name text,
  _phone text,
  _role user_role,
  _pin text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    full_name = _full_name,
    phone = _phone,
    role = _role,
    pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE id = _user_id;
END;
$$;