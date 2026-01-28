-- Fix Security Definer Views by setting them to SECURITY INVOKER
-- This ensures RLS policies are respected based on the querying user

-- Drop and recreate views with SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_safe CASCADE;
DROP VIEW IF EXISTS public.customer_accounts_safe CASCADE;
DROP VIEW IF EXISTS public.customers_delivery_view CASCADE;
DROP VIEW IF EXISTS public.employees_auditor_view CASCADE;
DROP VIEW IF EXISTS public.dairy_settings_public CASCADE;

-- Recreate with explicit SECURITY INVOKER
CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
SELECT id, full_name, phone, role, is_active, created_at, updated_at
FROM public.profiles;

CREATE VIEW public.customer_accounts_safe 
WITH (security_invoker = true) AS
SELECT id, customer_id, phone, is_approved, approval_status, last_login, created_at
FROM public.customer_accounts;

CREATE VIEW public.customers_delivery_view 
WITH (security_invoker = true) AS
SELECT c.id, c.name, c.phone, c.address, c.area, c.route_id, c.subscription_type
FROM public.customers c
WHERE c.is_active = true;

CREATE VIEW public.employees_auditor_view 
WITH (security_invoker = true) AS
SELECT id, user_id, name, phone, role, joining_date, is_active, created_at
FROM public.employees;

CREATE VIEW public.dairy_settings_public 
WITH (security_invoker = true) AS
SELECT dairy_name, address, phone, email, logo_url, currency, invoice_prefix
FROM public.dairy_settings
LIMIT 1;