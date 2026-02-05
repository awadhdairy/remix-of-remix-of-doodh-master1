-- ============================================================================
-- AWADH DAIRY - COMPLETE EXTERNAL SUPABASE SCHEMA
-- ============================================================================
-- Run this script in your external Supabase SQL Editor:
-- https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'super_admin', 'manager', 'accountant', 'delivery_staff', 
    'farm_worker', 'vet_staff', 'auditor'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cattle_status AS ENUM ('active', 'sold', 'deceased', 'dry');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.lactation_status AS ENUM ('lactating', 'dry', 'pregnant', 'calving');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM ('pending', 'delivered', 'missed', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('paid', 'partial', 'pending', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.bottle_type AS ENUM ('glass', 'plastic');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.bottle_size AS ENUM ('500ml', '1L', '2L');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SECTION 2: CORE TABLES
-- ============================================================================

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  role public.user_role DEFAULT 'farm_worker',
  pin_hash TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (authoritative source for roles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auth sessions for custom PIN-based auth
CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'staff',
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  last_activity TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auth attempts for rate limiting
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  failed_count INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ DEFAULT now(),
  locked_until TIMESTAMPTZ
);

-- Activity logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dairy settings
CREATE TABLE IF NOT EXISTS public.dairy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_name TEXT NOT NULL DEFAULT 'My Dairy',
  phone TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'INR',
  invoice_prefix TEXT DEFAULT 'INV',
  financial_year_start INTEGER DEFAULT 4,
  upi_handle TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 3: CATTLE & FARM TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cattle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number TEXT NOT NULL UNIQUE,
  name TEXT,
  breed TEXT NOT NULL,
  cattle_type TEXT NOT NULL DEFAULT 'cow',
  date_of_birth DATE,
  status public.cattle_status DEFAULT 'active',
  lactation_status public.lactation_status DEFAULT 'dry',
  lactation_number INTEGER DEFAULT 0,
  weight NUMERIC,
  purchase_date DATE,
  purchase_cost NUMERIC,
  last_calving_date DATE,
  expected_calving_date DATE,
  sire_id UUID REFERENCES public.cattle(id),
  dam_id UUID REFERENCES public.cattle(id),
  image_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.breeding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES public.cattle(id),
  record_type TEXT NOT NULL,
  record_date DATE NOT NULL,
  heat_cycle_day INTEGER,
  insemination_bull TEXT,
  insemination_technician TEXT,
  pregnancy_confirmed BOOLEAN,
  expected_calving_date DATE,
  actual_calving_date DATE,
  calf_details JSONB,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cattle_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES public.cattle(id),
  record_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  record_date DATE NOT NULL,
  next_due_date DATE,
  vet_name TEXT,
  cost NUMERIC,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milk_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES public.cattle(id),
  production_date DATE NOT NULL,
  session TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
  quantity_liters NUMERIC NOT NULL,
  fat_percentage NUMERIC,
  snf_percentage NUMERIC,
  quality_notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cattle_id, production_date, session)
);

-- ============================================================================
-- SECTION 4: CUSTOMER TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  area TEXT,
  assigned_staff UUID,
  sequence_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  area TEXT,
  route_id UUID REFERENCES public.routes(id),
  subscription_type TEXT DEFAULT 'daily',
  billing_cycle TEXT DEFAULT 'monthly',
  credit_balance NUMERIC DEFAULT 0,
  advance_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id),
  user_id UUID,
  phone TEXT NOT NULL UNIQUE,
  pin_hash TEXT,
  is_approved BOOLEAN DEFAULT false,
  approval_status TEXT DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  failed_count INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ DEFAULT now(),
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC NOT NULL,
  unit TEXT DEFAULT 'L',
  tax_percentage NUMERIC DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  custom_price NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL,
  description TEXT NOT NULL,
  debit_amount NUMERIC DEFAULT 0,
  credit_amount NUMERIC DEFAULT 0,
  running_balance NUMERIC DEFAULT 0,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 5: DELIVERY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  delivery_date DATE NOT NULL,
  status public.delivery_status DEFAULT 'pending',
  delivery_time TIMESTAMPTZ,
  delivered_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  stop_order INTEGER NOT NULL,
  estimated_arrival_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 6: BILLING TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_amount NUMERIC NOT NULL,
  tax_amount NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  final_amount NUMERIC NOT NULL,
  payment_status public.payment_status DEFAULT 'pending',
  paid_amount NUMERIC DEFAULT 0,
  payment_date DATE,
  due_date DATE,
  upi_handle TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  invoice_id UUID REFERENCES public.invoices(id),
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode TEXT NOT NULL,
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  min_fat_percentage NUMERIC,
  max_fat_percentage NUMERIC,
  min_snf_percentage NUMERIC,
  max_snf_percentage NUMERIC,
  price_adjustment NUMERIC DEFAULT 0,
  adjustment_type TEXT DEFAULT 'fixed',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 7: EMPLOYEE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role public.user_role NOT NULL,
  salary NUMERIC,
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  shift_id UUID NOT NULL REFERENCES public.shifts(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  attendance_date DATE NOT NULL,
  status TEXT DEFAULT 'present',
  check_in TIME,
  check_out TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  base_salary NUMERIC DEFAULT 0,
  overtime_hours NUMERIC,
  overtime_rate NUMERIC,
  bonus NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  payment_date DATE,
  payment_mode TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 8: EXPENSE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  expense_date DATE NOT NULL,
  cattle_id UUID REFERENCES public.cattle(id),
  receipt_url TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 9: INVENTORY TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT DEFAULT 'kg',
  current_stock NUMERIC DEFAULT 0,
  min_stock_level NUMERIC DEFAULT 0,
  cost_per_unit NUMERIC,
  supplier TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feed_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES public.feed_inventory(id),
  cattle_id UUID REFERENCES public.cattle(id),
  consumption_date DATE NOT NULL,
  quantity NUMERIC NOT NULL,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_cost NUMERIC,
  warranty_expiry DATE,
  location TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id),
  maintenance_type TEXT NOT NULL,
  maintenance_date DATE NOT NULL,
  description TEXT,
  cost NUMERIC DEFAULT 0,
  performed_by TEXT,
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 10: BOTTLE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bottle_type public.bottle_type NOT NULL,
  size public.bottle_size NOT NULL,
  total_quantity INTEGER DEFAULT 0,
  available_quantity INTEGER DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bottle_type, size)
);

CREATE TABLE IF NOT EXISTS public.customer_bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  bottle_id UUID NOT NULL REFERENCES public.bottles(id),
  quantity_pending INTEGER DEFAULT 0,
  last_issued_date DATE,
  last_returned_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bottle_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bottle_id UUID NOT NULL REFERENCES public.bottles(id),
  customer_id UUID REFERENCES public.customers(id),
  transaction_type TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  staff_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 11: PROCUREMENT TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.milk_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  area TEXT,
  current_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milk_procurement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.milk_vendors(id),
  vendor_name TEXT,
  procurement_date DATE NOT NULL,
  session TEXT NOT NULL,
  quantity_liters NUMERIC NOT NULL,
  fat_percentage NUMERIC,
  snf_percentage NUMERIC,
  rate_per_liter NUMERIC,
  total_amount NUMERIC,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.milk_vendors(id),
  amount NUMERIC NOT NULL,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_mode TEXT DEFAULT 'cash',
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 12: NOTIFICATION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.notification_templates(id),
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_contact TEXT,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 13: HELPER FUNCTIONS
-- ============================================================================

-- Check if user is authenticated
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user has any of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.user_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Check if user is manager or admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(_user_id, ARRAY['super_admin', 'manager']::public.user_role[])
$$;

-- Check if customer is on vacation
CREATE OR REPLACE FUNCTION public.is_customer_on_vacation(_customer_id UUID, _check_date DATE DEFAULT CURRENT_DATE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_vacations
    WHERE customer_id = _customer_id
      AND is_active = true
      AND _check_date BETWEEN start_date AND end_date
  )
$$;

-- Update PIN only
CREATE OR REPLACE FUNCTION public.update_pin_only(_user_id UUID, _pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.profiles
  SET pin_hash = crypt(_pin, gen_salt('bf'))
  WHERE id = _user_id;
END;
$$;

-- Verify PIN for authentication (used by edge functions)
CREATE OR REPLACE FUNCTION public.verify_pin(_phone TEXT, _pin TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _user_id UUID;
  _locked_until TIMESTAMPTZ;
  _failed_count INTEGER;
BEGIN
  -- Check if account is locked
  SELECT locked_until, failed_count INTO _locked_until, _failed_count
  FROM public.auth_attempts WHERE phone = _phone;
  
  IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
    RAISE EXCEPTION 'Account temporarily locked. Try again later.';
  END IF;
  
  -- Verify PIN using pgcrypto
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

-- ============================================================================
-- SECTION 14: AUTHENTICATION FUNCTIONS
-- ============================================================================

-- Staff login function
CREATE OR REPLACE FUNCTION public.staff_login(_phone TEXT, _pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _profile RECORD;
  _session_token TEXT;
  _locked_until TIMESTAMPTZ;
  _failed_count INT;
BEGIN
  -- Check if account is locked
  SELECT locked_until, failed_count INTO _locked_until, _failed_count
  FROM public.auth_attempts WHERE phone = _phone;
  
  IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Account temporarily locked. Try again in 15 minutes.',
      'locked_until', _locked_until
    );
  END IF;

  -- Verify PIN and get user
  SELECT p.id, p.full_name, p.phone, p.role, p.is_active, ur.role as auth_role
  INTO _profile
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.phone = _phone 
    AND p.pin_hash = crypt(_pin, p.pin_hash);
  
  IF _profile IS NULL THEN
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
    RETURN json_build_object('success', false, 'error', 'Invalid phone number or PIN');
  END IF;
  
  -- Check if user is active
  IF NOT _profile.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Account is deactivated. Contact admin.');
  END IF;
  
  -- Clear failed attempts on success
  DELETE FROM public.auth_attempts WHERE phone = _phone;
  
  -- Generate secure session token
  _session_token := encode(gen_random_bytes(32), 'hex');
  
  -- Create session (expires in 7 days)
  INSERT INTO public.auth_sessions (user_id, user_type, session_token, expires_at)
  VALUES (_profile.id, 'staff', _session_token, NOW() + INTERVAL '7 days');
  
  RETURN json_build_object(
    'success', true,
    'session_token', _session_token,
    'user', json_build_object(
      'id', _profile.id,
      'full_name', _profile.full_name,
      'phone', _profile.phone,
      'role', COALESCE(_profile.auth_role::text, _profile.role::text)
    )
  );
END;
$$;

-- Staff logout
CREATE OR REPLACE FUNCTION public.staff_logout(_session_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auth_sessions WHERE session_token = _session_token;
  RETURN json_build_object('success', true, 'message', 'Logged out successfully');
END;
$$;

-- Validate session
CREATE OR REPLACE FUNCTION public.validate_session(_session_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session RECORD;
  _profile RECORD;
BEGIN
  -- Find valid session
  SELECT * INTO _session 
  FROM public.auth_sessions 
  WHERE session_token = _session_token AND expires_at > NOW();
  
  IF _session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Session expired or invalid');
  END IF;
  
  -- Get user profile based on user_type
  IF _session.user_type = 'staff' THEN
    SELECT p.id, p.full_name, p.phone, p.role, p.is_active, ur.role as auth_role 
    INTO _profile
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE p.id = _session.user_id;
    
    IF _profile IS NULL OR NOT _profile.is_active THEN
      DELETE FROM public.auth_sessions WHERE id = _session.id;
      RETURN json_build_object('success', false, 'error', 'User not found or inactive');
    END IF;
    
    -- Update last activity
    UPDATE public.auth_sessions SET last_activity = NOW() WHERE id = _session.id;
    
    RETURN json_build_object(
      'success', true,
      'user_type', 'staff',
      'user', json_build_object(
        'id', _profile.id,
        'full_name', _profile.full_name,
        'phone', _profile.phone,
        'role', COALESCE(_profile.auth_role::text, _profile.role::text)
      )
    );
  ELSIF _session.user_type = 'customer' THEN
    RETURN json_build_object(
      'success', true,
      'user_type', 'customer',
      'customer_id', _session.user_id
    );
  END IF;
  
  RETURN json_build_object('success', false, 'error', 'Invalid session type');
END;
$$;

-- Customer login
CREATE OR REPLACE FUNCTION public.customer_login(_phone TEXT, _pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _account RECORD;
  _session_token TEXT;
  _locked_until TIMESTAMPTZ;
BEGIN
  -- Check if account is locked
  SELECT locked_until INTO _locked_until
  FROM public.customer_auth_attempts WHERE phone = _phone;
  
  IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Account temporarily locked. Try again in 15 minutes.'
    );
  END IF;

  -- Verify PIN
  SELECT ca.customer_id, ca.is_approved, ca.user_id, c.name as customer_name
  INTO _account
  FROM public.customer_accounts ca
  JOIN public.customers c ON c.id = ca.customer_id
  WHERE ca.phone = _phone 
    AND ca.pin_hash = crypt(_pin, ca.pin_hash);
  
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
    RETURN json_build_object('success', false, 'error', 'Invalid phone number or PIN');
  END IF;
  
  -- Check if approved
  IF NOT _account.is_approved THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Account pending approval',
      'pending', true
    );
  END IF;
  
  -- Clear failed attempts
  DELETE FROM public.customer_auth_attempts WHERE phone = _phone;
  
  -- Update last login
  UPDATE public.customer_accounts SET last_login = NOW() WHERE customer_id = _account.customer_id;
  
  -- Generate session token
  _session_token := encode(gen_random_bytes(32), 'hex');
  
  -- Create session (expires in 30 days for customers)
  INSERT INTO public.auth_sessions (user_id, user_type, session_token, expires_at)
  VALUES (_account.customer_id, 'customer', _session_token, NOW() + INTERVAL '30 days');
  
  RETURN json_build_object(
    'success', true,
    'session_token', _session_token,
    'customer_id', _account.customer_id,
    'customer_name', _account.customer_name
  );
END;
$$;

-- Customer register
CREATE OR REPLACE FUNCTION public.customer_register(_phone TEXT, _pin TEXT)
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

-- Customer logout
CREATE OR REPLACE FUNCTION public.customer_logout(_session_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auth_sessions 
  WHERE session_token = _session_token AND user_type = 'customer';
  RETURN json_build_object('success', true, 'message', 'Logged out successfully');
END;
$$;

-- Validate customer session
CREATE OR REPLACE FUNCTION public.validate_customer_session(_session_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session RECORD;
  _customer RECORD;
BEGIN
  -- Find valid customer session
  SELECT * INTO _session 
  FROM public.auth_sessions 
  WHERE session_token = _session_token 
    AND user_type = 'customer'
    AND expires_at > NOW();
  
  IF _session IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Session expired or invalid');
  END IF;
  
  -- Get customer data
  SELECT c.*, ca.is_approved
  INTO _customer
  FROM public.customers c
  JOIN public.customer_accounts ca ON ca.customer_id = c.id
  WHERE c.id = _session.user_id;
  
  IF _customer IS NULL OR NOT _customer.is_approved THEN
    DELETE FROM public.auth_sessions WHERE id = _session.id;
    RETURN json_build_object('success', false, 'error', 'Customer not found or not approved');
  END IF;
  
  -- Update last activity
  UPDATE public.auth_sessions SET last_activity = NOW() WHERE id = _session.id;
  
  RETURN json_build_object(
    'success', true,
    'customer', json_build_object(
      'id', _customer.id,
      'name', _customer.name,
      'phone', _customer.phone,
      'email', _customer.email,
      'address', _customer.address,
      'area', _customer.area,
      'credit_balance', _customer.credit_balance,
      'advance_balance', _customer.advance_balance,
      'subscription_type', _customer.subscription_type,
      'billing_cycle', _customer.billing_cycle
    )
  );
END;
$$;

-- ============================================================================
-- SECTION 15: ADMIN FUNCTIONS
-- ============================================================================

-- Admin create staff
CREATE OR REPLACE FUNCTION public.admin_create_staff(_session_token TEXT, _full_name TEXT, _phone TEXT, _pin TEXT, _role public.user_role)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _caller RECORD;
  _new_user_id UUID;
BEGIN
  -- Validate caller session and role
  SELECT s.user_id, ur.role as caller_role INTO _caller
  FROM public.auth_sessions s
  JOIN public.user_roles ur ON ur.user_id = s.user_id
  WHERE s.session_token = _session_token 
    AND s.expires_at > NOW()
    AND s.user_type = 'staff';
  
  IF _caller IS NULL OR _caller.caller_role != 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can create users');
  END IF;
  
  -- Validate inputs
  IF NOT (_pin ~ '^\d{6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be exactly 6 digits');
  END IF;
  
  IF NOT (_phone ~ '^\d{10}$') THEN
    RETURN json_build_object('success', false, 'error', 'Phone must be 10 digits');
  END IF;
  
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN
    RETURN json_build_object('success', false, 'error', 'Full name is required');
  END IF;
  
  -- Check if phone already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone AND is_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'Phone number already in use');
  END IF;
  
  -- Generate new user ID
  _new_user_id := gen_random_uuid();
  
  -- Create profile
  INSERT INTO public.profiles (id, full_name, phone, role, is_active, pin_hash)
  VALUES (_new_user_id, trim(_full_name), _phone, _role, true, crypt(_pin, gen_salt('bf')));
  
  -- Create role entry
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_new_user_id, _role);
  
  -- Log activity
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_caller.user_id, 'user_created', 'user', _new_user_id::text, 
    jsonb_build_object('created_user_name', _full_name, 'created_user_role', _role::text));
  
  RETURN json_build_object(
    'success', true,
    'message', 'User created successfully',
    'user_id', _new_user_id
  );
END;
$$;

-- Admin delete staff
CREATE OR REPLACE FUNCTION public.admin_delete_staff_v2(_session_token TEXT, _target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller RECORD;
  _target RECORD;
BEGIN
  -- Validate caller session and role
  SELECT s.user_id, ur.role as caller_role INTO _caller
  FROM public.auth_sessions s
  JOIN public.user_roles ur ON ur.user_id = s.user_id
  WHERE s.session_token = _session_token 
    AND s.expires_at > NOW()
    AND s.user_type = 'staff';
  
  IF _caller IS NULL OR _caller.caller_role != 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Only super admin can delete users');
  END IF;
  
  -- Cannot delete self
  IF _target_user_id = _caller.user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete your own account');
  END IF;
  
  -- Get target user info
  SELECT p.id, p.full_name, p.phone, ur.role as user_role INTO _target
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.id = _target_user_id;
  
  IF _target.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Cannot delete super_admin
  IF _target.user_role = 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot delete super admin accounts');
  END IF;
  
  -- Delete sessions first
  DELETE FROM public.auth_sessions WHERE user_id = _target_user_id;
  
  -- Delete role
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  
  -- Delete profile (hard delete)
  DELETE FROM public.profiles WHERE id = _target_user_id;
  
  -- Log activity
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
  VALUES (_caller.user_id, 'user_deleted', 'user', _target_user_id::text, 
    jsonb_build_object('deleted_user_name', _target.full_name, 'deleted_user_phone', _target.phone));
  
  RETURN json_build_object(
    'success', true,
    'message', 'User ' || _target.full_name || ' deleted successfully'
  );
END;
$$;

-- Bootstrap super admin (for initial setup)
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin(_phone TEXT, _pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _existing_admin RECORD;
  _new_admin_id UUID;
BEGIN
  -- Check if super_admin already exists
  SELECT p.id, p.full_name INTO _existing_admin
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'super_admin' AND p.is_active = true
  LIMIT 1;
  
  IF _existing_admin.id IS NOT NULL THEN
    -- Update existing admin's PIN
    UPDATE public.profiles 
    SET pin_hash = crypt(_pin, gen_salt('bf'))
    WHERE id = _existing_admin.id;
    
    RETURN json_build_object(
      'success', true,
      'message', 'Admin credentials updated. Please login.',
      'user_id', _existing_admin.id
    );
  END IF;
  
  -- Check if profile with this phone exists
  SELECT id INTO _existing_admin FROM public.profiles WHERE phone = _phone;
  
  IF _existing_admin.id IS NOT NULL THEN
    -- Promote to super_admin
    UPDATE public.profiles 
    SET role = 'super_admin', is_active = true, pin_hash = crypt(_pin, gen_salt('bf'))
    WHERE id = _existing_admin.id;
    
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (_existing_admin.id, 'super_admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
    
    RETURN json_build_object(
      'success', true, 
      'message', 'Admin account ready. Please login.',
      'user_id', _existing_admin.id
    );
  END IF;
  
  -- Create new super_admin
  _new_admin_id := gen_random_uuid();
  
  INSERT INTO public.profiles (id, full_name, phone, role, is_active, pin_hash)
  VALUES (_new_admin_id, 'Super Admin', _phone, 'super_admin', true, crypt(_pin, gen_salt('bf')));
  
  INSERT INTO public.user_roles (user_id, role) VALUES (_new_admin_id, 'super_admin');
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Super admin created successfully. Please login.',
    'user_id', _new_admin_id
  );
END;
$$;

-- ============================================================================
-- SECTION 16: VIEWS
-- ============================================================================

-- Profiles safe view (excludes pin_hash)
CREATE OR REPLACE VIEW public.profiles_safe 
WITH (security_invoker = true)
AS SELECT 
  id,
  full_name,
  phone,
  role,
  is_active,
  created_at,
  updated_at
FROM public.profiles;

-- Customer accounts safe view (excludes pin_hash)
CREATE OR REPLACE VIEW public.customer_accounts_safe 
WITH (security_invoker = true)
AS SELECT 
  id,
  customer_id,
  phone,
  is_approved,
  approval_status,
  last_login,
  created_at
FROM public.customer_accounts;

-- Employees auditor view
CREATE OR REPLACE VIEW public.employees_auditor_view 
WITH (security_invoker = true)
AS SELECT 
  id,
  user_id,
  name,
  phone,
  role,
  joining_date,
  is_active,
  created_at
FROM public.employees;

-- Dairy settings public view
CREATE OR REPLACE VIEW public.dairy_settings_public 
WITH (security_invoker = true)
AS SELECT 
  dairy_name,
  phone,
  email,
  address,
  logo_url,
  currency,
  invoice_prefix
FROM public.dairy_settings;

-- Customers delivery view
CREATE OR REPLACE VIEW public.customers_delivery_view 
WITH (security_invoker = true)
AS SELECT 
  id,
  name,
  phone,
  address,
  area,
  route_id,
  subscription_type
FROM public.customers
WHERE is_active = true;

-- ============================================================================
-- SECTION 17: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dairy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cattle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breeding_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cattle_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milk_production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_vacations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bottle_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milk_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milk_procurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 18: RLS POLICIES
-- ============================================================================

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "Managers and admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- User roles policies
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Managers and admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Auth sessions policies
CREATE POLICY "Users can view their own sessions" ON public.auth_sessions
  FOR SELECT USING (true);

CREATE POLICY "Users can delete their own sessions" ON public.auth_sessions
  FOR DELETE USING (true);

-- Auth attempts policies
CREATE POLICY "Block all non-admin access to auth_attempts" ON public.auth_attempts
  FOR ALL USING (false);

CREATE POLICY "Admins can read auth_attempts" ON public.auth_attempts
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- Activity logs policies
CREATE POLICY "Block anonymous reads on activity_logs" ON public.activity_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and admins can view activity_logs" ON public.activity_logs
  FOR SELECT USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Auditors can view activity_logs" ON public.activity_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Users can insert their own activity_logs" ON public.activity_logs
  FOR INSERT WITH CHECK (public.is_authenticated() AND (user_id IS NULL OR user_id = auth.uid()));

-- Dairy settings policies
CREATE POLICY "Staff can read dairy_settings" ON public.dairy_settings
  FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Admins can manage dairy_settings" ON public.dairy_settings
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['super_admin', 'manager']::public.user_role[]));

-- Cattle policies
CREATE POLICY "Managers and admins have full access to cattle" ON public.cattle
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage cattle" ON public.cattle
  FOR ALL USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Vet staff can read cattle" ON public.cattle
  FOR SELECT USING (public.has_role(auth.uid(), 'vet_staff'));

CREATE POLICY "Auditors can read cattle" ON public.cattle
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Breeding records policies
CREATE POLICY "Managers and admins have full access to breeding_records" ON public.breeding_records
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage breeding_records" ON public.breeding_records
  FOR ALL USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Vet staff can manage breeding_records" ON public.breeding_records
  FOR ALL USING (public.has_role(auth.uid(), 'vet_staff'));

CREATE POLICY "Auditors can read breeding_records" ON public.breeding_records
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Cattle health policies
CREATE POLICY "Managers and admins have full access to cattle_health" ON public.cattle_health
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage cattle_health" ON public.cattle_health
  FOR ALL USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Vet staff can manage cattle_health" ON public.cattle_health
  FOR ALL USING (public.has_role(auth.uid(), 'vet_staff'));

CREATE POLICY "Auditors can read cattle_health" ON public.cattle_health
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Milk production policies
CREATE POLICY "Managers and admins have full access to milk_production" ON public.milk_production
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage milk_production" ON public.milk_production
  FOR ALL USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Auditors can read milk_production" ON public.milk_production
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Routes policies
CREATE POLICY "Managers and admins have full access to routes" ON public.routes
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can read routes" ON public.routes
  FOR SELECT USING (public.has_role(auth.uid(), 'delivery_staff'));

-- Customers policies
CREATE POLICY "Block anonymous access to customers" ON public.customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and admins have full access to customers" ON public.customers
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can read customers" ON public.customers
  FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read customers" ON public.customers
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Delivery staff can read customers" ON public.customers
  FOR SELECT USING (public.has_role(auth.uid(), 'delivery_staff'));

CREATE POLICY "Customers can read own data" ON public.customers
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = customers.id AND ca.user_id = auth.uid()
  ));

CREATE POLICY "Customers can update own data" ON public.customers
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = customers.id AND ca.user_id = auth.uid()
  ));

-- Customer accounts policies
CREATE POLICY "Block anonymous access to customer_accounts" ON public.customer_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and admins have full access to customer_accounts" ON public.customer_accounts
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Customers can view own account" ON public.customer_accounts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Customers can update own account" ON public.customer_accounts
  FOR UPDATE USING (user_id = auth.uid());

-- Customer auth attempts policies
CREATE POLICY "Block all non-admin access to customer_auth_attempts" ON public.customer_auth_attempts
  FOR ALL USING (false);

CREATE POLICY "Admins can read customer_auth_attempts" ON public.customer_auth_attempts
  FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));

-- Products policies
CREATE POLICY "Staff can read products" ON public.products
  FOR SELECT USING (public.is_authenticated());

CREATE POLICY "Managers and admins can manage products" ON public.products
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

-- Customer products policies
CREATE POLICY "Managers and admins have full access to customer_products" ON public.customer_products
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can read customer_products" ON public.customer_products
  FOR SELECT USING (public.has_role(auth.uid(), 'delivery_staff'));

CREATE POLICY "Auditors can read customer_products" ON public.customer_products
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Customers can read own products" ON public.customer_products
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = customer_products.customer_id AND ca.user_id = auth.uid()
  ));

CREATE POLICY "Customers can manage own subscriptions" ON public.customer_products
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = customer_products.customer_id AND ca.user_id = auth.uid()
  ));

-- Customer vacations policies
CREATE POLICY "Managers and admins have full access to customer_vacations" ON public.customer_vacations
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can read customer_vacations" ON public.customer_vacations
  FOR SELECT USING (public.has_role(auth.uid(), 'delivery_staff'));

CREATE POLICY "Auditors can read customer_vacations" ON public.customer_vacations
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Customers can read own vacations" ON public.customer_vacations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = customer_vacations.customer_id AND ca.user_id = auth.uid()
  ));

CREATE POLICY "Customers can manage own vacations" ON public.customer_vacations
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = customer_vacations.customer_id AND ca.user_id = auth.uid()
  ));

-- Customer ledger policies
CREATE POLICY "Block anonymous access to customer_ledger" ON public.customer_ledger
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and admins have full access to customer_ledger" ON public.customer_ledger
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can manage customer_ledger" ON public.customer_ledger
  FOR ALL USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read customer_ledger" ON public.customer_ledger
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Customers can read own ledger" ON public.customer_ledger
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = customer_ledger.customer_id AND ca.user_id = auth.uid()
  ));

-- Deliveries policies
CREATE POLICY "Managers and admins have full access to deliveries" ON public.deliveries
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can manage deliveries" ON public.deliveries
  FOR ALL USING (public.has_role(auth.uid(), 'delivery_staff'));

CREATE POLICY "Auditors can read deliveries" ON public.deliveries
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Customers can read own deliveries" ON public.deliveries
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = deliveries.customer_id AND ca.user_id = auth.uid()
  ));

-- Delivery items policies
CREATE POLICY "Managers and admins have full access to delivery_items" ON public.delivery_items
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can manage delivery_items" ON public.delivery_items
  FOR ALL USING (public.has_role(auth.uid(), 'delivery_staff'));

CREATE POLICY "Auditors can read delivery_items" ON public.delivery_items
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Customers can read own delivery_items" ON public.delivery_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.deliveries d
    JOIN public.customer_accounts ca ON ca.customer_id = d.customer_id
    WHERE d.id = delivery_items.delivery_id AND ca.user_id = auth.uid()
  ));

-- Route stops policies
CREATE POLICY "Managers and admins have full access to route_stops" ON public.route_stops
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can read route_stops" ON public.route_stops
  FOR SELECT USING (public.has_role(auth.uid(), 'delivery_staff'));

-- Invoices policies
CREATE POLICY "Block anonymous access to invoices" ON public.invoices
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers and admins have full access to invoices" ON public.invoices
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can manage invoices" ON public.invoices
  FOR ALL USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read invoices" ON public.invoices
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Customers can read own invoices" ON public.invoices
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = invoices.customer_id AND ca.user_id = auth.uid()
  ));

-- Payments policies
CREATE POLICY "Managers and admins have full access to payments" ON public.payments
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can manage payments" ON public.payments
  FOR ALL USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read payments" ON public.payments
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Price rules policies
CREATE POLICY "Managers and admins have full access to price_rules" ON public.price_rules
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Staff can read price_rules" ON public.price_rules
  FOR SELECT USING (public.is_authenticated());

-- Employees policies
CREATE POLICY "Managers and admins have full access to employees" ON public.employees
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Role-based employee access" ON public.employees
  FOR SELECT USING (
    public.is_manager_or_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'accountant') OR
    public.has_role(auth.uid(), 'auditor') OR
    user_id = auth.uid()
  );

CREATE POLICY "Auditors can read employees" ON public.employees
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Shifts policies
CREATE POLICY "Managers and admins have full access to shifts" ON public.shifts
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Staff can read shifts" ON public.shifts
  FOR SELECT USING (public.is_authenticated());

-- Employee shifts policies
CREATE POLICY "Managers and admins have full access to employee_shifts" ON public.employee_shifts
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Staff can read employee_shifts" ON public.employee_shifts
  FOR SELECT USING (public.is_authenticated());

-- Attendance policies
CREATE POLICY "Managers and admins have full access to attendance" ON public.attendance
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Attendance access for authorized roles" ON public.attendance
  FOR SELECT USING (
    public.is_manager_or_admin(auth.uid()) OR
    public.has_role(auth.uid(), 'accountant') OR
    public.has_role(auth.uid(), 'auditor') OR
    EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance.employee_id AND e.user_id = auth.uid())
  );

CREATE POLICY "Attendance insert for authorized roles" ON public.attendance
  FOR INSERT WITH CHECK (public.is_manager_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Attendance update for authorized roles" ON public.attendance
  FOR UPDATE USING (public.is_manager_or_admin(auth.uid()) OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read attendance" ON public.attendance
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Payroll records policies
CREATE POLICY "Managers and admins have full access to payroll_records" ON public.payroll_records
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can manage payroll_records" ON public.payroll_records
  FOR ALL USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read payroll_records" ON public.payroll_records
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Expenses policies
CREATE POLICY "Managers and admins have full access to expenses" ON public.expenses
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can manage expenses" ON public.expenses
  FOR ALL USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read expenses" ON public.expenses
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Feed inventory policies
CREATE POLICY "Managers and admins have full access to feed_inventory" ON public.feed_inventory
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can read feed_inventory" ON public.feed_inventory
  FOR SELECT USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Auditors can read feed_inventory" ON public.feed_inventory
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Feed consumption policies
CREATE POLICY "Managers and admins have full access to feed_consumption" ON public.feed_consumption
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage feed_consumption" ON public.feed_consumption
  FOR ALL USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Auditors can read feed_consumption" ON public.feed_consumption
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Equipment policies
CREATE POLICY "Managers and admins have full access to equipment" ON public.equipment
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Staff can read equipment" ON public.equipment
  FOR SELECT USING (public.is_authenticated());

-- Maintenance records policies
CREATE POLICY "Managers and admins have full access to maintenance_records" ON public.maintenance_records
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage maintenance_records" ON public.maintenance_records
  FOR ALL USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Auditors can read maintenance_records" ON public.maintenance_records
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Bottles policies
CREATE POLICY "Managers and admins have full access to bottles" ON public.bottles
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Staff can read bottles" ON public.bottles
  FOR SELECT USING (public.is_authenticated());

-- Customer bottles policies
CREATE POLICY "Managers and admins have full access to customer_bottles" ON public.customer_bottles
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can manage customer_bottles" ON public.customer_bottles
  FOR ALL USING (public.has_role(auth.uid(), 'delivery_staff'));

CREATE POLICY "Auditors can read customer_bottles" ON public.customer_bottles
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Customers can read own bottles" ON public.customer_bottles
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.customer_accounts ca
    WHERE ca.customer_id = customer_bottles.customer_id AND ca.user_id = auth.uid()
  ));

-- Bottle transactions policies
CREATE POLICY "Managers and admins have full access to bottle_transactions" ON public.bottle_transactions
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can manage bottle_transactions" ON public.bottle_transactions
  FOR ALL USING (public.has_role(auth.uid(), 'delivery_staff'));

CREATE POLICY "Auditors can read bottle_transactions" ON public.bottle_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Milk vendors policies
CREATE POLICY "Managers and admins have full access to milk_vendors" ON public.milk_vendors
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can read milk_vendors" ON public.milk_vendors
  FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read milk_vendors" ON public.milk_vendors
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

CREATE POLICY "Farm workers can manage milk_vendors" ON public.milk_vendors
  FOR ALL USING (public.has_role(auth.uid(), 'farm_worker'));

-- Milk procurement policies
CREATE POLICY "Managers and admins have full access to milk_procurement" ON public.milk_procurement
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage milk_procurement" ON public.milk_procurement
  FOR ALL USING (public.has_role(auth.uid(), 'farm_worker'));

CREATE POLICY "Accountants can read milk_procurement" ON public.milk_procurement
  FOR SELECT USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read milk_procurement" ON public.milk_procurement
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Vendor payments policies
CREATE POLICY "Managers and admins have full access to vendor_payments" ON public.vendor_payments
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can manage vendor_payments" ON public.vendor_payments
  FOR ALL USING (public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Auditors can read vendor_payments" ON public.vendor_payments
  FOR SELECT USING (public.has_role(auth.uid(), 'auditor'));

-- Notification templates policies
CREATE POLICY "Managers and admins have full access to notification_templates" ON public.notification_templates
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Staff can read notification_templates" ON public.notification_templates
  FOR SELECT USING (public.is_authenticated());

-- Notification logs policies
CREATE POLICY "Managers and admins have full access to notification_logs" ON public.notification_logs
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Staff can read notification_logs" ON public.notification_logs
  FOR SELECT USING (public.is_authenticated());

-- ============================================================================
-- SECTION 19: TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply to tables with updated_at column
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dairy_settings_updated_at
  BEFORE UPDATE ON public.dairy_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cattle_updated_at
  BEFORE UPDATE ON public.cattle
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_accounts_updated_at
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feed_inventory_updated_at
  BEFORE UPDATE ON public.feed_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bottles_updated_at
  BEFORE UPDATE ON public.bottles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_bottles_updated_at
  BEFORE UPDATE ON public.customer_bottles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milk_vendors_updated_at
  BEFORE UPDATE ON public.milk_vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milk_procurement_updated_at
  BEFORE UPDATE ON public.milk_procurement
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_rules_updated_at
  BEFORE UPDATE ON public.price_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vendor balance recalculation trigger
CREATE OR REPLACE FUNCTION public.recalculate_vendor_balance(p_vendor_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_dues NUMERIC;
  v_total_paid NUMERIC;
  v_balance NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_dues
  FROM public.milk_procurement
  WHERE vendor_id = p_vendor_id;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.vendor_payments
  WHERE vendor_id = p_vendor_id;
  
  v_balance := v_total_dues - v_total_paid;
  
  UPDATE public.milk_vendors
  SET current_balance = v_balance
  WHERE id = p_vendor_id;
  
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vendor_balance_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_vendor_balance(OLD.vendor_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_vendor_balance(NEW.vendor_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_vendor_balance_on_procurement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_vendor_balance(OLD.vendor_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_vendor_balance(NEW.vendor_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER update_vendor_balance_after_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.vendor_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_vendor_balance_on_payment();

CREATE TRIGGER update_vendor_balance_after_procurement
  AFTER INSERT OR UPDATE OR DELETE ON public.milk_procurement
  FOR EACH ROW EXECUTE FUNCTION public.update_vendor_balance_on_procurement();

-- ============================================================================
-- SECTION 20: INITIAL DATA (OPTIONAL - RUN AFTER SCHEMA)
-- ============================================================================

-- Insert default dairy settings
INSERT INTO public.dairy_settings (dairy_name, currency, invoice_prefix)
VALUES ('Awadh Dairy', 'INR', 'INV')
ON CONFLICT DO NOTHING;

-- Insert default bottle types
INSERT INTO public.bottles (bottle_type, size, total_quantity, available_quantity, deposit_amount) VALUES
('glass', '500ml', 100, 100, 50),
('glass', '1L', 200, 200, 100),
('glass', '2L', 50, 50, 150),
('plastic', '500ml', 150, 150, 0),
('plastic', '1L', 300, 300, 0),
('plastic', '2L', 100, 100, 0)
ON CONFLICT DO NOTHING;

-- Insert default shifts
INSERT INTO public.shifts (name, start_time, end_time) VALUES
('Morning', '06:00', '14:00'),
('Evening', '14:00', '22:00'),
('Night', '22:00', '06:00')
ON CONFLICT DO NOTHING;

-- Insert default products
INSERT INTO public.products (name, category, base_price, unit, description) VALUES
('Full Cream Milk', 'milk', 70, 'L', 'Fresh full cream milk'),
('Toned Milk', 'milk', 55, 'L', 'Low fat toned milk'),
('Cow Milk', 'milk', 60, 'L', 'Pure cow milk'),
('Buffalo Milk', 'milk', 80, 'L', 'Rich buffalo milk'),
('Curd', 'dairy', 50, 'kg', 'Fresh homemade curd'),
('Paneer', 'dairy', 350, 'kg', 'Fresh cottage cheese'),
('Ghee', 'dairy', 650, 'kg', 'Pure desi ghee'),
('Butter', 'dairy', 550, 'kg', 'Fresh butter')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SECTION 21: DATA INTEGRITY FUNCTIONS
-- ============================================================================

-- Cleanup orphaned data function - removes profiles without auth users, roles without profiles
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orphaned_profiles INT := 0;
  _orphaned_roles INT := 0;
BEGIN
  -- Find and delete profiles with no matching auth user
  WITH deleted_profiles AS (
    DELETE FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.users au WHERE au.id = p.id
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO _orphaned_profiles FROM deleted_profiles;

  -- Find and delete user_roles with no matching profile
  WITH deleted_roles AS (
    DELETE FROM public.user_roles ur
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id
    )
    RETURNING user_id
  )
  SELECT COUNT(*) INTO _orphaned_roles FROM deleted_roles;

  -- Delete orphaned sessions
  DELETE FROM public.auth_sessions s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = s.user_id
  );

  RETURN json_build_object(
    'success', true,
    'orphaned_profiles_deleted', _orphaned_profiles,
    'orphaned_roles_deleted', _orphaned_roles
  );
END;
$$;

-- Function to check for orphaned data without deleting
CREATE OR REPLACE FUNCTION public.check_orphaned_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orphaned_profiles INT := 0;
  _orphaned_roles INT := 0;
  _orphaned_sessions INT := 0;
BEGIN
  -- Count profiles without auth users
  SELECT COUNT(*) INTO _orphaned_profiles
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = p.id
  );

  -- Count user_roles without profiles
  SELECT COUNT(*) INTO _orphaned_roles
  FROM public.user_roles ur
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id
  );

  -- Count sessions without profiles
  SELECT COUNT(*) INTO _orphaned_sessions
  FROM public.auth_sessions s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = s.user_id
  );

  RETURN json_build_object(
    'orphaned_profiles', _orphaned_profiles,
    'orphaned_roles', _orphaned_roles,
    'orphaned_sessions', _orphaned_sessions,
    'has_issues', (_orphaned_profiles > 0 OR _orphaned_roles > 0 OR _orphaned_sessions > 0)
  );
END;
$$;

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================
-- Now run the bootstrap_super_admin function with your credentials:
-- SELECT public.bootstrap_super_admin('7897716792', '101101');
-- 
-- Or run the cleanup function to fix orphaned data:
-- SELECT public.cleanup_orphaned_data();
-- 
-- To check for orphaned data without cleaning:
-- SELECT public.check_orphaned_data();
-- ============================================================================
