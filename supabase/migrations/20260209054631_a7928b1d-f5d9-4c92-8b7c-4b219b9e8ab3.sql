-- Issue 1.3: Fix RLS Policy USING (true) on auth_sessions
-- Drop existing broken policies that allow ANY user to see/delete ALL sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON auth_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON auth_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON auth_sessions;

-- Create proper policies that restrict access to own sessions only
CREATE POLICY "Users can view their own sessions"
ON auth_sessions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
ON auth_sessions FOR DELETE
USING (user_id = auth.uid());

-- Super admin can view all sessions for monitoring purposes
CREATE POLICY "Admins can view all sessions"
ON auth_sessions FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'::user_role));

-- Issue 5.3: Customer Credit Balance Auto-Update Trigger
-- Create function to recalculate customer credit balance from ledger
CREATE OR REPLACE FUNCTION public.update_customer_balance_from_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_debit NUMERIC;
  _total_credit NUMERIC;
  _balance NUMERIC;
  _target_customer_id UUID;
BEGIN
  -- Get the customer_id from either NEW or OLD record
  _target_customer_id := COALESCE(NEW.customer_id, OLD.customer_id);
  
  -- Calculate totals from ledger
  SELECT 
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO _total_debit, _total_credit
  FROM customer_ledger
  WHERE customer_id = _target_customer_id;
  
  -- Balance = debit (charges) - credit (payments)
  -- Positive = customer owes money, Negative = customer has credit
  _balance := _total_debit - _total_credit;
  
  -- Update customer credit_balance
  UPDATE customers
  SET credit_balance = _balance,
      updated_at = NOW()
  WHERE id = _target_customer_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on customer_ledger for auto-balance sync
DROP TRIGGER IF EXISTS trg_update_customer_balance ON customer_ledger;
CREATE TRIGGER trg_update_customer_balance
AFTER INSERT OR UPDATE OR DELETE ON customer_ledger
FOR EACH ROW
EXECUTE FUNCTION update_customer_balance_from_ledger();

-- Issue 1.3 (addition): Create the missing hash_pin_for_customer function
-- This function is called by customer-auth edge function but was missing
CREATE OR REPLACE FUNCTION public.hash_pin_for_customer(_pin TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN crypt(_pin, gen_salt('bf'));
END;
$$;