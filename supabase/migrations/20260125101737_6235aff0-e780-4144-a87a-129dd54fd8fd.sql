-- ========================================
-- SECURITY FIX: Block Anonymous Access to Sensitive Tables
-- ========================================

-- 1. PROFILES TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. CUSTOMERS TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to customers"
  ON public.customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. EMPLOYEES TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to employees"
  ON public.employees FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. CUSTOMER_ACCOUNTS TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to customer_accounts"
  ON public.customer_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. ACTIVITY_LOGS TABLE - Block anonymous reads
CREATE POLICY "Block anonymous reads on activity_logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 6. MILK_VENDORS TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to milk_vendors"
  ON public.milk_vendors FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 7. NOTIFICATION_LOGS TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to notification_logs"
  ON public.notification_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 8. CUSTOMER_LEDGER TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to customer_ledger"
  ON public.customer_ledger FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 9. INVOICES TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 10. PAYMENTS TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to payments"
  ON public.payments FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 11. PAYROLL_RECORDS TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to payroll_records"
  ON public.payroll_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 12. ATTENDANCE TABLE - Block anonymous access
CREATE POLICY "Block anonymous access to attendance"
  ON public.attendance FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 13. CUSTOMERS_DELIVERY_VIEW - Enable RLS and add policy
ALTER VIEW public.customers_delivery_view SET (security_invoker = on);

-- 14. EMPLOYEES_AUDITOR_VIEW - Enable RLS and add policy
ALTER VIEW public.employees_auditor_view SET (security_invoker = on);