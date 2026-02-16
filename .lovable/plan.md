

# Fix: Financial Calculation Issues (3 Targeted Fixes)

## Context Confirmed

- **Tax**: Already handled correctly in SmartInvoiceCreator (the only invoice generator you use). No changes needed.
- **Bulk Invoice Generator**: You confirmed you generate invoices one-by-one. No changes needed there.
- **DB Trigger Reality**: The `calculate_ledger_running_balance` trigger does **NOT exist** on the external database. Only `update_customer_balance_from_ledger` exists, which recalculates `customers.credit_balance` from ledger totals on INSERT/UPDATE/DELETE. The `running_balance` field on each ledger row is managed **entirely by application code**.

---

## Fix 1: Race Condition in Running Balance (Issue 3)

### Problem
Four places compute `running_balance` with a "fetch last, add, insert" pattern:
- `SmartInvoiceCreator.tsx` (line 382-402)
- `Billing.tsx` (line 197-218)
- `Customers.tsx` (line 577-603)
- `useLedgerAutomation.ts` (line 42-60)

If two operations run simultaneously (e.g., two payments recorded at the same time), both read the same "last balance" and compute incorrect values. Since there's no DB trigger to fix this, the `running_balance` drifts permanently.

### Solution
Create a **database function** `insert_ledger_with_balance` that atomically:
1. Locks the customer's latest ledger row (`SELECT ... FOR UPDATE`)
2. Reads the current `running_balance`
3. Computes the new balance
4. Inserts the new row

Then update the 4 application-level locations to call this function via `supabase.rpc()` instead of doing fetch-then-insert.

### Database Migration
```sql
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
  -- Lock the most recent ledger row for this customer to prevent races
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
```

### Code Changes

**File: `src/pages/Billing.tsx` (lines 196-218)**

Replace the "fetch last balance, compute, insert" block with:
```typescript
await supabase.rpc("insert_ledger_with_balance", {
  _customer_id: selectedInvoice.customer_id,
  _transaction_date: format(new Date(), "yyyy-MM-dd"),
  _transaction_type: "payment",
  _description: `Payment for ${selectedInvoice.invoice_number}`,
  _debit_amount: 0,
  _credit_amount: amount,
  _reference_id: selectedInvoice.id,
});
```

**File: `src/pages/Customers.tsx` (lines 577-603)**

Same pattern -- replace the fetch+insert with the `rpc` call.

**File: `src/components/billing/SmartInvoiceCreator.tsx` (lines 381-403)**

Replace with:
```typescript
await supabase.rpc("insert_ledger_with_balance", {
  _customer_id: customerId,
  _transaction_date: new Date().toISOString().split("T")[0],
  _transaction_type: "invoice",
  _description: `Invoice ${invoiceNumber} (${format(new Date(periodStart), "dd MMM")} - ${format(new Date(periodEnd), "dd MMM")})`,
  _debit_amount: grandTotal,
  _credit_amount: 0,
});
```

**File: `src/hooks/useLedgerAutomation.ts` (lines 42-60)**

Update `createLedgerEntry` to use `rpc("insert_ledger_with_balance")` instead of manual fetch + insert.

---

## Fix 2: Invoice Edit Does NOT Update Running Balance (Issue 4)

### Problem
When an invoice amount changes in `EditInvoiceDialog.tsx` (line 346-362), the code updates `debit_amount` on the ledger entry but does NOT recalculate `running_balance` on that entry or any subsequent entries. This means every entry after the edited one has a stale `running_balance`.

### Solution
Create a database function `recalculate_ledger_balances` that replays all ledger entries for a customer and fixes every `running_balance` in sequence. Call it after the ledger update in `EditInvoiceDialog`.

### Database Migration
```sql
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
```

### Code Change

**File: `src/components/billing/EditInvoiceDialog.tsx` (after line 361)**

After the existing `update({ debit_amount: grandTotal })`, add:
```typescript
// Recalculate all running balances for this customer
await supabase.rpc("recalculate_ledger_balances", {
  _customer_id: invoice.customer_id,
});
```

This ensures that after any edit, every subsequent ledger row has a correct running balance. The `update_customer_balance_from_ledger` trigger will also fire on the UPDATE, keeping `customers.credit_balance` in sync.

---

## Fix 3: Net Profit Uses Billed Revenue Instead of Collected Revenue (Issue 5)

### Problem
In `AccountantDashboard.tsx` (line 118):
```typescript
netProfit: monthlyRevenue - monthlyExpenses
```
Where `monthlyRevenue` = sum of `final_amount` of all invoices created this month. This is **billed revenue** (accrual basis). An invoice could be ₹50,000 but ₹0 collected -- profit would show ₹50,000 which is misleading.

### Solution
Show **two profit metrics** for complete financial visibility:
1. **Cash Profit** = `totalPaid - monthlyExpenses` (actual money in minus money out)
2. **Billed Revenue** stays as a stat card subtitle for reference

### Code Change

**File: `src/components/dashboard/AccountantDashboard.tsx`**

Line 118 -- change:
```typescript
netProfit: monthlyRevenue - monthlyExpenses,
```
To:
```typescript
netProfit: totalPaid - monthlyExpenses,
```

Line 175 -- update the "Monthly Revenue" stat card subtitle from `"Total invoiced this month"` to `"Total billed this month"`.

Line 212-216 -- update the Net Profit card subtitle from `"Revenue - Expenses"` to `"Collections - Expenses"`.

Add `monthlyRevenue` display in the Net Profit card as secondary info: `"Billed: ₹XX,XXX"` so the user can see both figures.

---

## Summary

| Fix | What Changes | Risk |
|-----|-------------|------|
| 1. Race condition | New DB function + 4 files use `rpc()` instead of fetch+insert | Zero -- same logic, atomic execution |
| 2. Edit balance cascade | New DB function + 1 line added in EditInvoiceDialog | Zero -- recalculates from source data |
| 3. Net profit formula | 3-line change in AccountantDashboard | Zero -- display-only change |

## What Will NOT Change
- SmartInvoiceCreator tax calculation (already correct)
- BulkInvoiceGenerator (user doesn't use it)
- useAutoInvoiceGenerator (not impacted by these fixes)
- Delivery automation
- Vendor payables tracking
- Customer portal
- Any RLS policies or table schemas
- Telegram notifications
- The `update_customer_balance_from_ledger` trigger (continues working as-is since it reads total debits/credits, not running_balance)

## Cross-Check: Data Integrity After Fixes

1. `running_balance` on each ledger row: Fixed by atomic DB function (Fix 1) + recalculation on edit (Fix 2)
2. `customers.credit_balance`: Automatically updated by existing `update_customer_balance_from_ledger` trigger on every ledger INSERT/UPDATE/DELETE -- no change needed
3. Invoice `paid_amount` / `payment_status`: Not touched by these fixes -- existing logic is correct
4. `payments` table: Not touched -- existing logic is correct
5. Overdue detection: Not touched -- `getEffectivePaymentStatus` is already correct

