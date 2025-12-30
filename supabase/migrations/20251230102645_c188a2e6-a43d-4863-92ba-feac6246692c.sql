-- Customer Authentication System
-- Customers will have their own auth accounts linked to the customers table

-- Create customer_accounts table for customer authentication
CREATE TABLE public.customer_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL UNIQUE,
    pin_hash TEXT,
    is_approved BOOLEAN DEFAULT false,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

-- Managers/admins can manage all customer accounts
CREATE POLICY "Managers and admins have full access to customer_accounts"
ON public.customer_accounts
FOR ALL
USING (is_manager_or_admin(auth.uid()));

-- Customers can view their own account
CREATE POLICY "Customers can view own account"
ON public.customer_accounts
FOR SELECT
USING (user_id = auth.uid());

-- Customers can update their own account (limited fields via RPC)
CREATE POLICY "Customers can update own account"
ON public.customer_accounts
FOR UPDATE
USING (user_id = auth.uid());

-- Create customer_auth_attempts table for rate limiting
CREATE TABLE public.customer_auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    failed_count INTEGER DEFAULT 0,
    last_attempt TIMESTAMP WITH TIME ZONE DEFAULT now(),
    locked_until TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.customer_auth_attempts ENABLE ROW LEVEL SECURITY;

-- No direct access to auth attempts
CREATE POLICY "No direct access to customer_auth_attempts"
ON public.customer_auth_attempts
FOR ALL
USING (false);

-- Function to verify customer PIN
CREATE OR REPLACE FUNCTION public.verify_customer_pin(_phone TEXT, _pin TEXT)
RETURNS TABLE(customer_id UUID, user_id UUID, is_approved BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _locked_until TIMESTAMP WITH TIME ZONE;
    _failed_count INTEGER;
    _account RECORD;
BEGIN
    -- Check if account is locked
    SELECT ca.locked_until, ca.failed_count INTO _locked_until, _failed_count
    FROM public.customer_auth_attempts ca WHERE ca.phone = _phone;
    
    IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
        RAISE EXCEPTION 'Account temporarily locked. Try again later.';
    END IF;
    
    -- Verify PIN
    SELECT cust.id AS customer_id, cust.user_id, cust.is_approved 
    INTO _account
    FROM public.customer_accounts cust
    WHERE cust.phone = _phone
      AND cust.pin_hash = crypt(_pin, cust.pin_hash);
    
    IF _account IS NULL THEN
        -- Increment failed attempts
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
        -- Reset attempts on success
        DELETE FROM public.customer_auth_attempts WHERE phone = _phone;
        
        -- Update last login
        UPDATE public.customer_accounts SET last_login = NOW() WHERE phone = _phone;
        
        RETURN QUERY SELECT _account.customer_id, _account.user_id, _account.is_approved;
    END IF;
END;
$$;

-- Function to register a customer account
CREATE OR REPLACE FUNCTION public.register_customer_account(_phone TEXT, _pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _customer RECORD;
    _existing_account RECORD;
    _result JSON;
BEGIN
    -- Check if account already exists
    SELECT * INTO _existing_account FROM public.customer_accounts WHERE phone = _phone;
    IF _existing_account IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'Account already exists for this phone number');
    END IF;
    
    -- Check if customer exists in customers table
    SELECT * INTO _customer FROM public.customers WHERE phone = _phone AND is_active = true;
    
    IF _customer IS NOT NULL THEN
        -- Auto-approve for existing customers
        INSERT INTO public.customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
        VALUES (_customer.id, _phone, crypt(_pin, gen_salt('bf')), true, 'approved');
        
        RETURN json_build_object(
            'success', true, 
            'approved', true, 
            'message', 'Account created and auto-approved',
            'customer_id', _customer.id
        );
    ELSE
        -- New customer - needs manual approval
        -- First create a customer entry
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
$$;

-- Function to update customer PIN
CREATE OR REPLACE FUNCTION public.update_customer_pin(_customer_id UUID, _current_pin TEXT, _new_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _account RECORD;
BEGIN
    -- Verify current PIN
    SELECT * INTO _account 
    FROM public.customer_accounts 
    WHERE customer_id = _customer_id 
      AND pin_hash = crypt(_current_pin, pin_hash);
    
    IF _account IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
    END IF;
    
    -- Update PIN
    UPDATE public.customer_accounts 
    SET pin_hash = crypt(_new_pin, gen_salt('bf')), updated_at = NOW()
    WHERE customer_id = _customer_id;
    
    RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$$;

-- Add RLS policy for customers to read their own data
CREATE POLICY "Customers can read own customer data"
ON public.customers
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = customers.id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can update limited fields on their own record
CREATE POLICY "Customers can update own customer data"
ON public.customers
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = customers.id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can view their own deliveries
CREATE POLICY "Customers can read own deliveries"
ON public.deliveries
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = deliveries.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can view their own delivery items
CREATE POLICY "Customers can read own delivery_items"
ON public.delivery_items
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.deliveries d
        JOIN public.customer_accounts ca ON ca.customer_id = d.customer_id
        WHERE d.id = delivery_items.delivery_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can view their own invoices
CREATE POLICY "Customers can read own invoices"
ON public.invoices
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = invoices.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can view their own payments
CREATE POLICY "Customers can read own payments"
ON public.payments
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = payments.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can view their own ledger
CREATE POLICY "Customers can read own ledger"
ON public.customer_ledger
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = customer_ledger.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can view their own products/subscriptions
CREATE POLICY "Customers can read own products"
ON public.customer_products
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = customer_products.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can manage their own subscriptions
CREATE POLICY "Customers can manage own subscriptions"
ON public.customer_products
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = customer_products.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can view their own vacations
CREATE POLICY "Customers can read own vacations"
ON public.customer_vacations
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = customer_vacations.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can manage their own vacations (pause subscription)
CREATE POLICY "Customers can manage own vacations"
ON public.customer_vacations
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = customer_vacations.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Customers can view their own bottles
CREATE POLICY "Customers can read own bottles"
ON public.customer_bottles
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customer_accounts ca 
        WHERE ca.customer_id = customer_bottles.customer_id 
        AND ca.user_id = auth.uid()
    )
);

-- Create index for performance
CREATE INDEX idx_customer_accounts_phone ON public.customer_accounts(phone);
CREATE INDEX idx_customer_accounts_customer_id ON public.customer_accounts(customer_id);
CREATE INDEX idx_customer_accounts_user_id ON public.customer_accounts(user_id);