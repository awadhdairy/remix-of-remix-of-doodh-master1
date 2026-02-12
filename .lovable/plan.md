

# Finance Integrity Audit - Genuine Errors Found

After comprehensively reviewing all finance-related code (Billing, Invoicing, Ledger, Expenses, Payments), here are the **genuine calculation/logic errors** that can cause financial data corruption or misleading financial records.

---

## Issue 1: Invoice Tax Calculation Creates Inconsistent Stored Data (HIGH)

**Location:** `SmartInvoiceCreator.tsx` and `EditInvoiceDialog.tsx`

**The Bug:** Each line item's `amount` is calculated as `base + tax` (line 280: `amount = baseAmount + taxAmount`). Then `subtotal` sums all `amount` fields (already includes tax). But `totalTax` is computed separately. The invoice is stored as:
- `total_amount = subtotal` (already includes tax)
- `tax_amount = totalTax` (computed separately)
- `final_amount = subtotal - discount` (correct charge amount)

**Why it's a problem:**
- The PDF and customer billing view shows: Subtotal (with tax baked in) + Tax (shown again) - Discount = Grand Total
- The displayed Subtotal + Tax - Discount will NOT equal the Grand Total -- the numbers visually don't add up
- A customer or auditor reading the invoice PDF sees contradictory figures
- Reports querying `total_amount` think it's pre-tax when it's actually post-tax

**Fix:** Compute `subtotal` from base amounts only (pre-tax), then derive `grandTotal = subtotal + totalTax - discount`. This makes stored fields arithmetically consistent: `total_amount + tax_amount - discount_amount = final_amount`.

**Files:** `src/components/billing/SmartInvoiceCreator.tsx`, `src/components/billing/EditInvoiceDialog.tsx`

---

## Issue 2: Partial Payment Erases payment_date (MEDIUM)

**Location:** `src/pages/Billing.tsx` line 184

**The Bug:** `payment_date: newStatus === "paid" ? format(new Date(), "yyyy-MM-dd") : null`

When recording a partial payment, this sets `payment_date` to `null`. If a previous partial payment had already set a date (from an earlier full-then-reopened scenario), that date is erased. More importantly, the date of the partial payment itself is never recorded on the invoice record.

**Fix:** Only set `payment_date` when becoming fully paid. Don't overwrite with `null` for partial payments. Change to:
```
payment_date: newStatus === "paid" ? format(new Date(), "yyyy-MM-dd") : undefined
```
Using `undefined` means the field won't be included in the update, preserving any existing value.

**File:** `src/pages/Billing.tsx`

---

## Issue 3: Advance Balance Overwrite Instead of Increment (MEDIUM - Latent)

**Location:** `src/hooks/useLedgerAutomation.ts` line 135

**The Bug:** `advance_balance: supabase.rpc ? amount : amount` -- This sets `advance_balance` to the raw payment amount, completely replacing any existing value. If a customer had a 500 advance and makes another 300 advance payment, their balance becomes 300 instead of 800.

**Current Impact:** This function (`logAdvancePayment`) is not currently called anywhere in the app, so no active damage. However, it's a ticking time bomb if any feature starts using it.

**Fix:** Remove the manual `advance_balance` update entirely. The `credit_balance` field (which is the authoritative balance) is already correctly maintained by the `update_customer_balance_from_ledger` database trigger. The `advance_balance` field should be managed separately if needed, but the broken code should be removed to prevent future misuse.

**File:** `src/hooks/useLedgerAutomation.ts`

---

## Summary of Changes

| File | Issue | Change |
|------|-------|--------|
| `src/components/billing/SmartInvoiceCreator.tsx` | Tax double-representation | Compute `subtotal` as pre-tax sum; `grandTotal = subtotal + totalTax - discount` |
| `src/components/billing/EditInvoiceDialog.tsx` | Same tax issue | Same fix as SmartInvoiceCreator |
| `src/pages/Billing.tsx` | payment_date erasure | Use `undefined` instead of `null` for non-paid status |
| `src/hooks/useLedgerAutomation.ts` | advance_balance overwrite | Remove the broken manual update block |

## What Will NOT Change
- No database schema changes
- No automation/integration modifications
- No Telegram notification changes
- No dashboard or reporting logic changes
- `final_amount` (what the customer actually pays) remains mathematically correct throughout -- these fixes ensure the **breakdown fields** match the total

