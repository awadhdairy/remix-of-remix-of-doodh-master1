-- Force RLS on all tables to ensure no bypass via service role patterns
-- The existing policies are correctly set up, but we need to ensure RLS is enforced

-- Ensure RLS is FORCED on all tables (prevents service role bypass in client-side code)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.employees FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expenses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;

-- These are less sensitive but also enforce RLS
ALTER TABLE public.cattle FORCE ROW LEVEL SECURITY;
ALTER TABLE public.milk_production FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.routes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bottles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bottles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bottle_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cattle_health FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feed_inventory FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feed_consumption FORCE ROW LEVEL SECURITY;
ALTER TABLE public.equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.breeding_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops FORCE ROW LEVEL SECURITY;
ALTER TABLE public.price_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_vacations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.dairy_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shifts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_auth_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_products FORCE ROW LEVEL SECURITY;