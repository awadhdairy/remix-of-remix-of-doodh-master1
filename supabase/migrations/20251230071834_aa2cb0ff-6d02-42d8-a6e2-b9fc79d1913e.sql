-- Update PIN validation to 6 digits
-- The verify_pin function already works with any PIN length since it uses bcrypt

-- Note: We need to create the admin user through Supabase Auth
-- This cannot be done via SQL migration - the user needs to sign up through the auth flow

-- However, we can prepare the system to auto-promote the first user with this phone number
-- Create a one-time setup function that will be triggered

CREATE OR REPLACE FUNCTION public.setup_initial_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  -- Find user with phone 7897716792
  SELECT id INTO _user_id FROM profiles WHERE phone = '7897716792';
  
  IF _user_id IS NOT NULL THEN
    -- Update their role to super_admin
    UPDATE profiles SET role = 'super_admin' WHERE id = _user_id;
    
    -- Update user_roles table
    DELETE FROM user_roles WHERE user_id = _user_id;
    INSERT INTO user_roles (user_id, role) VALUES (_user_id, 'super_admin');
  END IF;
END;
$$;