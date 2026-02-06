-- ============================================================================
-- CUSTOMER PORTAL SQL FUNCTIONS
-- Run this in your external Supabase SQL Editor:
-- https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql
-- ============================================================================

-- Helper function to hash PIN for customer accounts (used by edge functions)
CREATE OR REPLACE FUNCTION public.hash_pin_for_customer(_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN crypt(_pin, gen_salt('bf'));
END;
$$;

-- Auto-create customer account for existing customers using default PIN
CREATE OR REPLACE FUNCTION public.auto_create_customer_account_if_exists(
  _phone TEXT,
  _pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _customer RECORD;
  _existing_account RECORD;
BEGIN
  -- Check if account already exists
  SELECT * INTO _existing_account FROM customer_accounts WHERE phone = _phone;
  IF _existing_account IS NOT NULL THEN
    RETURN json_build_object('exists', true, 'has_account', true);
  END IF;
  
  -- Check if customer exists with this phone (pre-registered by admin)
  SELECT * INTO _customer FROM customers WHERE phone = _phone AND is_active = true;
  
  IF _customer IS NOT NULL THEN
    -- Create auto-approved account with provided PIN
    INSERT INTO customer_accounts (
      customer_id, phone, pin_hash, is_approved, approval_status
    ) VALUES (
      _customer.id, 
      _phone, 
      crypt(_pin, gen_salt('bf')), 
      true, 
      'approved'
    );
    
    RETURN json_build_object(
      'exists', true,
      'has_account', false,
      'auto_created', true,
      'customer_id', _customer.id,
      'customer_name', _customer.name
    );
  END IF;
  
  RETURN json_build_object('exists', false);
END;
$$;

-- Register customer account function (if not already exists)
CREATE OR REPLACE FUNCTION public.register_customer_account(_phone TEXT, _pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _customer RECORD;
  _existing_account RECORD;
  _new_customer_id uuid;
BEGIN
  -- Validate inputs
  IF NOT (_pin ~ '^\d{6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be 6 digits');
  END IF;
  
  IF NOT (_phone ~ '^\d{10}$') THEN
    RETURN json_build_object('success', false, 'error', 'Phone must be 10 digits');
  END IF;

  -- Check if account already exists
  SELECT * INTO _existing_account FROM public.customer_accounts WHERE phone = _phone;
  IF _existing_account IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Account already exists for this phone number');
  END IF;
  
  -- Check if existing customer with this phone
  SELECT * INTO _customer FROM public.customers WHERE phone = _phone AND is_active = true;
  
  IF _customer IS NOT NULL THEN
    -- Auto-approve for existing customers
    INSERT INTO public.customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
    VALUES (_customer.id, _phone, crypt(_pin, gen_salt('bf')), true, 'approved');
    
    RETURN json_build_object(
      'success', true, 
      'approved', true, 
      'message', 'Account created and auto-approved. You can now login.',
      'customer_id', _customer.id
    );
  ELSE
    -- Create new customer (pending approval)
    _new_customer_id := gen_random_uuid();
    
    INSERT INTO public.customers (id, name, phone, is_active)
    VALUES (_new_customer_id, 'Pending Registration', _phone, false);
    
    INSERT INTO public.customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
    VALUES (_new_customer_id, _phone, crypt(_pin, gen_salt('bf')), false, 'pending');
    
    RETURN json_build_object(
      'success', true, 
      'approved', false, 
      'message', 'Account created. Pending admin approval.',
      'customer_id', _new_customer_id
    );
  END IF;
END;
$$;

-- ============================================================================
-- VERIFICATION QUERY
-- Run this to check if functions were created successfully:
-- ============================================================================
-- SELECT proname FROM pg_proc WHERE proname IN ('hash_pin_for_customer', 'auto_create_customer_account_if_exists', 'register_customer_account');
