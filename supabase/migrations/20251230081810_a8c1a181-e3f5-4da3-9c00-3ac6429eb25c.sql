-- Ensure roles are managed ONLY via user_roles; profiles.role is treated as non-authoritative
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _phone text;
BEGIN
  _phone := COALESCE(new.raw_user_meta_data ->> 'phone', '');

  -- Create minimal profile row (role column is non-authoritative; keep default farm_worker)
  INSERT INTO public.profiles (id, full_name, role, phone, pin_hash)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email),
    'farm_worker',
    NULLIF(_phone, ''),
    NULL
  );

  -- Store actual permissions/role in the dedicated table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'farm_worker');

  RETURN new;
END;
$$;