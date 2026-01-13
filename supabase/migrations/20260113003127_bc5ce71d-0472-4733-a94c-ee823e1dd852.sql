-- Security Improvement: Restrict delivery staff access to minimal customer data

-- Create a view with only delivery-relevant customer fields
CREATE OR REPLACE VIEW public.customers_delivery_view AS
SELECT 
  c.id,
  c.name,
  c.address,
  c.area,
  c.route_id,
  c.is_active
FROM public.customers c;

-- Enable RLS on the view
ALTER VIEW public.customers_delivery_view SET (security_invoker = true);

-- Remove delivery staff's direct access to full customer data
DROP POLICY IF EXISTS "Delivery staff can read customers on their routes" ON public.customers;

-- Add back a more restrictive policy for delivery staff using the main table
-- They can only access customer data through the limited view or via specific joined queries

-- Remove delivery staff read access to customer_ledger (they don't need full financial history)
DROP POLICY IF EXISTS "Delivery staff can read customer_ledger" ON public.customer_ledger;

-- Allow admins to monitor auth_attempts for security auditing
DROP POLICY IF EXISTS "No direct access to auth_attempts" ON public.auth_attempts;
CREATE POLICY "Admins can read auth_attempts for security monitoring"
  ON public.auth_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::user_role));

-- Block all other access to auth_attempts
CREATE POLICY "Block all non-admin access to auth_attempts"
  ON public.auth_attempts FOR ALL
  USING (false);

-- Allow admins to monitor customer_auth_attempts for security auditing
DROP POLICY IF EXISTS "No direct access to customer_auth_attempts" ON public.customer_auth_attempts;
CREATE POLICY "Admins can read customer_auth_attempts for security monitoring"
  ON public.customer_auth_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::user_role));

-- Block all other access to customer_auth_attempts
CREATE POLICY "Block all non-admin access to customer_auth_attempts"
  ON public.customer_auth_attempts FOR ALL
  USING (false);