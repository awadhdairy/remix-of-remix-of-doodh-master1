-- Fix update_user_profile_with_pin to use COALESCE for NULL safety
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
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    full_name = COALESCE(_full_name, full_name),
    phone = COALESCE(_phone, phone),
    role = COALESCE(_role, role),
    pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE id = _user_id;
END;
$$;

-- Fix update_pin_only to have proper search_path for pgcrypto
CREATE OR REPLACE FUNCTION public.update_pin_only(_user_id uuid, _pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  UPDATE public.profiles
  SET pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE id = _user_id;
END;
$$;

-- Fix verify_pin to have proper search_path for pgcrypto
CREATE OR REPLACE FUNCTION public.verify_pin(_phone text, _pin text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _user_id uuid;
  _locked_until timestamp with time zone;
  _failed_count integer;
BEGIN
  -- Check if account is locked
  SELECT locked_until, failed_count INTO _locked_until, _failed_count
  FROM public.auth_attempts WHERE phone = _phone;
  
  IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
    RAISE EXCEPTION 'Account temporarily locked. Try again later.';
  END IF;
  
  -- Verify PIN
  SELECT id INTO _user_id
  FROM public.profiles
  WHERE phone = _phone
    AND pin_hash = crypt(_pin, pin_hash);
  
  IF _user_id IS NULL THEN
    -- Increment failed attempts
    INSERT INTO public.auth_attempts (phone, failed_count, last_attempt)
    VALUES (_phone, 1, NOW())
    ON CONFLICT (phone) DO UPDATE
    SET failed_count = auth_attempts.failed_count + 1,
        last_attempt = NOW(),
        locked_until = CASE
          WHEN auth_attempts.failed_count >= 4 THEN NOW() + INTERVAL '15 minutes'
          ELSE NULL
        END;
    RETURN NULL;
  ELSE
    -- Reset attempts on success
    DELETE FROM public.auth_attempts WHERE phone = _phone;
    RETURN _user_id;
  END IF;
END;
$$;

-- Backfill missing pin_hash for admin user (PIN: 101101)
UPDATE public.profiles
SET pin_hash = crypt('101101', gen_salt('bf'))
WHERE phone = '7897716792' AND (pin_hash IS NULL OR pin_hash = '');