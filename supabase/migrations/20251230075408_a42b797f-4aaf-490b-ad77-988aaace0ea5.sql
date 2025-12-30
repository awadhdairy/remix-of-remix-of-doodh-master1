-- Phase 1: Critical Security Fixes

-- 1. Secure auth_attempts table - block all direct access (only via security definer functions)
CREATE POLICY "No direct access to auth_attempts" 
ON public.auth_attempts 
FOR ALL 
USING (false);

-- 2. Fix profiles over-exposure - users see own profile, managers/admins see all
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile or managers can view all" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id 
  OR is_manager_or_admin(auth.uid())
);

-- 3. Fix delivery staff customer access - only customers on their assigned routes
DROP POLICY IF EXISTS "Delivery staff can read customers on their routes" ON public.customers;

CREATE POLICY "Delivery staff can read customers on their routes" 
ON public.customers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'delivery_staff'::user_role) 
  AND route_id IN (
    SELECT id FROM public.routes WHERE assigned_staff = auth.uid()
  )
);

-- 4. Create auditor-safe employees view (without salary)
CREATE OR REPLACE VIEW public.employees_auditor_view AS
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

-- Grant access to the view
GRANT SELECT ON public.employees_auditor_view TO authenticated;

-- 5. Secure activity_logs - prevent user_id spoofing
DROP POLICY IF EXISTS "Authenticated users can insert activity_logs" ON public.activity_logs;

CREATE POLICY "Users can only insert their own activity_logs" 
ON public.activity_logs 
FOR INSERT 
WITH CHECK (
  is_authenticated() 
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- 6. Create public dairy settings view (non-sensitive fields only)
CREATE OR REPLACE VIEW public.dairy_settings_public AS
SELECT 
  id,
  dairy_name,
  logo_url,
  currency,
  invoice_prefix,
  financial_year_start
FROM public.dairy_settings;

-- Grant access to the view
GRANT SELECT ON public.dairy_settings_public TO authenticated;