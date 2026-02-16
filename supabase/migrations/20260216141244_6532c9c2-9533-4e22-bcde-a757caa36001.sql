
CREATE OR REPLACE FUNCTION public.insert_ledger_with_balance(
  _customer_id UUID,
  _transaction_date DATE,
  _transaction_type TEXT,
  _description TEXT,
  _debit_amount NUMERIC DEFAULT 0,
  _credit_amount NUMERIC DEFAULT 0,
  _reference_id UUID DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _prev_balance NUMERIC;
  _new_balance NUMERIC;
BEGIN
  SELECT running_balance INTO _prev_balance
  FROM customer_ledger
  WHERE customer_id = _customer_id
  ORDER BY transaction_date DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  _prev_balance := COALESCE(_prev_balance, 0);
  _new_balance := _prev_balance + COALESCE(_debit_amount, 0) - COALESCE(_credit_amount, 0);

  INSERT INTO customer_ledger (
    customer_id, transaction_date, transaction_type,
    description, debit_amount, credit_amount,
    running_balance, reference_id
  ) VALUES (
    _customer_id, _transaction_date, _transaction_type,
    _description, NULLIF(_debit_amount, 0), NULLIF(_credit_amount, 0),
    _new_balance, _reference_id
  );

  RETURN _new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_ledger_balances(_customer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _running NUMERIC := 0;
  _entry RECORD;
BEGIN
  FOR _entry IN
    SELECT id, debit_amount, credit_amount
    FROM customer_ledger
    WHERE customer_id = _customer_id
    ORDER BY transaction_date ASC, created_at ASC
  LOOP
    _running := _running + COALESCE(_entry.debit_amount, 0) - COALESCE(_entry.credit_amount, 0);
    UPDATE customer_ledger SET running_balance = _running WHERE id = _entry.id;
  END LOOP;
END;
$$;
