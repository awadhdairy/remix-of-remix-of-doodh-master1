-- ============================================================================
-- CUSTOMER PORTAL SQL FUNCTIONS - COMPLETE
-- Run this in your external Supabase SQL Editor:
-- https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql
-- ============================================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. Helper function to hash PIN for customer accounts
-- ============================================================================
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

-- ============================================================================
-- 2. CRITICAL: Verify customer PIN (for login)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_customer_pin(_phone TEXT, _pin TEXT)
RETURNS TABLE(customer_id UUID, user_id UUID, is_approved BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    _locked_until TIMESTAMPTZ;
    _failed_count INTEGER;
    _account RECORD;
BEGIN
    -- Check if account is locked
    SELECT ca.locked_until, ca.failed_count INTO _locked_until, _failed_count
    FROM public.customer_auth_attempts ca WHERE ca.phone = _phone;
    
    IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
        RAISE EXCEPTION 'Account temporarily locked. Try again later.';
    END IF;
    
    -- Verify PIN using bcrypt comparison
    SELECT cust.customer_id, cust.user_id, cust.is_approved 
    INTO _account
    FROM public.customer_accounts cust
    WHERE cust.phone = _phone
      AND cust.pin_hash = crypt(_pin, cust.pin_hash);
    
    IF _account IS NULL THEN
        -- Record failed attempt with lockout after 5 failures
        INSERT INTO public.customer_auth_attempts (phone, failed_count, last_attempt)
        VALUES (_phone, 1, NOW())
        ON CONFLICT (phone) DO UPDATE
        SET failed_count = customer_auth_attempts.failed_count + 1,
            last_attempt = NOW(),
            locked_until = CASE
                WHEN customer_auth_attempts.failed_count >= 4 THEN NOW() + INTERVAL '15 minutes'
                ELSE NULL
            END;
        -- Return empty (no rows = failed verification)
        RETURN;
    ELSE
        -- Clear failed attempts on success
        DELETE FROM public.customer_auth_attempts WHERE phone = _phone;
        -- Update last login timestamp
        UPDATE public.customer_accounts SET last_login = NOW() WHERE phone = _phone;
        -- Return the account details
        RETURN QUERY SELECT _account.customer_id, _account.user_id, _account.is_approved;
    END IF;
END;
$$;

-- ============================================================================
-- 3. Update customer PIN (for profile changes)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_customer_pin(
    _customer_id UUID, 
    _current_pin TEXT, 
    _new_pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    _account RECORD;
BEGIN
    -- Validate new PIN format (must be 6 digits)
    IF NOT (_new_pin ~ '^\d{6}$') THEN
        RETURN json_build_object('success', false, 'error', 'New PIN must be 6 digits');
    END IF;

    -- Verify current PIN matches
    SELECT * INTO _account 
    FROM public.customer_accounts 
    WHERE customer_id = _customer_id 
      AND pin_hash = crypt(_current_pin, pin_hash);
    
    IF _account IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
    END IF;
    
    -- Update to new PIN (bcrypt hashed)
    UPDATE public.customer_accounts 
    SET pin_hash = crypt(_new_pin, gen_salt('bf')), 
        updated_at = NOW()
    WHERE customer_id = _customer_id;
    
    RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$$;

-- ============================================================================
-- 4. Register customer account (IMPROVED - handles duplicates gracefully)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.register_customer_account(_phone TEXT, _pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _customer RECORD;
  _existing_account RECORD;
  _new_customer_id UUID;
BEGIN
  -- Validate PIN format (must be 6 digits)
  IF NOT (_pin ~ '^\d{6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be 6 digits');
  END IF;
  
  -- Validate phone format (must be 10 digits)
  IF NOT (_phone ~ '^\d{10}$') THEN
    RETURN json_build_object('success', false, 'error', 'Phone must be 10 digits');
  END IF;

  -- Check if customer_account already exists for this phone
  SELECT ca.*, c.name as customer_name 
  INTO _existing_account 
  FROM public.customer_accounts ca
  JOIN public.customers c ON c.id = ca.customer_id
  WHERE ca.phone = _phone;
  
  IF _existing_account IS NOT NULL THEN
    -- Account already exists - guide user appropriately
    IF _existing_account.is_approved THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'Account already exists. Please login with your PIN.',
        'has_account', true,
        'is_approved', true
      );
    ELSE
      RETURN json_build_object(
        'success', false, 
        'error', 'Account pending approval. Please wait for admin to approve.',
        'has_account', true,
        'is_approved', false,
        'pending', true
      );
    END IF;
  END IF;
  
  -- Check if existing customer with this phone (pre-registered by admin)
  SELECT * INTO _customer FROM public.customers WHERE phone = _phone AND is_active = true;
  
  IF _customer IS NOT NULL THEN
    -- Existing customer (admin-added) - auto-approve with USER'S chosen PIN (NOT default)
    INSERT INTO public.customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
    VALUES (_customer.id, _phone, crypt(_pin, gen_salt('bf')), true, 'approved');
    
    RETURN json_build_object(
      'success', true, 
      'approved', true, 
      'message', 'Account created and auto-approved. You can now login with your PIN.',
      'customer_id', _customer.id
    );
  ELSE
    -- Brand new customer - create pending account
    _new_customer_id := gen_random_uuid();
    
    -- Create inactive customer record
    INSERT INTO public.customers (id, name, phone, is_active)
    VALUES (_new_customer_id, 'Pending Registration', _phone, false);
    
    -- Create pending customer_account with user's chosen PIN
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
-- 5. Auto-create customer account for existing customers (default PIN login)
-- ============================================================================
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

-- ============================================================================
-- VERIFICATION QUERY
-- Run this to check if all functions were created successfully:
-- ============================================================================
-- SELECT proname FROM pg_proc 
-- WHERE proname IN (
--   'hash_pin_for_customer', 
--   'verify_customer_pin', 
--   'update_customer_pin',
--   'register_customer_account', 
--   'auto_create_customer_account_if_exists'
-- );

-- ============================================================================
-- EXPECTED OUTPUT:
-- proname
-- -----------------------------------------
-- hash_pin_for_customer
-- verify_customer_pin
-- update_customer_pin
-- register_customer_account
-- auto_create_customer_account_if_exists
-- ============================================================================
