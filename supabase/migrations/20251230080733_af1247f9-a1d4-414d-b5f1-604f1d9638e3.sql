-- Update the handle_new_user trigger to auto-promote 7897716792 to super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _phone text;
  _role user_role;
BEGIN
  _phone := COALESCE(new.raw_user_meta_data ->> 'phone', '');
  
  -- Check if this is the designated super admin phone
  IF _phone = '7897716792' THEN
    _role := 'super_admin';
  ELSE
    _role := 'farm_worker';
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, phone, pin_hash)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'full_name', 'Admin'), 
    _role,
    _phone,
    CASE 
      WHEN new.raw_user_meta_data ->> 'pin' IS NOT NULL 
      THEN crypt(new.raw_user_meta_data ->> 'pin', gen_salt('bf'))
      ELSE NULL 
    END
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, _role);
  
  RETURN new;
END;
$$;