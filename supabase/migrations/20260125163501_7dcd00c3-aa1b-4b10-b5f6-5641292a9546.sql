-- =====================================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- =====================================================

-- 1. Create the missing auth trigger (fixes orphaned users)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Create safe views that exclude sensitive columns

-- Safe profiles view (excludes pin_hash)
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = on) AS
SELECT 
  id, 
  full_name, 
  phone, 
  role, 
  is_active, 
  avatar_url,
  created_at, 
  updated_at
FROM public.profiles;

-- Safe customer accounts view (excludes pin_hash)
CREATE OR REPLACE VIEW public.customer_accounts_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  customer_id,
  phone,
  user_id,
  is_approved,
  approval_status,
  approved_at,
  approved_by,
  last_login,
  created_at,
  updated_at
FROM public.customer_accounts;

-- 3. Harden RLS policies with proper role-based access

-- Drop existing overly permissive policies and replace with stricter ones

-- EMPLOYEES table - restrict salary visibility
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Block anonymous access to employees" ON public.employees;

CREATE POLICY "Role-based employee access" ON public.employees
FOR SELECT TO authenticated
USING (
  -- Managers/admins can see all
  public.is_manager_or_admin(auth.uid())
  -- Accountants can see all for payroll purposes
  OR public.has_role(auth.uid(), 'accountant'::user_role)
  -- Auditors can see all
  OR public.has_role(auth.uid(), 'auditor'::user_role)
  -- Everyone else can see non-salary fields via limited access
  OR (user_id = auth.uid())
);

-- PAYROLL_RECORDS table - restrict to authorized roles only
DROP POLICY IF EXISTS "Authenticated users can read payroll records" ON public.payroll_records;
DROP POLICY IF EXISTS "Block anonymous access to payroll_records" ON public.payroll_records;

CREATE POLICY "Payroll access for authorized roles" ON public.payroll_records
FOR SELECT TO authenticated
USING (
  -- Managers/admins can see all
  public.is_manager_or_admin(auth.uid())
  -- Accountants can see all
  OR public.has_role(auth.uid(), 'accountant'::user_role)
  -- Auditors can see all
  OR public.has_role(auth.uid(), 'auditor'::user_role)
  -- Employees can see their own records
  OR EXISTS (
    SELECT 1 FROM public.employees e 
    WHERE e.id = payroll_records.employee_id 
    AND e.user_id = auth.uid()
  )
);

-- ATTENDANCE table - restrict appropriately  
DROP POLICY IF EXISTS "Authenticated users can read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Block anonymous access to attendance" ON public.attendance;

CREATE POLICY "Attendance access for authorized roles" ON public.attendance
FOR SELECT TO authenticated
USING (
  -- Managers/admins can see all
  public.is_manager_or_admin(auth.uid())
  -- Accountants can see for payroll calculation
  OR public.has_role(auth.uid(), 'accountant'::user_role)
  -- Auditors can see all
  OR public.has_role(auth.uid(), 'auditor'::user_role)
  -- Employees can see their own attendance
  OR EXISTS (
    SELECT 1 FROM public.employees e 
    WHERE e.id = attendance.employee_id 
    AND e.user_id = auth.uid()
  )
);

-- NOTIFICATION_LOGS - restrict to managers only
DROP POLICY IF EXISTS "Authenticated users can read notification logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Block anonymous access to notification_logs" ON public.notification_logs;

CREATE POLICY "Notification logs for managers" ON public.notification_logs
FOR SELECT TO authenticated
USING (
  public.is_manager_or_admin(auth.uid())
  OR public.has_role(auth.uid(), 'auditor'::user_role)
);

-- Ensure all write policies are properly role-restricted
DROP POLICY IF EXISTS "Authenticated users can insert attendance" ON public.attendance;
CREATE POLICY "Attendance insert for authorized roles" ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (
  public.is_manager_or_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::user_role)
);

DROP POLICY IF EXISTS "Authenticated users can update attendance" ON public.attendance;
CREATE POLICY "Attendance update for authorized roles" ON public.attendance
FOR UPDATE TO authenticated
USING (
  public.is_manager_or_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::user_role)
);

DROP POLICY IF EXISTS "Authenticated users can insert payroll records" ON public.payroll_records;
CREATE POLICY "Payroll insert for authorized roles" ON public.payroll_records
FOR INSERT TO authenticated
WITH CHECK (
  public.is_manager_or_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::user_role)
);

DROP POLICY IF EXISTS "Authenticated users can update payroll records" ON public.payroll_records;
CREATE POLICY "Payroll update for authorized roles" ON public.payroll_records
FOR UPDATE TO authenticated
USING (
  public.is_manager_or_admin(auth.uid())
  OR public.has_role(auth.uid(), 'accountant'::user_role)
);

-- NOTIFICATION_LOGS write policies
DROP POLICY IF EXISTS "Authenticated users can insert notification logs" ON public.notification_logs;
CREATE POLICY "Notification logs insert for managers" ON public.notification_logs
FOR INSERT TO authenticated
WITH CHECK (
  public.is_manager_or_admin(auth.uid())
);

-- Update employees write policies
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON public.employees;
CREATE POLICY "Employee insert for managers" ON public.employees
FOR INSERT TO authenticated
WITH CHECK (public.is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can update employees" ON public.employees;
CREATE POLICY "Employee update for managers" ON public.employees
FOR UPDATE TO authenticated
USING (public.is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can delete employees" ON public.employees;
CREATE POLICY "Employee delete for managers" ON public.employees
FOR DELETE TO authenticated
USING (public.is_manager_or_admin(auth.uid()));