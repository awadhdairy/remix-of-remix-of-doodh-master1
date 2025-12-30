-- Create a function to update only the PIN hash
CREATE OR REPLACE FUNCTION public.update_pin_only(
  _user_id uuid,
  _pin text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE id = _user_id;
END;
$$;