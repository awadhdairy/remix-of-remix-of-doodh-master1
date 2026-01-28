# 🥛 AWADH DAIRY - COMPLETE SYSTEM BLUEPRINT
## Comprehensive AI-Ready Recreation Prompt

> **Purpose**: This document is a 100% complete, self-explanatory blueprint enabling any AI to recreate the entire Awadh Dairy management system from scratch. It covers every feature, component, interaction, database schema, edge function, hook, utility, and design token.

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Complete Database Schema](#3-complete-database-schema)
4. [Database Functions & Triggers](#4-database-functions--triggers)
5. [Edge Functions](#5-edge-functions)
6. [Authentication System](#6-authentication-system)
7. [Role-Based Access Control](#7-role-based-access-control)
8. [Application Routes](#8-application-routes)
9. [Staff Portal Pages (Detailed)](#9-staff-portal-pages-detailed)
10. [Customer Mobile App (Detailed)](#10-customer-mobile-app-detailed)
11. [Dashboard Components](#11-dashboard-components)
12. [Reusable Components](#12-reusable-components)
13. [Custom Hooks](#13-custom-hooks)
14. [Utility Libraries](#14-utility-libraries)
15. [Design System](#15-design-system)
16. [Animations & Micro-Interactions](#16-animations--micro-interactions)
17. [Data Relationships & Flows](#17-data-relationships--flows)
18. [Security Implementation](#18-security-implementation)
19. [Deployment Guide](#19-deployment-guide)
20. [File Structure](#20-file-structure)

---

## 1. PROJECT OVERVIEW

### 1.1 Description
**Awadh Dairy** is a comprehensive dairy management system designed for independent dairy owners in India. It manages:
- Cattle inventory and health
- Milk production tracking (morning/evening sessions)
- Customer subscriptions and deliveries
- Billing, invoicing, and payments
- Employee management (attendance, payroll, shifts)
- Breeding and reproduction cycles
- Feed and equipment inventory
- Financial reporting and analytics

### 1.2 Target Users
1. **Staff Portal**: Super Admin, Manager, Accountant, Delivery Staff, Farm Worker, Vet Staff, Auditor
2. **Customer Mobile App**: Dairy customers for self-service subscription management

### 1.3 Core Philosophy
- Mobile-first responsive design
- Role-based dashboards with filtered navigation
- Real-time data from Supabase
- Automated workflows (attendance, deliveries, alerts)
- Comprehensive audit trails

---

## 2. TECHNOLOGY STACK

### 2.1 Frontend
```
- React 18.3.1 with TypeScript
- Vite (build tool)
- React Router DOM 6.x (routing)
- TanStack Query 5.x (server state management)
- Tailwind CSS 3.x (styling)
- shadcn/ui (component library based on Radix UI)
- Lucide React (icons)
- Recharts (charts and visualizations)
- Framer Motion concepts via CSS animations
- date-fns (date manipulation)
- Zod (validation)
- React Hook Form (forms)
- jsPDF + jspdf-autotable (PDF generation)
- xlsx (Excel export)
- canvas-confetti (celebration effects)
```

### 2.2 Backend (Supabase)
```
- PostgreSQL database
- Row Level Security (RLS) policies
- Edge Functions (Deno runtime)
- Real-time subscriptions capability
- Built-in authentication (email/password mapped from phone/PIN)
```

### 2.3 Fonts
```
- Primary: Outfit (Google Fonts)
- Weights: 300, 400, 500, 600, 700, 800
```

---

## 3. COMPLETE DATABASE SCHEMA

### 3.1 Enums

```sql
-- User roles
CREATE TYPE user_role AS ENUM (
  'super_admin', 'manager', 'accountant', 
  'delivery_staff', 'farm_worker', 'vet_staff', 'auditor'
);

-- Cattle status
CREATE TYPE cattle_status AS ENUM ('active', 'sold', 'deceased', 'dry');

-- Lactation status
CREATE TYPE lactation_status AS ENUM ('lactating', 'dry', 'pregnant', 'calving');

-- Delivery status
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'missed', 'partial');

-- Payment status
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');

-- Bottle type
CREATE TYPE bottle_type AS ENUM ('glass', 'plastic');

-- Bottle size
CREATE TYPE bottle_size AS ENUM ('500ml', '1L', '2L', '5L');
```

### 3.2 Core Tables

#### profiles (User profiles linked to auth.users)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  pin_hash TEXT,
  role user_role DEFAULT 'farm_worker',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### user_roles (Authoritative role storage)
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  role user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### cattle (Cattle inventory)
```sql
CREATE TABLE cattle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_number TEXT UNIQUE NOT NULL,
  name TEXT,
  breed TEXT NOT NULL,
  cattle_type TEXT DEFAULT 'cow', -- cow, buffalo
  date_of_birth DATE,
  weight DECIMAL,
  status cattle_status DEFAULT 'active',
  lactation_status lactation_status DEFAULT 'dry',
  lactation_number INTEGER DEFAULT 0,
  last_calving_date DATE,
  expected_calving_date DATE,
  purchase_date DATE,
  purchase_cost DECIMAL,
  image_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### milk_production (Daily milk records)
```sql
CREATE TABLE milk_production (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES cattle(id),
  production_date DATE NOT NULL,
  session TEXT NOT NULL CHECK (session IN ('morning', 'evening')),
  quantity_liters DECIMAL NOT NULL,
  fat_percentage DECIMAL,
  snf_percentage DECIMAL,
  quality_notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cattle_id, production_date, session)
);
```

#### customers (Customer master)
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  area TEXT,
  route_id UUID REFERENCES routes(id),
  subscription_type TEXT DEFAULT 'daily', -- daily, alternate, weekly, custom
  billing_cycle TEXT DEFAULT 'monthly', -- weekly, monthly, quarterly
  credit_balance DECIMAL DEFAULT 0,
  advance_balance DECIMAL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### customer_accounts (Customer app authentication)
```sql
CREATE TABLE customer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID UNIQUE NOT NULL REFERENCES customers(id),
  phone TEXT NOT NULL,
  pin_hash TEXT,
  user_id UUID REFERENCES auth.users(id),
  is_approved BOOLEAN DEFAULT false,
  approval_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### customer_products (Subscriptions)
```sql
CREATE TABLE customer_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  custom_price DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, product_id)
);
```

#### customer_vacations (Delivery pause periods)
```sql
CREATE TABLE customer_vacations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### customer_ledger (Transaction history)
```sql
CREATE TABLE customer_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL, -- delivery, payment, invoice, adjustment
  description TEXT NOT NULL,
  debit_amount DECIMAL DEFAULT 0,
  credit_amount DECIMAL DEFAULT 0,
  running_balance DECIMAL,
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### products (Product catalog)
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- milk, curd, ghee, paneer, buttermilk
  description TEXT,
  base_price DECIMAL NOT NULL,
  unit TEXT DEFAULT 'liter', -- liter, kg, piece
  tax_percentage DECIMAL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### deliveries (Daily delivery schedule)
```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  delivery_date DATE NOT NULL,
  status delivery_status DEFAULT 'pending',
  delivery_time TIMESTAMPTZ,
  delivered_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, delivery_date)
);
```

#### delivery_items (Items in each delivery)
```sql
CREATE TABLE delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL NOT NULL,
  total_amount DECIMAL NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### invoices (Billing invoices)
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  total_amount DECIMAL NOT NULL,
  tax_amount DECIMAL DEFAULT 0,
  discount_amount DECIMAL DEFAULT 0,
  final_amount DECIMAL NOT NULL,
  paid_amount DECIMAL DEFAULT 0,
  payment_status payment_status DEFAULT 'pending',
  payment_date DATE,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### payments (Payment records)
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  invoice_id UUID REFERENCES invoices(id),
  amount DECIMAL NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode TEXT NOT NULL, -- cash, upi, bank_transfer, cheque
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### bottles (Bottle inventory)
```sql
CREATE TABLE bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bottle_type bottle_type NOT NULL,
  size bottle_size NOT NULL,
  total_quantity INTEGER DEFAULT 0,
  available_quantity INTEGER DEFAULT 0,
  deposit_amount DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bottle_type, size)
);
```

#### customer_bottles (Bottles with customers)
```sql
CREATE TABLE customer_bottles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  bottle_id UUID NOT NULL REFERENCES bottles(id),
  quantity_pending INTEGER DEFAULT 0,
  last_issued_date DATE,
  last_returned_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, bottle_id)
);
```

#### bottle_transactions (Bottle movements)
```sql
CREATE TABLE bottle_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bottle_id UUID NOT NULL REFERENCES bottles(id),
  customer_id UUID REFERENCES customers(id),
  transaction_type TEXT NOT NULL, -- issued, returned, damaged, lost
  quantity INTEGER NOT NULL,
  transaction_date DATE NOT NULL,
  staff_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### cattle_health (Health records)
```sql
CREATE TABLE cattle_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES cattle(id),
  record_date DATE NOT NULL,
  record_type TEXT NOT NULL, -- vaccination, treatment, checkup, disease
  title TEXT NOT NULL,
  description TEXT,
  vet_name TEXT,
  cost DECIMAL,
  next_due_date DATE,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### breeding_records (Breeding history)
```sql
CREATE TABLE breeding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cattle_id UUID NOT NULL REFERENCES cattle(id),
  record_date DATE NOT NULL,
  record_type TEXT NOT NULL, -- heat_detection, artificial_insemination, natural_mating, pregnancy_check
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
```

#### employees (Staff records)
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role user_role NOT NULL,
  salary DECIMAL,
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### shifts (Work shifts)
```sql
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### employee_shifts (Shift assignments)
```sql
CREATE TABLE employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  shift_id UUID NOT NULL REFERENCES shifts(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### attendance (Daily attendance)
```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  attendance_date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status TEXT DEFAULT 'present', -- present, absent, half_day, leave
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, attendance_date)
);
```

#### payroll_records (Salary records)
```sql
CREATE TABLE payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id),
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  base_salary DECIMAL NOT NULL DEFAULT 0,
  overtime_hours DECIMAL DEFAULT 0,
  overtime_rate DECIMAL,
  bonus DECIMAL DEFAULT 0,
  deductions DECIMAL DEFAULT 0,
  net_salary DECIMAL NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending', -- pending, paid
  payment_date DATE,
  payment_mode TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### feed_inventory (Feed stock)
```sql
CREATE TABLE feed_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- fodder, concentrate, mineral, supplement
  unit TEXT DEFAULT 'kg',
  current_stock DECIMAL DEFAULT 0,
  min_stock_level DECIMAL DEFAULT 0,
  cost_per_unit DECIMAL,
  supplier TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### feed_consumption (Feed usage)
```sql
CREATE TABLE feed_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id UUID NOT NULL REFERENCES feed_inventory(id),
  cattle_id UUID REFERENCES cattle(id),
  consumption_date DATE NOT NULL,
  quantity DECIMAL NOT NULL,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### equipment (Farm equipment)
```sql
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- milking, cooling, transport, general
  model TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_cost DECIMAL,
  warranty_expiry DATE,
  status TEXT DEFAULT 'operational', -- operational, maintenance, repair, retired
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### maintenance_records (Equipment maintenance)
```sql
CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment(id),
  maintenance_date DATE NOT NULL,
  maintenance_type TEXT NOT NULL, -- preventive, corrective, emergency
  description TEXT,
  cost DECIMAL,
  performed_by TEXT,
  next_maintenance_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### routes (Delivery routes)
```sql
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  area_covered TEXT,
  assigned_staff UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### expenses (Business expenses)
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- feed, medicine, transport, utilities, salary, maintenance, other
  amount DECIMAL NOT NULL,
  expense_date DATE NOT NULL,
  cattle_id UUID REFERENCES cattle(id),
  receipt_url TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### price_rules (Dynamic pricing)
```sql
CREATE TABLE price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  min_fat_percentage DECIMAL,
  max_fat_percentage DECIMAL,
  min_snf_percentage DECIMAL,
  max_snf_percentage DECIMAL,
  price_adjustment DECIMAL DEFAULT 0,
  adjustment_type TEXT DEFAULT 'fixed', -- fixed, percentage
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### dairy_settings (Business configuration)
```sql
CREATE TABLE dairy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dairy_name TEXT NOT NULL DEFAULT 'Doodh Wallah',
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'INR',
  invoice_prefix TEXT DEFAULT 'INV',
  financial_year_start INTEGER DEFAULT 4, -- April
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### notification_templates (SMS/Email templates)
```sql
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- invoice, reminder, delivery, alert
  channel TEXT NOT NULL, -- sms, email, push
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### notification_logs (Sent notifications)
```sql
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES notification_templates(id),
  recipient_type TEXT NOT NULL, -- customer, employee
  recipient_id UUID NOT NULL,
  recipient_contact TEXT,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### activity_logs (Audit trail)
```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### auth_attempts (Staff login rate limiting)
```sql
CREATE TABLE auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  failed_count INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  locked_until TIMESTAMPTZ
);
```

#### customer_auth_attempts (Customer login rate limiting)
```sql
CREATE TABLE customer_auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  failed_count INTEGER DEFAULT 0,
  last_attempt TIMESTAMPTZ,
  locked_until TIMESTAMPTZ
);
```

---

## 4. DATABASE FUNCTIONS & TRIGGERS

### 4.1 Authentication Functions

```sql
-- Verify staff PIN and return user ID
CREATE OR REPLACE FUNCTION verify_pin(_phone TEXT, _pin TEXT)
RETURNS UUID AS $$
DECLARE
  _user_id UUID;
  _locked_until TIMESTAMPTZ;
  _failed_count INTEGER;
BEGIN
  -- Check if account is locked
  SELECT locked_until, failed_count INTO _locked_until, _failed_count
  FROM auth_attempts WHERE phone = _phone;
  
  IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
    RAISE EXCEPTION 'Account temporarily locked. Try again later.';
  END IF;
  
  -- Verify PIN using pgcrypto
  SELECT id INTO _user_id
  FROM profiles
  WHERE phone = _phone
    AND pin_hash = crypt(_pin, pin_hash);
  
  IF _user_id IS NULL THEN
    -- Increment failed attempts
    INSERT INTO auth_attempts (phone, failed_count, last_attempt)
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
    DELETE FROM auth_attempts WHERE phone = _phone;
    RETURN _user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Register customer account
CREATE OR REPLACE FUNCTION register_customer_account(_phone TEXT, _pin TEXT)
RETURNS JSON AS $$
DECLARE
  _customer RECORD;
  _existing_account RECORD;
BEGIN
  -- Check if account already exists
  SELECT * INTO _existing_account FROM customer_accounts WHERE phone = _phone;
  IF _existing_account IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Account already exists');
  END IF;
  
  -- Check if customer with this phone exists
  SELECT * INTO _customer FROM customers WHERE phone = _phone AND is_active = true;
  
  IF _customer IS NOT NULL THEN
    -- Auto-approve existing customer
    INSERT INTO customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
    VALUES (_customer.id, _phone, crypt(_pin, gen_salt('bf')), true, 'approved');
    
    RETURN json_build_object(
      'success', true, 
      'approved', true, 
      'customer_id', _customer.id
    );
  ELSE
    -- Create pending customer
    INSERT INTO customers (name, phone, is_active)
    VALUES ('Pending Registration', _phone, false)
    RETURNING * INTO _customer;
    
    INSERT INTO customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
    VALUES (_customer.id, _phone, crypt(_pin, gen_salt('bf')), false, 'pending');
    
    RETURN json_build_object(
      'success', true, 
      'approved', false, 
      'customer_id', _customer.id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions';

-- Verify customer PIN
CREATE OR REPLACE FUNCTION verify_customer_pin(_phone TEXT, _pin TEXT)
RETURNS TABLE(customer_id UUID, user_id UUID, is_approved BOOLEAN) AS $$
DECLARE
  _locked_until TIMESTAMPTZ;
  _failed_count INTEGER;
  _account RECORD;
BEGIN
  -- Check if locked
  SELECT ca.locked_until, ca.failed_count INTO _locked_until, _failed_count
  FROM customer_auth_attempts ca WHERE ca.phone = _phone;
  
  IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
    RAISE EXCEPTION 'Account temporarily locked';
  END IF;
  
  -- Verify PIN
  SELECT cust.id AS customer_id, cust.user_id, cust.is_approved 
  INTO _account
  FROM customer_accounts cust
  WHERE cust.phone = _phone
    AND cust.pin_hash = crypt(_pin, cust.pin_hash);
  
  IF _account IS NULL THEN
    -- Track failed attempt
    INSERT INTO customer_auth_attempts (phone, failed_count, last_attempt)
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
    DELETE FROM customer_auth_attempts WHERE phone = _phone;
    UPDATE customer_accounts SET last_login = NOW() WHERE phone = _phone;
    RETURN QUERY SELECT _account.customer_id, _account.user_id, _account.is_approved;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions';

-- Update customer PIN
CREATE OR REPLACE FUNCTION update_customer_pin(_customer_id UUID, _current_pin TEXT, _new_pin TEXT)
RETURNS JSON AS $$
DECLARE
  _account RECORD;
BEGIN
  SELECT * INTO _account 
  FROM customer_accounts 
  WHERE customer_id = _customer_id 
    AND pin_hash = crypt(_current_pin, pin_hash);
  
  IF _account IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
  END IF;
  
  UPDATE customer_accounts 
  SET pin_hash = crypt(_new_pin, gen_salt('bf')), updated_at = NOW()
  WHERE customer_id = _customer_id;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions';
```

### 4.2 Utility Functions

```sql
-- Check if customer is on vacation
CREATE OR REPLACE FUNCTION is_customer_on_vacation(_customer_id UUID, _check_date DATE DEFAULT CURRENT_DATE)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM customer_vacations
    WHERE customer_id = _customer_id
      AND is_active = true
      AND _check_date BETWEEN start_date AND end_date
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Check user role
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Check multiple roles
CREATE OR REPLACE FUNCTION has_any_role(_user_id UUID, _roles user_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public';

-- Auto-create attendance
CREATE OR REPLACE FUNCTION auto_create_daily_attendance()
RETURNS VOID AS $$
BEGIN
  INSERT INTO attendance (employee_id, attendance_date, status, check_in)
  SELECT e.id, CURRENT_DATE, 'present', '09:00:00'::time
  FROM employees e
  WHERE e.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM attendance a 
      WHERE a.employee_id = e.id AND a.attendance_date = CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Handle new user trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _phone TEXT;
BEGIN
  _phone := COALESCE(new.raw_user_meta_data ->> 'phone', '');

  INSERT INTO profiles (id, full_name, role, phone, pin_hash)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email),
    'farm_worker',
    NULLIF(_phone, ''),
    NULL
  );

  INSERT INTO user_roles (user_id, role)
  VALUES (new.id, 'farm_worker');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';
```

---

## 5. EDGE FUNCTIONS

### 5.1 bootstrap-admin
**Purpose**: First-time setup of super admin account
**Location**: `supabase/functions/bootstrap-admin/index.ts`

```typescript
// Validates specific credentials (phone: 7897716792, PIN: 101101)
// Creates auth user with email pattern: {phone}@doodhwallah.app
// Sets role to super_admin in profiles and user_roles tables
// Uses SUPABASE_SERVICE_ROLE_KEY for admin operations
```

### 5.2 customer-auth
**Purpose**: Customer login/registration/PIN change
**Location**: `supabase/functions/customer-auth/index.ts`

```typescript
// Actions: register, login, change-pin
// Uses database functions for PIN verification
// Creates auth users with email: customer_{phone}@doodhwallah.app
// Auto-approves if customer phone exists in customers table
// Rate limiting via customer_auth_attempts table
```

### 5.3 create-user
**Purpose**: Staff user creation by admin
**Location**: `supabase/functions/create-user/index.ts`

```typescript
// Creates auth user with email: {phone}@doodhwallah.app
// Sets profile and role
// Uses service role key for admin.createUser
```

### 5.4 update-user-status
**Purpose**: Activate/deactivate staff accounts
**Location**: `supabase/functions/update-user-status/index.ts`

### 5.5 reset-user-pin
**Purpose**: Admin resets staff PIN
**Location**: `supabase/functions/reset-user-pin/index.ts`

### 5.6 change-pin
**Purpose**: Staff self-service PIN change
**Location**: `supabase/functions/change-pin/index.ts`

### 5.7 delete-user
**Purpose**: Remove staff accounts
**Location**: `supabase/functions/delete-user/index.ts`

**Common Pattern for All Edge Functions**:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  // ... implementation
})
```

---

## 6. AUTHENTICATION SYSTEM

### 6.1 Staff Authentication Flow
1. User enters phone number and 6-digit PIN at `/auth`
2. Frontend converts phone to email: `{phone}@doodhwallah.app`
3. Supabase `signInWithPassword(email, pin)` is called
4. On success, redirect to `/dashboard`
5. `useUserRole` hook fetches role from `user_roles` table

### 6.2 Customer Authentication Flow
1. Customer enters phone and PIN at `/customer/auth`
2. `customer-auth` edge function is invoked
3. Database function `verify_customer_pin` validates credentials
4. Edge function creates session and returns tokens
5. `useCustomerAuth` context stores session and customer data
6. Redirect to `/customer/dashboard`

### 6.3 Bootstrap Admin
- Hardcoded credentials: Phone `7897716792`, PIN `101101`
- One-time setup creates super_admin account
- "Setup Admin Account" button appears only with correct credentials

### 6.4 Session Management
```typescript
// Staff: Using Supabase auth state
const { data: { subscription } } = supabase.auth.onAuthStateChange(...)

// Customer: Custom context with session storage
const { login, logout, customerId, customerData } = useCustomerAuth()
```

---

## 7. ROLE-BASED ACCESS CONTROL

### 7.1 Role Definitions

| Role | Dashboard | Accessible Sections |
|------|-----------|---------------------|
| super_admin | AdminDashboard | All sections |
| manager | AdminDashboard | All except audit logs |
| accountant | AccountantDashboard | billing, expenses, reports, customers, employees |
| delivery_staff | DeliveryDashboard | deliveries, customers, bottles |
| farm_worker | FarmDashboard | cattle, production, health, inventory |
| vet_staff | VetDashboard | cattle, health |
| auditor | AuditorDashboard | billing, expenses, reports, audit logs |

### 7.2 Navigation Filtering
```typescript
// AppSidebar.tsx
const roleSections: Record<string, string[]> = {
  super_admin: ["main", "cattle", "production", "customers", "deliveries", "billing", "bottles", "health", "inventory", "expenses", "reports", "settings", "users", "employees", "notifications", "audit"],
  manager: ["main", "cattle", "production", "customers", "deliveries", "billing", "bottles", "health", "inventory", "expenses", "reports", "settings", "employees", "notifications"],
  accountant: ["main", "billing", "expenses", "reports", "customers", "employees"],
  delivery_staff: ["main", "deliveries", "customers", "bottles"],
  farm_worker: ["main", "cattle", "production", "health", "inventory"],
  vet_staff: ["main", "cattle", "health"],
  auditor: ["main", "billing", "expenses", "reports", "audit"],
};
```

### 7.3 Role Colors (Semantic Tokens)
```css
--role-admin: 0 78% 55%;      /* Red */
--role-manager: 220 95% 58%;  /* Blue */
--role-accountant: 145 75% 42%; /* Green */
--role-delivery: 28 98% 55%;  /* Orange */
--role-farm: 42 95% 52%;      /* Yellow */
--role-vet: 275 85% 58%;      /* Purple */
--role-auditor: 220 12% 52%;  /* Gray */
```

---

## 8. APPLICATION ROUTES

### 8.1 Staff Portal Routes
```typescript
<Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/auth" element={<Auth />} />
  
  <Route element={<DashboardLayout />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/cattle" element={<CattlePage />} />
    <Route path="/production" element={<ProductionPage />} />
    <Route path="/products" element={<ProductsPage />} />
    <Route path="/customers" element={<CustomersPage />} />
    <Route path="/deliveries" element={<DeliveriesPage />} />
    <Route path="/billing" element={<BillingPage />} />
    <Route path="/bottles" element={<BottlesPage />} />
    <Route path="/health" element={<HealthPage />} />
    <Route path="/inventory" element={<InventoryPage />} />
    <Route path="/expenses" element={<ExpensesPage />} />
    <Route path="/reports" element={<ReportsPage />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/users" element={<UserManagement />} />
    <Route path="/employees" element={<EmployeesPage />} />
    <Route path="/breeding" element={<BreedingPage />} />
    <Route path="/equipment" element={<EquipmentPage />} />
    <Route path="/routes" element={<RoutesPage />} />
    <Route path="/price-rules" element={<PriceRulesPage />} />
    <Route path="/audit-logs" element={<AuditLogsPage />} />
    <Route path="/notifications" element={<NotificationsPage />} />
  </Route>
</Routes>
```

### 8.2 Customer App Routes
```typescript
<Routes>
  <Route path="/customer/auth" element={<CustomerAuth />} />
  
  <Route element={<CustomerLayout />}>
    <Route path="/customer/dashboard" element={<CustomerDashboard />} />
    <Route path="/customer/subscription" element={<CustomerSubscription />} />
    <Route path="/customer/products" element={<CustomerProducts />} />
    <Route path="/customer/deliveries" element={<CustomerDeliveries />} />
    <Route path="/customer/billing" element={<CustomerBilling />} />
    <Route path="/customer/profile" element={<CustomerProfile />} />
  </Route>
</Routes>
```

---

## 9. STAFF PORTAL PAGES (DETAILED)

### 9.1 Dashboard (`/dashboard`)
- **Role-based rendering**: Switches dashboard component based on user role
- **Welcome header**: Displays user name and current date
- **Role badge**: Shows current role with color coding

### 9.2 Cattle Management (`/cattle`)
**Features**:
- List all cattle with search/filter
- Add/Edit cattle dialog
- Delete confirmation
- Milk history dialog per cattle
- Stats cards: Total, Lactating, Pregnant, Dry counts

**Fields**: tag_number*, name, breed*, cattle_type, date_of_birth, weight, status, lactation_status, notes

### 9.3 Milk Production (`/production`)
**Features**:
- Batch entry for all lactating cattle
- Date and session (morning/evening) selection
- Fat % and SNF % tracking
- Quality notes
- Clickable stats to view history
- Daily totals with session breakdown

### 9.4 Customers (`/customers`)
**Features**:
- Customer list with contact info
- Subscription type and billing cycle
- Credit/Advance balance display
- Vacation manager dialog
- Customer ledger dialog
- Pending approval queue (CustomerAccountApprovals component)

### 9.5 Deliveries (`/deliveries`)
**Features**:
- Date picker for schedule view
- Status filter tabs (All, Pending, Delivered, Missed)
- Quick status update buttons
- Bulk update dialog for pending deliveries
- Vacation indicator badge

### 9.6 Billing (`/billing`)
**Features**:
- Invoice list with filters
- Create invoice dialog
- Record payment dialog
- PDF invoice download (jsPDF)
- Stats: Total Billed, Collected, Pending, Overdue

### 9.7 Bottles (`/bottles`)
**Features**:
- Bottle inventory by type/size
- Customer bottle balances
- Issue/Return/Damaged transactions
- Deposit tracking

### 9.8 Health Records (`/health`)
**Features**:
- Records by type: Vaccination, Treatment, Checkup, Disease
- Due date reminders
- Cost tracking
- Vet name logging

### 9.9 Breeding (`/breeding`)
**Features**:
- Heat detection records
- Artificial insemination tracking
- Pregnancy confirmation
- Expected calving dates
- Breeding calendar view (BreedingCalendar component)
- Alert panel for upcoming events

### 9.10 Employees (`/employees`)
**Features**:
- Employee list with roles
- Attendance marking (auto-present by default)
- Payroll record creation
- Shift assignment
- Tab view: Employees, Attendance, Payroll, Shifts

### 9.11 Feed & Inventory (`/inventory`)
**Features**:
- Feed stock levels
- Consumption logging
- Low stock alerts
- Supplier info

### 9.12 Equipment (`/equipment`)
**Features**:
- Equipment registry
- Maintenance records
- Warranty tracking
- Status management

### 9.13 Expenses (`/expenses`)
**Features**:
- Expense logging by category
- Date range filtering
- Receipt attachment (URL)
- Cattle-linked expenses

### 9.14 Reports (`/reports`)
**Features**:
- Production reports
- Financial summaries
- Customer analytics
- Export to Excel

### 9.15 User Management (`/users`)
**Features**:
- Create staff users
- Assign roles
- Reset PINs
- Activate/Deactivate accounts

### 9.16 Settings (`/settings`)
**Features**:
- Dairy info configuration
- Invoice prefix
- Currency settings

### 9.17 Audit Logs (`/audit-logs`)
**Features**:
- Activity timeline
- Filter by action type
- User identification

### 9.18 Notifications (`/notifications`)
**Features**:
- Template management
- Notification history
- Channel selection (SMS/Email)

### 9.19 Routes (`/routes`)
**Features**:
- Delivery route definition
- Area mapping
- Staff assignment

### 9.20 Price Rules (`/price-rules`)
**Features**:
- Quality-based pricing
- Fat/SNF percentage ranges
- Product-specific rules

---

## 10. CUSTOMER MOBILE APP (DETAILED)

### 10.1 Customer Auth (`/customer/auth`)
- Phone number input
- 6-digit PIN entry (OTP-style slots)
- Registration vs Login toggle
- Pending approval state handling

### 10.2 Customer Dashboard (`/customer/dashboard`)
- Vacation status banner
- Outstanding balance card
- Today's delivery status
- Active subscription count
- Quick action buttons

### 10.3 Subscription (`/customer/subscription`)
- Product list with quantities
- Pause/Resume individual products
- Schedule vacation dates
- Remove products

### 10.4 Products (`/customer/products`)
- Browse available products
- View prices and descriptions
- Add to subscription

### 10.5 Deliveries (`/customer/deliveries`)
- Delivery history
- Status by date
- Filter options

### 10.6 Billing (`/customer/billing`)
- Invoice history
- Payment status
- Balance display

### 10.7 Profile (`/customer/profile`)
- Personal info display
- PIN change dialog
- Logout button
- Support information

### 10.8 Customer Layout
```typescript
// CustomerLayout.tsx
- Sticky header with dairy name and customer greeting
- Bottom navigation bar with 6 items
- Protected route wrapper
- Loading state handler
```

### 10.9 Customer Navbar
```typescript
const navItems = [
  { path: '/customer/dashboard', label: 'Home', icon: Home },
  { path: '/customer/subscription', label: 'Subscription', icon: Package },
  { path: '/customer/products', label: 'Products', icon: ShoppingBag },
  { path: '/customer/deliveries', label: 'Deliveries', icon: Calendar },
  { path: '/customer/billing', label: 'Billing', icon: Receipt },
  { path: '/customer/profile', label: 'Profile', icon: User },
];
```

---

## 11. DASHBOARD COMPONENTS

### 11.1 AdminDashboard
- QuickActionsCard (5 quick action buttons)
- StatCards (4 key metrics)
- ProductionChart (weekly area chart)
- RecentActivityCard
- ProductionInsights
- BreedingAlertsPanel

### 11.2 DeliveryDashboard
- Quick actions (Start Deliveries, Collect Bottles, View Customers)
- Today's stats cards
- Today's delivery schedule list

### 11.3 FarmDashboard
- Quick actions (Record Milk, View Cattle, Check Feed)
- Farm stats cards
- Production chart
- Upcoming health tasks

### 11.4 AccountantDashboard
- Quick actions (Manage Invoices, Record Expense, View Reports)
- Financial stats cards
- Overdue invoices list

### 11.5 VetDashboard
- Quick actions (View Cattle, Add Health Record, Breeding Records)
- Health tasks summary
- Upcoming vaccinations

### 11.6 AuditorDashboard
- Quick actions (View Reports, Review Logs)
- Current month stats
- Month-over-month comparison

---

## 12. REUSABLE COMPONENTS

### 12.1 Common Components (`src/components/common/`)

**PageHeader**
```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; onClick: () => void };
  children?: React.ReactNode;
}
```

**DataTable**
```typescript
interface DataTableProps<T> {
  data: T[];
  columns: { key: string; header: string; render?: (item: T) => React.ReactNode }[];
  loading?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
}
// Features: Search, pagination, loading skeleton, empty state
```

**StatusBadge**
```typescript
// Maps status strings to colored badges
// Statuses: active, inactive, pending, delivered, missed, partial, paid, overdue, etc.
```

**ConfirmDialog**
```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}
```

**ExportButton**
```typescript
// Exports data to Excel using xlsx library
```

**ThemeToggle**
```typescript
// Dark/Light mode toggle with moon/sun icons
// Uses next-themes for persistence
```

### 12.2 UI Components (`src/components/ui/`)
Complete shadcn/ui component library including:
- accordion, alert, alert-dialog, aspect-ratio, avatar
- badge, breadcrumb, button, calendar, card, carousel
- chart, checkbox, collapsible, command, context-menu
- dialog, drawer, dropdown-menu, form, hover-card
- input, input-otp, label, menubar, navigation-menu
- pagination, popover, progress, radio-group, resizable
- scroll-area, select, separator, sheet, sidebar
- skeleton, slider, sonner (toast), switch, table
- tabs, textarea, toast, toaster, toggle, toggle-group, tooltip

---

## 13. CUSTOM HOOKS

### 13.1 useUserRole
```typescript
function useUserRole(): {
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  userName: string | null;
}
// Fetches role from user_roles table
// Listens to auth state changes
```

### 13.2 useCustomerAuth
```typescript
function useCustomerAuth(): {
  user: User | null;
  session: Session | null;
  customerId: string | null;
  customerData: CustomerData | null;
  loading: boolean;
  login: (phone: string, pin: string) => Promise<Result>;
  register: (phone: string, pin: string) => Promise<Result>;
  logout: () => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<Result>;
  refreshCustomerData: () => Promise<void>;
}
// Customer authentication context provider
```

### 13.3 useBreedingAlerts
```typescript
function useBreedingAlerts(
  breedingRecords: BreedingRecord[],
  healthRecords: HealthRecord[],
  cattle: Cattle[]
): {
  alerts: BreedingAlert[];
  criticalCount: number;
  warningCount: number;
  upcomingCount: number;
}
// Calculates alerts for:
// - Expected calving (within 30 days)
// - Dry-off reminders (60 days before calving)
// - Heat cycle predictions (21-day cycles)
// - Pregnancy checks (21 days after AI)
// - Vaccination due dates
```

### 13.4 useAutoDeliveryScheduler
```typescript
function useAutoDeliveryScheduler(): {
  scheduleDeliveriesForDate: (targetDate: string) => Promise<ScheduleResult>;
  scheduleDeliveriesForRange: (startDate: Date, days: number) => Promise<ScheduleResult[]>;
}
// Algorithm:
// 1. Fetch active customers with subscriptions
// 2. Exclude customers on vacation
// 3. Skip existing deliveries
// 4. Batch create pending deliveries
```

### 13.5 useAutoAttendance
```typescript
function useAutoAttendance(): void
// On mount, creates attendance records for all active employees
// Default status: 'present' at 09:00
```

### 13.6 useAutoInvoiceGenerator
```typescript
// Generates invoices based on billing cycle
// Calculates from delivery items
```

### 13.7 useLedgerAutomation
```typescript
// Updates customer ledger on:
// - Delivery completion
// - Invoice creation
// - Payment recording
```

### 13.8 useCattleStatusAutomation
```typescript
// Updates lactation_status based on:
// - Production records (lactating if producing)
// - Breeding records (pregnant if confirmed)
// - Calving events (calving status)
```

### 13.9 useIntegratedAlerts
```typescript
// Combines alerts from all sources
// Categories: cattle, health, delivery, billing, breeding
```

### 13.10 useMilkHistory
```typescript
// Fetches production history for cattle or date range
```

### 13.11 useProductionAnalytics
```typescript
// Calculates:
// - Top/underperforming cattle
// - Production trends
// - Anomaly detection
// - Session distribution
```

### 13.12 useSoundFeedback
```typescript
function useSoundFeedback(): {
  playClick: () => void;
  playSuccess: () => void;
  playError: () => void;
  playHover: () => void;
}
// Web Audio API generated sounds
// Subtle UI feedback
```

### 13.13 useInteractions
```typescript
// Combines useSoundFeedback with confetti effects
```

### 13.14 use-mobile
```typescript
function useMobile(): boolean
// Returns true if viewport < 768px
```

### 13.15 use-toast
```typescript
// Toast notification system (shadcn pattern)
```

---

## 14. UTILITY LIBRARIES

### 14.1 confetti.ts (`src/lib/confetti.ts`)
```typescript
export function fireConfetti(): void // Center burst
export function fireSuccessConfetti(): void // Side cannons with green
export function fireStarConfetti(): void // Star-shaped gold particles
export function fireSideConfetti(): void // Left-right cannons
```

### 14.2 errors.ts (`src/lib/errors.ts`)
```typescript
export function sanitizeError(error: Error, fallback: string): string
// Hides sensitive error details from users
```

### 14.3 export.ts (`src/lib/export.ts`)
```typescript
export function exportToExcel(data: any[], filename: string): void
// Uses xlsx library
```

### 14.4 utils.ts (`src/lib/utils.ts`)
```typescript
export function cn(...classes: ClassValue[]): string
// Tailwind class merger using clsx and tailwind-merge
```

---

## 15. DESIGN SYSTEM

### 15.1 Color Tokens (HSL Format)

**Light Mode Core**:
```css
--background: 48 35% 97%;      /* Warm cream */
--foreground: 150 30% 12%;     /* Dark forest */
--card: 0 0% 100%;             /* Pure white */
--primary: 155 55% 32%;        /* Forest green */
--secondary: 45 45% 92%;       /* Golden cream */
--muted: 145 18% 92%;          /* Sage */
--accent: 162 60% 42%;         /* Emerald */
--destructive: 0 75% 55%;      /* Red */
--border: 150 18% 88%;
--ring: 155 55% 32%;
```

**Dark Mode Core**:
```css
--background: 152 28% 7%;
--foreground: 48 22% 96%;
--card: 152 24% 10%;
--primary: 162 58% 48%;
--secondary: 152 18% 16%;
--muted: 152 18% 16%;
--accent: 162 58% 45%;
```

**Status Colors**:
```css
--success: 145 75% 42%;
--warning: 42 95% 52%;
--info: 205 92% 52%;
--status-active: 145 75% 42%;
--status-pending: 48 95% 52%;
--status-inactive: 220 12% 52%;
```

**Category Colors**:
```css
/* Breeding */
--breeding-heat: 335 85% 58%;
--breeding-insemination: 220 95% 58%;
--breeding-pregnancy: 275 85% 58%;
--breeding-calving: 145 75% 42%;

/* Health */
--health-vaccination: 192 88% 52%;
--health-checkup: 172 78% 40%;
--health-treatment: 0 78% 55%;
```

**Sidebar**:
```css
--sidebar-background: 152 32% 16%;
--sidebar-foreground: 48 25% 94%;
--sidebar-primary: 162 60% 52%;
--sidebar-accent: 152 25% 22%;
```

### 15.2 Gradients
```css
--gradient-primary: linear-gradient(135deg, hsl(155 55% 32%) 0%, hsl(162 60% 42%) 100%);
--gradient-accent: linear-gradient(135deg, hsl(162 60% 42%) 0%, hsl(155 55% 38%) 100%);
--gradient-warm: linear-gradient(135deg, hsl(45 45% 96%) 0%, hsl(48 35% 92%) 100%);
--gradient-hero: linear-gradient(180deg, hsl(152 32% 16%) 0%, hsl(155 40% 24%) 100%);
--gradient-card: linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(48 35% 98%) 100%);
--gradient-shine: linear-gradient(120deg, transparent 30%, hsl(0 0% 100% / 0.4) 50%, transparent 70%);
--gradient-glass: linear-gradient(135deg, hsl(0 0% 100% / 0.9) 0%, hsl(0 0% 100% / 0.6) 100%);
```

### 15.3 Shadows
```css
--shadow-sm: 0 1px 3px 0 hsl(155 30% 20% / 0.06);
--shadow-md: 0 4px 12px -2px hsl(155 30% 20% / 0.1), 0 2px 4px -2px hsl(155 30% 20% / 0.06);
--shadow-lg: 0 12px 28px -6px hsl(155 30% 20% / 0.12), 0 4px 8px -4px hsl(155 30% 20% / 0.08);
--shadow-glow: 0 0 24px hsl(162 60% 42% / 0.35);
--shadow-colored: 0 8px 24px -4px hsl(155 55% 32% / 0.2);
```

### 15.4 Typography
```css
--font-heading: 'Outfit', sans-serif;
--font-body: 'Outfit', system-ui, sans-serif;
--radius: 0.875rem;
```

### 15.5 Tailwind Extensions
```typescript
// tailwind.config.ts
colors: {
  success: { DEFAULT: "hsl(var(--success))", foreground: "hsl(var(--success-foreground))" },
  warning: { DEFAULT: "hsl(var(--warning))", foreground: "hsl(var(--warning-foreground))" },
  info: { DEFAULT: "hsl(var(--info))", foreground: "hsl(var(--info-foreground))" },
  status: { active: "hsl(var(--status-active))", pending: "hsl(var(--status-pending))", inactive: "hsl(var(--status-inactive))" },
  role: { admin, manager, accountant, delivery, farm, vet, auditor },
  breeding: { heat, insemination, pregnancy, calving },
  health: { vaccination, checkup, treatment },
  sidebar: { DEFAULT, foreground, primary, "primary-foreground", accent, "accent-foreground", border, ring },
}
```

---

## 16. ANIMATIONS & MICRO-INTERACTIONS

### 16.1 CSS Animations
```css
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes pulseSoft { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
@keyframes glow { from { box-shadow: 0 0 8px var(--shadow-glow); } to { box-shadow: 0 0 16px var(--shadow-glow); } }
```

### 16.2 Utility Classes
```css
.animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
.animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
.animate-scale-in { animation: scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
.hover-lift { transition: all 0.3s; &:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); } }
.hover-scale { transition: transform 0.3s; &:hover { transform: scale(1.02); } }
.hover-glow { transition: all 0.3s; &:hover { box-shadow: var(--shadow-glow-sm); } }
.shine-effect { position: relative; overflow: hidden; /* Animated shine on hover */ }
.glass { @apply backdrop-blur-xl bg-card/80 border border-border/50; }
```

### 16.3 Sound Effects (Web Audio API)
```typescript
// useSoundFeedback.ts
playClick(): // 800Hz -> 600Hz, 80ms, subtle
playSuccess(): // C5 -> E5 -> G5 chord, 350ms
playError(): // 200Hz -> 100Hz, 150ms, low tone
playHover(): // 1200Hz, 40ms, very subtle
```

### 16.4 Confetti Triggers
- Invoice paid in full → fireSuccessConfetti()
- Delivery completed → fireConfetti()
- New cattle added → fireSideConfetti()
- Calving recorded → fireStarConfetti()

---

## 17. DATA RELATIONSHIPS & FLOWS

### 17.1 Customer Lifecycle
```
Customer Created → Subscription Added → Daily Deliveries Scheduled
→ Deliveries Marked Complete → Invoice Generated → Payment Recorded
→ Ledger Updated → Balance Recalculated
```

### 17.2 Cattle Lifecycle
```
Cattle Registered → Daily Milk Production Logged → Health Records Added
→ Breeding Recorded → Pregnancy Confirmed → Dry-Off Alert
→ Calving Recorded → Lactation Restarted
```

### 17.3 Employee Workflow
```
Employee Created → User Account Linked → Shift Assigned
→ Daily Attendance (Auto-Present) → Month End Payroll Generated
```

### 17.4 Delivery Automation
```
Subscription Active + Not on Vacation + No Existing Delivery
→ Pending Delivery Created → Staff Marks Status
→ Delivery Items Linked → Customer Ledger Updated
```

---

## 18. SECURITY IMPLEMENTATION

### 18.1 Row Level Security (All Tables)
```sql
-- Example: customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
ON customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can modify customers"
ON customers FOR ALL TO authenticated
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'manager']::user_role[]));
```

### 18.2 PIN Security
- Hashed with pgcrypto `crypt(pin, gen_salt('bf'))`
- Never stored in plain text
- Rate limited: 5 attempts → 15-minute lockout

### 18.3 Service Role Key Usage
- Only in Edge Functions
- Never exposed to client
- Used for admin operations (user creation, role updates)

### 18.4 Email Pattern
- Staff: `{phone}@doodhwallah.app`
- Customer: `customer_{phone}@doodhwallah.app`
- Satisfies Supabase auth requirements
- Auto-confirmed (no email verification)

---

## 19. DEPLOYMENT GUIDE

### 19.1 Supabase Setup
1. Create new Supabase project
2. Run all migrations from `supabase/migrations/` in order
3. Deploy edge functions:
   ```bash
   supabase functions deploy bootstrap-admin
   supabase functions deploy customer-auth
   supabase functions deploy create-user
   supabase functions deploy update-user-status
   supabase functions deploy reset-user-pin
   supabase functions deploy change-pin
   supabase functions deploy delete-user
   ```
4. Enable email auth with auto-confirm

### 19.2 Vercel Deployment
1. Push code to GitHub
2. Import to Vercel
3. Set environment variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
   VITE_SUPABASE_PROJECT_ID=your-project-id
   ```
4. Deploy

### 19.3 First Login
1. Navigate to `/auth`
2. Enter phone: `7897716792`, PIN: `101101`
3. Click "Setup Admin Account"
4. Login with same credentials

### 19.4 Free Tier Limits
**Supabase**: 500MB DB, 1GB storage, 500K edge function calls/month
**Vercel**: 100GB bandwidth, unlimited deploys

---

## 20. FILE STRUCTURE

```
├── public/
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── billing/
│   │   │   ├── BulkInvoiceGenerator.tsx
│   │   │   └── InvoicePDFGenerator.tsx
│   │   ├── breeding/
│   │   │   ├── BreedingAlertsPanel.tsx
│   │   │   └── BreedingCalendar.tsx
│   │   ├── common/
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── ExportButton.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── ThemeToggle.tsx
│   │   ├── customer/
│   │   │   ├── CustomerLayout.tsx
│   │   │   └── CustomerNavbar.tsx
│   │   ├── customers/
│   │   │   ├── CustomerAccountApprovals.tsx
│   │   │   ├── CustomerLedger.tsx
│   │   │   └── VacationManager.tsx
│   │   ├── dashboard/
│   │   │   ├── AccountantDashboard.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AlertsCard.tsx
│   │   │   ├── AuditorDashboard.tsx
│   │   │   ├── DeliveryDashboard.tsx
│   │   │   ├── FarmDashboard.tsx
│   │   │   ├── IntegratedAlertsCard.tsx
│   │   │   ├── ProductionChart.tsx
│   │   │   ├── ProductionInsights.tsx
│   │   │   ├── QuickActionsCard.tsx
│   │   │   ├── RecentActivityCard.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── VetDashboard.tsx
│   │   ├── deliveries/
│   │   │   └── BulkDeliveryActions.tsx
│   │   ├── layout/
│   │   │   ├── AppSidebar.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── mobile/
│   │   │   ├── MobileCattleCard.tsx
│   │   │   ├── MobileDeliveryCard.tsx
│   │   │   ├── MobileNavbar.tsx
│   │   │   └── QuickActionFab.tsx
│   │   ├── production/
│   │   │   └── MilkHistoryDialog.tsx
│   │   └── ui/
│   │       └── [50+ shadcn components]
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useAutoAttendance.ts
│   │   ├── useAutoDeliveryScheduler.ts
│   │   ├── useAutoInvoiceGenerator.ts
│   │   ├── useBreedingAlerts.ts
│   │   ├── useCattleStatusAutomation.ts
│   │   ├── useCustomerAuth.tsx
│   │   ├── useIntegratedAlerts.ts
│   │   ├── useInteractions.ts
│   │   ├── useLedgerAutomation.ts
│   │   ├── useMilkHistory.ts
│   │   ├── useProductionAnalytics.ts
│   │   ├── useSoundFeedback.ts
│   │   └── useUserRole.ts
│   ├── integrations/supabase/
│   │   ├── client.ts
│   │   └── types.ts (auto-generated)
│   ├── lib/
│   │   ├── confetti.ts
│   │   ├── errors.ts
│   │   ├── export.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── customer/
│   │   │   ├── CustomerAuth.tsx
│   │   │   ├── CustomerBilling.tsx
│   │   │   ├── CustomerDashboard.tsx
│   │   │   ├── CustomerDeliveries.tsx
│   │   │   ├── CustomerProducts.tsx
│   │   │   ├── CustomerProfile.tsx
│   │   │   └── CustomerSubscription.tsx
│   │   ├── AuditLogs.tsx
│   │   ├── Auth.tsx
│   │   ├── Billing.tsx
│   │   ├── Bottles.tsx
│   │   ├── Breeding.tsx
│   │   ├── Cattle.tsx
│   │   ├── Customers.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Deliveries.tsx
│   │   ├── Employees.tsx
│   │   ├── Equipment.tsx
│   │   ├── Expenses.tsx
│   │   ├── Health.tsx
│   │   ├── Index.tsx
│   │   ├── Inventory.tsx
│   │   ├── NotFound.tsx
│   │   ├── Notifications.tsx
│   │   ├── PriceRules.tsx
│   │   ├── Production.tsx
│   │   ├── Products.tsx
│   │   ├── Reports.tsx
│   │   ├── Routes.tsx
│   │   ├── Settings.tsx
│   │   └── UserManagement.tsx
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/
│   ├── functions/
│   │   ├── bootstrap-admin/index.ts
│   │   ├── change-pin/index.ts
│   │   ├── create-user/index.ts
│   │   ├── customer-auth/index.ts
│   │   ├── delete-user/index.ts
│   │   ├── reset-user-pin/index.ts
│   │   └── update-user-status/index.ts
│   ├── migrations/
│   │   └── [timestamped .sql files]
│   └── config.toml
├── .env.example
├── DEPLOYMENT_GUIDE.md
├── DOODH_WALLAH_COMPLETE_BLUEPRINT.md
├── eslint.config.js
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

---

## 📝 RECREATION CHECKLIST

For any AI recreating this system:

1. [ ] Set up Vite + React + TypeScript project
2. [ ] Install all dependencies (see package.json)
3. [ ] Create Supabase project and run migrations
4. [ ] Deploy edge functions
5. [ ] Configure Tailwind with all custom tokens
6. [ ] Create index.css with complete design system
7. [ ] Build all UI components (or use shadcn/ui)
8. [ ] Implement authentication flows
9. [ ] Create all pages with exact functionality
10. [ ] Build all custom hooks
11. [ ] Set up role-based routing and dashboards
12. [ ] Implement customer mobile app
13. [ ] Add animations and micro-interactions
14. [ ] Configure Vercel deployment
15. [ ] Test complete user flows

---

## 🎯 KEY DIFFERENTIATORS

1. **Dual Portal Architecture**: Staff web app + Customer mobile app sharing same backend
2. **Role-Based Everything**: Navigation, dashboards, and permissions all role-filtered
3. **Phone/PIN Authentication**: Mapped to email pattern for Supabase compatibility
4. **Automated Workflows**: Attendance, deliveries, status updates, ledger calculations
5. **Real-Time Alerts**: Breeding, health, delivery, and billing notifications
6. **Offline-Ready Design**: Customer app designed for Capacitor/mobile deployment
7. **Quality-Based Pricing**: Fat/SNF percentage pricing rules
8. **Bottle Tracking**: Glass/plastic inventory and customer balances
9. **Complete Audit Trail**: Activity logs for all operations
10. **Indian Localization**: ₹ currency, Indian date formats, regional terms

---

*This blueprint represents a complete, production-ready dairy management system. Every feature, component, hook, and design token is documented for faithful recreation.*
