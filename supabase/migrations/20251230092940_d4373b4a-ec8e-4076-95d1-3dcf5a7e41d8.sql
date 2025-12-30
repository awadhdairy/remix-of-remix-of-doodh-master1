-- 1. Customer Vacation/Pause Management table
CREATE TABLE public.customer_vacations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE public.customer_vacations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Managers and admins have full access to customer_vacations"
ON public.customer_vacations FOR ALL
USING (is_manager_or_admin(auth.uid()));

CREATE POLICY "Delivery staff can read customer_vacations"
ON public.customer_vacations FOR SELECT
USING (has_role(auth.uid(), 'delivery_staff'::user_role));

CREATE POLICY "Auditors can read customer_vacations"
ON public.customer_vacations FOR SELECT
USING (has_role(auth.uid(), 'auditor'::user_role));

-- 2. Customer Ledger table for tracking all transactions
CREATE TABLE public.customer_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL, -- 'delivery', 'payment', 'adjustment', 'invoice'
  reference_id UUID, -- can link to delivery_id, payment_id, invoice_id
  description TEXT NOT NULL,
  debit_amount NUMERIC DEFAULT 0,
  credit_amount NUMERIC DEFAULT 0,
  running_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Managers and admins have full access to customer_ledger"
ON public.customer_ledger FOR ALL
USING (is_manager_or_admin(auth.uid()));

CREATE POLICY "Accountants can manage customer_ledger"
ON public.customer_ledger FOR ALL
USING (has_role(auth.uid(), 'accountant'::user_role));

CREATE POLICY "Delivery staff can read customer_ledger"
ON public.customer_ledger FOR SELECT
USING (has_role(auth.uid(), 'delivery_staff'::user_role));

CREATE POLICY "Auditors can read customer_ledger"
ON public.customer_ledger FOR SELECT
USING (has_role(auth.uid(), 'auditor'::user_role));

-- Index for faster lookups
CREATE INDEX idx_customer_ledger_customer ON public.customer_ledger(customer_id);
CREATE INDEX idx_customer_ledger_date ON public.customer_ledger(transaction_date);
CREATE INDEX idx_customer_vacations_dates ON public.customer_vacations(start_date, end_date);
CREATE INDEX idx_customer_vacations_customer ON public.customer_vacations(customer_id);

-- Function to check if customer is on vacation for a given date
CREATE OR REPLACE FUNCTION public.is_customer_on_vacation(
  _customer_id UUID,
  _check_date DATE DEFAULT CURRENT_DATE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_vacations
    WHERE customer_id = _customer_id
      AND is_active = true
      AND _check_date BETWEEN start_date AND end_date
  )
$$;