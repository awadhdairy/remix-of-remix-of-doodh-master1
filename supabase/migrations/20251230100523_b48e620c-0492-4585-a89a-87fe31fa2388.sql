-- Fix Activity Logs RLS Policy - Restrict to managers/admins only
DROP POLICY IF EXISTS "Authenticated users can view activity_logs" ON public.activity_logs;

CREATE POLICY "Managers and admins can view activity_logs"
ON public.activity_logs
FOR SELECT
USING (is_manager_or_admin(auth.uid()));

-- Ensure auditors can also read activity logs for audit purposes
CREATE POLICY "Auditors can view activity_logs"
ON public.activity_logs
FOR SELECT
USING (has_role(auth.uid(), 'auditor'::user_role));