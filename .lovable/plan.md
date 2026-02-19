
# Round 5 Comprehensive Post-Fix Audit

After reading every financial file from scratch — all dashboards, chart hooks, billing pages, customer ledger, invoice creation/edit/deletion paths, reports, and payment flows — here is the definitive list of remaining issues after the Round 4 fixes.

---

## What Is Now Fully Correct After All Previous Rounds

- All ledger write points use atomic `insert_ledger_with_balance` RPC
- All invoice creation (Smart, Bulk, Auto) captures `reference_id` for reliable deletion
- QuickAddOnOrderDialog no longer creates ledger entries (invoice-centric model enforced)
- Invoice deletion: deletes by `reference_id` + description fallback, then recalculates
- EditInvoiceDialog: finds ledger by `reference_id` first, description fallback for legacy
- Revenue Growth Chart uses payments table with `Math.max(0,...)` guard
- Reports.tsx uses payments table with `Math.max(0,...)` guard
- Dashboard pending uses `customers.credit_balance` (ledger-accurate)
- AccountantDashboard pending uses `customers.credit_balance` (ledger-accurate)
- Dashboard & chart revenue uses `billing_period_start` not `created_at`
- CustomerLedger shows lifetime balance banner separate from period-filtered totals
- `update_customer_balance_from_ledger` DB trigger syncs `customers.credit_balance`

---

## Remaining Issues Found

---

### Issue 1: `Reports.tsx` Invoice Query Still Uses `created_at` Not `billing_period_start` (HIGH — Date Boundary Error Survives)

**Location:** `src/pages/Reports.tsx` (line 73-74)

**Problem:** This is the exact same date boundary error that was fixed in `useDashboardData.ts`, `useDashboardCharts.ts`, and `AccountantDashboard.tsx` in Round 4 — but `Reports.tsx` was MISSED.

```typescript
supabase
  .from("invoices")
  .select("created_at, final_amount, paid_amount")
  .gte("created_at", format(startOfMonth(new Date()), "yyyy-MM-dd")),
```

This means "Monthly Revenue" on the Reports page uses invoice creation date, not the billing period it covers. An invoice created March 2 for February's deliveries would appear in March's revenue on this page, while showing in February's revenue on the Dashboard and AccountantDashboard.

This creates a **3-way inconsistency**: Dashboard shows Feb revenue correctly (uses `billing_period_start`), AccountantDashboard shows Feb revenue correctly, but Reports page shows the same invoice in March revenue.

**Fix:** Change `created_at` to `billing_period_start`:
```typescript
supabase
  .from("invoices")
  .select("billing_period_start, final_amount, paid_amount")
  .gte("billing_period_start", format(startOfMonth(new Date()), "yyyy-MM-dd")),
```
Also remove `paid_amount` from the select since Reports.tsx already uses the `payments` table (fetched separately) for collected amounts — `paid_amount` is fetched but never used after the fix.

---

### Issue 2: `Reports.tsx` `totalDue` Uses Raw `credit_balance` Sum — Can Be Negative (MEDIUM — Misleading Customer Stats)

**Location:** `src/pages/Reports.tsx` (line 153)

**Problem:**
```typescript
totalDue: customers.reduce((sum, c) => sum + Number(c.credit_balance), 0),
```

`credit_balance` can be negative (when a customer has overpaid / has advance credit, `debit < credit` means `credit_balance < 0`). Summing all credit balances without a `Math.max(0,...)` guard means this total can:
- Show ₹5,000 as the "Total Due" when the real receivable is ₹8,000 (3,000 in advance credits netting against debts of other customers)
- This misleads management into thinking less is owed than actually is from defaulting customers

**Fix:** Apply `Math.max(0, ...)` guard:
```typescript
totalDue: customers.reduce((sum, c) => sum + Math.max(0, Number(c.credit_balance)), 0),
```

Note: `totalAdvance` on line 154 has the opposite problem — it sums `advance_balance` which is a separate legacy field. This field is not the same as the ledger credit. The correct advance balance is `-credit_balance` when `credit_balance < 0`. But `advance_balance` is a redundant/legacy column. This needs investigation.

---

### Issue 3: `Customers.tsx` `totalDue` and `totalAdvance` Are Computed on ALL Customers Including Inactive (MEDIUM — Metric Scope Error)

**Location:** `src/pages/Customers.tsx` (line 633-634)

**Problem:**
```typescript
const totalDue = customers.reduce((sum, c) => sum + Number(c.credit_balance), 0);
const totalAdvance = customers.reduce((sum, c) => sum + Number(c.advance_balance), 0);
```

The `customers` state includes ALL customers (active + inactive) fetched on line 147:
```typescript
supabase.from("customers").select("*, routes(name, area)").order("name")
```
— no `is_active` filter. So the `totalDue` and `totalAdvance` stat cards at the bottom of the Customers page include deactivated customers' balances.

Compare this with `useDashboardData.ts` and `AccountantDashboard.tsx` which correctly filter by `.eq("is_active", true)`.

Additionally, `totalDue` on this page does not apply a `Math.max(0,...)` guard either (same as Issue 2), so advance credits of some customers reduce the displayed "total due" figure.

**Fix:** Filter `customers` to active ones for the totals:
```typescript
const totalDue = customers.filter(c => c.is_active).reduce((sum, c) => sum + Math.max(0, Number(c.credit_balance)), 0);
const totalAdvance = customers.filter(c => c.is_active).reduce((sum, c) => sum + Math.max(0, Number(c.advance_balance)), 0);
```

---

### Issue 4: `Billing.tsx` Invoice Fetch Uses `created_at` for Date Filter (MEDIUM — Filter Inconsistency)

**Location:** `src/pages/Billing.tsx` (lines 131-132)

**Problem:**
```typescript
if (startDate) {
  invoiceQuery = invoiceQuery.gte("created_at", startDate);
}
```

The Billing page's date range filter (90 days, 30 days, etc.) filters invoices by `created_at`. This means when a user selects "Last 30 days", they see invoices created in the last 30 days — but NOT invoices created earlier that cover billing periods within the last 30 days.

For example: An invoice created 35 days ago (billing period covering last month) would NOT show up in the "Last 30 days" view. This is counterintuitive for a billing view where users typically want to see invoices by their billing period, not creation date.

The stat cards (Total Billed, Invoice Payments, Outstanding, Overdue) are all computed from the `invoices` state which is already filtered by `created_at`, making the stats date-filter dependent and potentially misleading.

**Fix:** Change the date filter to use `billing_period_start`:
```typescript
if (startDate) {
  invoiceQuery = invoiceQuery.gte("billing_period_start", startDate);
}
```

---

### Issue 5: `AccountantDashboard.tsx` Overdue Invoice List Shows `final_amount - paid_amount` Which Can Show ₹0 for Overpaid Invoices (LOW — Display Logic Gap)

**Location:** `src/components/dashboard/AccountantDashboard.tsx` (line 136)

**Problem:**
```typescript
final_amount: Number(inv.final_amount) - Number(inv.paid_amount || 0), // Show remaining balance
```

Since `paid_amount` is capped at `final_amount` by the overpayment fix, this correctly shows ₹0 for an overpaid invoice. However, an overpaid invoice could still appear in the overdue list because the filter is:
```typescript
.neq("payment_status", "paid")
.lt("due_date", todayStr)
```

If a customer paid ₹700 on a ₹500 invoice, the `paid_amount` is capped at ₹500, `payment_status` becomes `"paid"` — so this would NOT appear in the list. That part is correct.

BUT if a customer paid ₹200 on a ₹500 invoice (partial), `payment_status` = `"partial"` and the invoice correctly shows a ₹300 remaining balance. This case is handled correctly.

However, the overdue list query fetches at most `limit(5)` overdue invoices. The displayed "X overdue invoices" count on the "Pending Payments" stat card is just `overdue.length` which is capped at 5. If there are 12 overdue invoices, the badge says "5 overdue invoices" not "12 overdue invoices".

**Fix:** Run a separate COUNT query for the total overdue count rather than deriving it from the limited list:
```typescript
// For count: don't use the limited list
const { count: totalOverdueCount } = await supabase
  .from("invoices")
  .select("id", { count: "exact", head: true })
  .neq("payment_status", "paid")
  .lt("due_date", todayStr);
```

---

### Issue 6: `CustomerDetailDialog.tsx` "Amount Due" Shows Raw `credit_balance` Without Negative Guard (LOW — Negative Amount Display Risk)

**Location:** `src/components/customers/CustomerDetailDialog.tsx` (line 522)

**Problem:**
```typescript
<p className="font-bold text-xl text-red-700 dark:text-red-400">
  ₹{Number(customer.credit_balance).toLocaleString()}
</p>
```

If `credit_balance` is negative (customer has overpaid — advance credit exists), this will show a **negative number in red** like "₹-300" styled as "Amount Due". This is confusing and factually wrong — a negative `credit_balance` means no amount is due, the customer is in credit.

**Fix:** Show "Amount Due" only when `credit_balance > 0`. When `credit_balance <= 0`, show a "Credit Balance" label with the absolute value in green:
```tsx
{customer.credit_balance > 0 ? (
  <p className="font-bold text-xl text-red-700">₹{Number(customer.credit_balance).toLocaleString()}</p>
) : (
  <p className="font-bold text-xl text-green-700">Credit: ₹{Math.abs(Number(customer.credit_balance)).toLocaleString()}</p>
)}
```

---

## Summary Table

| # | File | Issue | Impact | Fix Effort |
|---|------|-------|--------|-----------|
| 1 | `Reports.tsx` line 73 | Invoice revenue filtered by `created_at` not `billing_period_start` — missed from Round 4 fix | High | 2-line change |
| 2 | `Reports.tsx` line 153 | `totalDue` sums raw `credit_balance` without `Math.max(0,...)` guard — negative advances reduce "Total Due" display | Medium | 1-line change |
| 3 | `Customers.tsx` lines 633-634 | `totalDue`/`totalAdvance` includes inactive customers + no `Math.max(0,...)` guard | Medium | 2-line change |
| 4 | `Billing.tsx` lines 131-132 | Invoice date filter uses `created_at` not `billing_period_start` — wrong invoices shown in date range | Medium | 1-line change |
| 5 | `AccountantDashboard.tsx` | Overdue count capped at 5 (limited fetch) — stat badge shows wrong count if >5 overdue | Low | Add count query |
| 6 | `CustomerDetailDialog.tsx` line 522 | Negative `credit_balance` shown as negative "Amount Due" in red — confusing and wrong | Low | Conditional display |

---

## Files to Modify

1. `src/pages/Reports.tsx` — Fix `created_at` → `billing_period_start` (Issue 1) and add `Math.max(0,...)` guard to `totalDue` (Issue 2)
2. `src/pages/Customers.tsx` — Filter active-only + add guards for `totalDue`/`totalAdvance` (Issue 3)
3. `src/pages/Billing.tsx` — Fix date filter to use `billing_period_start` (Issue 4)
4. `src/components/dashboard/AccountantDashboard.tsx` — Add separate COUNT query for true overdue count (Issue 5)
5. `src/components/customers/CustomerDetailDialog.tsx` — Conditional display for negative `credit_balance` (Issue 6)

---

## What This Round Closes

After these 5 issues are fixed, the financial system will be fully consistent across all modules:
- All revenue metrics will use `billing_period_start` as attribution date (all 4 locations: Dashboard, Charts, AccountantDashboard, Reports)
- All "pending/due" metrics will use `Math.max(0, credit_balance)` guards (all locations)
- All customer scope filters will correctly limit to active customers only
- The overdue count badge will reflect the true database count, not the display-limited count
- Customer detail views will correctly display credit vs. due states without showing negative money amounts
