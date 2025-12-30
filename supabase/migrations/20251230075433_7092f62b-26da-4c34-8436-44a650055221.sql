-- Fix views to use SECURITY INVOKER (default should be invoker, but being explicit)
DROP VIEW IF EXISTS public.employees_auditor_view;
DROP VIEW IF EXISTS public.dairy_settings_public;

-- Recreate employees auditor view with explicit SECURITY INVOKER
CREATE VIEW public.employees_auditor_view 
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  role,
  phone,
  address,
  joining_date,
  is_active,
  user_id,
  created_at,
  updated_at
FROM public.employees;

-- Recreate dairy settings public view with explicit SECURITY INVOKER
CREATE VIEW public.dairy_settings_public 
WITH (security_invoker = true) AS
SELECT 
  id,
  dairy_name,
  logo_url,
  currency,
  invoice_prefix,
  financial_year_start
FROM public.dairy_settings;

-- Grant access to the views
GRANT SELECT ON public.employees_auditor_view TO authenticated;
GRANT SELECT ON public.dairy_settings_public TO authenticated;