

# Financial Health Audit: Remaining Issues

After reviewing all financial flows with the recently implemented fixes (atomic ledger via `insert_ledger_with_balance`, ledger recalculation via `recalculate_ledger_balances`, and cash-basis profit), here are the remaining gross-level issues:

---

## Issue 1: CustomerDetailDialog Still Uses Manual Ledger Insert (HIGH IMPACT)

**Location:** `src/components/customers/CustomerDetailDialog.tsx` (lines 295-318)

**Problem:** The payment handler in `CustomerDetailDialog` was NOT updated to use the atomic `insert_ledger_with_balance` RPC. It still does the old "fetch last balance, compute, insert" pattern:

```
const { data: lastLedgerEntry } = await supabase
  .from("customer_ledger")
  .select("running_balance")
  ...
await supabase.from("customer_ledger").insert({
  running_balance: previousBalance - amount,
});
```

This is the exact race condition that was fixed in `Billing.tsx`, `Customers.tsx`, and `SmartInvoiceCreator.tsx` -- but this third payment entry point was missed.

**Fix:** Replace lines 295-318 with a single `supabase.rpc("insert_ledger_with_balance", {...})` call, matching the pattern in the other 3 files.

---

## Issue 2: Invoice Deletion Does NOT Recalculate Running Balances (MEDIUM IMPACT)

**Location:** `src/pages/Billing.tsx` (lines 246-297)

**Problem:** When an invoice is deleted, the code correctly deletes:
1. Invoice ledger entries (by invoice_number match)
2. Payment records
3. Payment ledger entries (by reference_id)
4. The invoice itself

However, after deleting these ledger entries, it does NOT call `recalculate_ledger_balances`. This means all subsequent ledger entries for that customer retain stale `running_balance` values. The `customers.credit_balance` field IS updated by the existing DB trigger (fires on DELETE), but the per-row `running_balance` in the ledger is now wrong.

**Fix:** After deleting ledger entries and invoice, call:
```typescript
await supabase.rpc("recalculate_ledger_balances", {
  _customer_id: deletingInvoice.customer_id,
});
```

---

## Issue 3: `useAutoInvoiceGenerator` Creates Invoices Without Ledger Entries (MEDIUM IMPACT)

**Location:** `src/hooks/useAutoInvoiceGenerator.ts` (lines 294-302)

**Problem:** The `generateMonthlyInvoices` function bulk-inserts invoices but creates zero ledger entries. This means:
- `customers.credit_balance` is NOT updated (the DB trigger fires on ledger changes, not invoice inserts)
- Customer ledger history is incomplete
- Balances are understated

You mentioned you generate invoices one-by-one (via SmartInvoiceCreator, which does create ledger entries), so this may not be actively used. But if anyone triggers auto-generation, it will create orphan invoices with no financial trail.

**Fix:** After bulk insert, loop through generated invoices and call `insert_ledger_with_balance` for each. Or add a prominent warning/disable this path if not intended for use.

---

## Issue 4: Overpayment Silently Accepted Without Capping (LOW-MEDIUM IMPACT)

**Location:** Three places:
- `src/pages/Billing.tsx` (line 172-176)
- `src/pages/Customers.tsx` (line 550-554)
- `src/components/customers/CustomerDetailDialog.tsx` (line 272-276)

**Problem:** When a payment exceeds the invoice's remaining balance (e.g., invoice balance is Rs 500, payment is Rs 700), the code sets `paid_amount = 700` and `status = "paid"`. The excess Rs 200:
- Is recorded in the payments table (correct)
- Is recorded in the ledger as a full Rs 700 credit (correct)
- But `paid_amount` on the invoice now exceeds `final_amount`, which makes the "Balance" column show a negative number in the UI
- No validation prevents this, and no excess is credited to `advance_balance`

**Fix:** Add validation to cap the payment at the remaining balance, or show a warning and auto-credit excess to advance_balance via a separate ledger entry.

---

## Issue 5: Reports Page Uses Billed Revenue, Not Collections (LOW IMPACT)

**Location:** `src/pages/Reports.tsx` (lines 110-117)

**Problem:** The Reports page revenue breakdown fetches `invoices` and computes:
```
monthlyRevenue = sum(final_amount)
monthlyCollected = sum(paid_amount)  // from invoices table
```

This is different from the Accountant Dashboard which correctly uses the `payments` table for collections. Using `sum(paid_amount)` from invoices gives the same number in theory, but it's less accurate because `paid_amount` on invoices only captures invoice-linked payments, while the `payments` table captures ALL payments (including general/advance payments).

**Fix:** Minor -- use `payments` table for "Collected" metric if you want consistency with the dashboard. Current approach is acceptable but slightly understates collections.

---

## Summary

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | CustomerDetailDialog uses manual ledger insert (race condition) | High | Low -- same RPC pattern swap |
| 2 | Invoice deletion skips running_balance recalculation | Medium | Low -- add 1 RPC call |
| 3 | Auto invoice generator skips ledger entries | Medium | Medium -- add loop with RPC calls |
| 4 | Overpayment not capped or redirected to advance | Low-Medium | Low -- add validation |
| 5 | Reports "Collected" uses invoice paid_amount vs payments table | Low | Low -- query change |

## What Is Working Correctly After Previous Fixes
- Atomic ledger inserts in Billing.tsx, Customers.tsx, SmartInvoiceCreator.tsx, useLedgerAutomation.ts
- Ledger recalculation on invoice edit (EditInvoiceDialog)
- Cash-basis net profit in AccountantDashboard
- Vendor payables tracking
- Overdue invoice detection via effective status
- Invoice tax/subtotal/final_amount arithmetic in SmartInvoiceCreator
- `update_customer_balance_from_ledger` DB trigger syncing `customers.credit_balance`

## Recommended Fix Priority
Fix Issues 1 and 2 first (they are active bugs in payment/deletion flows). Issue 3 is preventive. Issues 4 and 5 are polish.

