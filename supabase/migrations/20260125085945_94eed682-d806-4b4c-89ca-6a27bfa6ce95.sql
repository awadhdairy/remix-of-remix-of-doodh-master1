-- Create vendor_payments table for tracking payments to milk vendors
CREATE TABLE public.vendor_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.milk_vendors(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add balance column to milk_vendors for quick access
ALTER TABLE public.milk_vendors 
ADD COLUMN IF NOT EXISTS current_balance NUMERIC DEFAULT 0;

-- Create index for faster queries
CREATE INDEX idx_vendor_payments_vendor_id ON public.vendor_payments(vendor_id);
CREATE INDEX idx_vendor_payments_date ON public.vendor_payments(payment_date DESC);

-- Enable RLS
ALTER TABLE public.vendor_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for vendor_payments
CREATE POLICY "Managers and admins have full access to vendor_payments"
  ON public.vendor_payments FOR ALL
  USING (is_manager_or_admin(auth.uid()));

CREATE POLICY "Farm workers can manage vendor_payments"
  ON public.vendor_payments FOR ALL
  USING (has_role(auth.uid(), 'farm_worker'::user_role));

CREATE POLICY "Accountants can manage vendor_payments"
  ON public.vendor_payments FOR ALL
  USING (has_role(auth.uid(), 'accountant'::user_role));

CREATE POLICY "Auditors can read vendor_payments"
  ON public.vendor_payments FOR SELECT
  USING (has_role(auth.uid(), 'auditor'::user_role));

-- Function to recalculate vendor balance
CREATE OR REPLACE FUNCTION public.recalculate_vendor_balance(p_vendor_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total_dues NUMERIC;
  v_total_paid NUMERIC;
  v_balance NUMERIC;
BEGIN
  -- Total amount owed from paid procurement records
  SELECT COALESCE(SUM(total_amount), 0) INTO v_total_dues
  FROM public.milk_procurement
  WHERE vendor_id = p_vendor_id;
  
  -- Total payments made
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.vendor_payments
  WHERE vendor_id = p_vendor_id;
  
  -- Balance = dues - payments (positive means we owe them)
  v_balance := v_total_dues - v_total_paid;
  
  -- Update the vendor's current_balance
  UPDATE public.milk_vendors
  SET current_balance = v_balance
  WHERE id = p_vendor_id;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to update balance after procurement insert/update/delete
CREATE OR REPLACE FUNCTION public.update_vendor_balance_on_procurement()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_vendor_balance(OLD.vendor_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_vendor_balance(NEW.vendor_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_vendor_balance_procurement
AFTER INSERT OR UPDATE OR DELETE ON public.milk_procurement
FOR EACH ROW
EXECUTE FUNCTION public.update_vendor_balance_on_procurement();

-- Trigger to update balance after payment insert/update/delete
CREATE OR REPLACE FUNCTION public.update_vendor_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_vendor_balance(OLD.vendor_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_vendor_balance(NEW.vendor_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_vendor_balance_payment
AFTER INSERT OR UPDATE OR DELETE ON public.vendor_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_vendor_balance_on_payment();