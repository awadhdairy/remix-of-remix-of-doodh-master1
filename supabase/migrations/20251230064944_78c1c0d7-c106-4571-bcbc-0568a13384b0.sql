-- Add phone and pin fields to profiles for mobile+PIN based authentication
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text UNIQUE,
ADD COLUMN IF NOT EXISTS pin_hash text;

-- Create index for phone lookup
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- Create function to verify PIN (simple hash comparison)
CREATE OR REPLACE FUNCTION public.verify_pin(_phone text, _pin text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id
  FROM public.profiles
  WHERE phone = _phone
    AND pin_hash = crypt(_pin, pin_hash);
  
  RETURN _user_id;
END;
$$;

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update handle_new_user to include phone if provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone, pin_hash)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email), 
    'super_admin',
    new.raw_user_meta_data ->> 'phone',
    CASE 
      WHEN new.raw_user_meta_data ->> 'pin' IS NOT NULL 
      THEN crypt(new.raw_user_meta_data ->> 'pin', gen_salt('bf'))
      ELSE NULL 
    END
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'super_admin');
  
  RETURN new;
END;
$function$;