-- Fix customer authentication functions to include extensions schema for pgcrypto

CREATE OR REPLACE FUNCTION public.register_customer_account(_phone text, _pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    _customer RECORD;
    _existing_account RECORD;
BEGIN
    SELECT * INTO _existing_account FROM public.customer_accounts WHERE phone = _phone;
    IF _existing_account IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'Account already exists for this phone number');
    END IF;
    
    SELECT * INTO _customer FROM public.customers WHERE phone = _phone AND is_active = true;
    
    IF _customer IS NOT NULL THEN
        INSERT INTO public.customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
        VALUES (_customer.id, _phone, crypt(_pin, gen_salt('bf')), true, 'approved');
        
        RETURN json_build_object(
            'success', true, 
            'approved', true, 
            'message', 'Account created and auto-approved',
            'customer_id', _customer.id
        );
    ELSE
        INSERT INTO public.customers (name, phone, is_active)
        VALUES ('Pending Registration', _phone, false)
        RETURNING * INTO _customer;
        
        INSERT INTO public.customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
        VALUES (_customer.id, _phone, crypt(_pin, gen_salt('bf')), false, 'pending');
        
        RETURN json_build_object(
            'success', true, 
            'approved', false, 
            'message', 'Account created, pending approval',
            'customer_id', _customer.id
        );
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_customer_pin(_phone text, _pin text)
 RETURNS TABLE(customer_id uuid, user_id uuid, is_approved boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    _locked_until TIMESTAMP WITH TIME ZONE;
    _failed_count INTEGER;
    _account RECORD;
BEGIN
    SELECT ca.locked_until, ca.failed_count INTO _locked_until, _failed_count
    FROM public.customer_auth_attempts ca WHERE ca.phone = _phone;
    
    IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
        RAISE EXCEPTION 'Account temporarily locked. Try again later.';
    END IF;
    
    SELECT cust.id AS customer_id, cust.user_id, cust.is_approved 
    INTO _account
    FROM public.customer_accounts cust
    WHERE cust.phone = _phone
      AND cust.pin_hash = crypt(_pin, cust.pin_hash);
    
    IF _account IS NULL THEN
        INSERT INTO public.customer_auth_attempts (phone, failed_count, last_attempt)
        VALUES (_phone, 1, NOW())
        ON CONFLICT (phone) DO UPDATE
        SET failed_count = customer_auth_attempts.failed_count + 1,
            last_attempt = NOW(),
            locked_until = CASE
                WHEN customer_auth_attempts.failed_count >= 4 THEN NOW() + INTERVAL '15 minutes'
                ELSE NULL
            END;
        RETURN;
    ELSE
        DELETE FROM public.customer_auth_attempts WHERE phone = _phone;
        UPDATE public.customer_accounts SET last_login = NOW() WHERE phone = _phone;
        RETURN QUERY SELECT _account.customer_id, _account.user_id, _account.is_approved;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_customer_pin(_customer_id uuid, _current_pin text, _new_pin text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    _account RECORD;
BEGIN
    SELECT * INTO _account 
    FROM public.customer_accounts 
    WHERE customer_id = _customer_id 
      AND pin_hash = crypt(_current_pin, pin_hash);
    
    IF _account IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
    END IF;
    
    UPDATE public.customer_accounts 
    SET pin_hash = crypt(_new_pin, gen_salt('bf')), updated_at = NOW()
    WHERE customer_id = _customer_id;
    
    RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$function$;