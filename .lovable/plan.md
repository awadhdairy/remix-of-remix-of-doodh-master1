
# Round 6 Comprehensive Audit — Fresh Full-Codebase Analysis

After reading every relevant file from scratch — all dashboards, hooks, billing, customers, reports, ledger, invoice creation/edit/deletion, auto-delivery, expense automation, and the edge function — here is the definitive list of remaining issues and new problems introduced by the previous rounds.

---

## Confirmed Status: What Is Now Fully Correct

Before listing issues, the following are definitively correct:

- All 6 payment entry points use `insert_ledger_with_balance` RPC (atomic, no race conditions)
- BulkInvoiceGenerator uses atomic RPC with `reference_id`
- SmartInvoiceCreator uses atomic RPC with `reference_id`
- useAutoInvoiceGenerator uses atomic RPC with `reference_id`
- QuickAddOnOrderDialog does NOT create ledger entries (invoice-centric model enforced — comment confirms intent)
- Invoice deletion: deletes by `reference_id` + description fallback, then recalculates
- EditInvoiceDialog: finds ledger by `reference_id` first, then description fallback
- Revenue Growth Chart: `billing_period_start`, `payments` table, `Math.max(0,...)` guard — all correct
- `useDashboardData.ts`: `billing_period_start`, `credit_balance` for pending — all correct
- `AccountantDashboard.tsx`: `billing_period_start`, `credit_balance` for pending, separate COUNT for overdue — all correct
- `Reports.tsx`: `billing_period_start`, `payments` table, `Math.max(0,...)` guards, active-only filter — all correct
- `Customers.tsx`: active-only filter, `Math.max(0,...)` guards — all correct
- `Billing.tsx`: `billing_period_start` filter — correct
- `CustomerLedger.tsx`: Lifetime balance banner from `customers.credit_balance`, separate from period totals — correct
- `CustomerDetailDialog.tsx`: Conditional display (red "Amount Due" vs green "Credit Balance") — correct
- `update_customer_balance_from_ledger` DB trigger syncs `customers.credit_balance`

---

## Remaining / New Issues Found

---

### Issue 1: `auto-deliver-daily` Edge Function Creates Ledger Entries — CONFIRMED FALSE (No Ledger Calls)

**Status: CLEAR — No action needed.**

The entire `auto-deliver-daily/index.ts` was read. The `markAsDelivered` function only calls:
- `supabase.from("delivery_items").insert(items)` — delivery items table
- `supabase.from("deliveries").update(...)` — status change

No ledger entries are created anywhere in the edge function. The invoice-centric model is respected. Auto-delivery does NOT cause double-debit.

---

### Issue 2: `advance_balance` Field Is a Redundant Unsynced Column (MEDIUM — Data Integrity Gap)

**Location:** `src/pages/Customers.tsx` (lines 635, 751-756), `src/components/customers/CustomerDetailDialog.tsx` (lines 541-551)

**Problem:** The database has TWO separate balance fields:
- `customers.credit_balance` — kept perfectly accurate by the `update_customer_balance_from_ledger` DB trigger, used for all financial calculations
- `customers.advance_balance` — a legacy/redundant field that is NEVER updated by any trigger or application code in the current codebase

The `totalAdvance` stat card on `Customers.tsx` sums `advance_balance`, which is never automatically updated. This means the "Total Advance" card always shows ₹0 (or whatever stale value was manually last set), making it entirely misleading.

`CustomerDetailDialog.tsx` also shows a green "Advance Balance" card at line 541 displaying `customer.advance_balance`. This is the same stale field.

The actual advance credit for a customer is correctly captured in `customers.credit_balance` when it is negative (debit < credit, meaning the customer has overpaid/pre-paid). But `advance_balance` is never set from this source.

**Fix:**
- In `Customers.tsx` line 635: Change `totalAdvance` to sum negative `credit_balance` values (customers in credit):
```typescript
const totalAdvance = customers.filter(c => c.is_active).reduce((sum, c) => sum + Math.max(0, -Number(c.credit_balance)), 0);
```
- In `CustomerDetailDialog.tsx` lines 541-551: Replace the "Advance Balance" card entirely. Since `credit_balance` is the authoritative balance, and when `credit_balance < 0` it already shows a green "Credit Balance" card in the first financial card slot (lines 516-540), the separate "Advance Balance" card with the stale field is redundant and confusing. Hide or remove this card.
- In `Customers.tsx` table column (line 751-756): The "Advance" column renders `item.advance_balance`. This should either be removed or replaced with the advance component of `credit_balance` (i.e., `Math.max(0, -item.credit_balance)`).

---

### Issue 3: `BulkInvoiceGenerator` Duplicate Detection Is Too Strict — Misses Re-Invoicing Need (MEDIUM — Logic Flaw)

**Location:** `src/components/billing/BulkInvoiceGenerator.tsx` (lines 109-122)

**Problem:** The existing invoice check uses exact period matching:
```typescript
supabase.from("invoices")
  .select("customer_id")
  .eq("billing_period_start", startDate)
  .eq("billing_period_end", endDate);
```

This means: if a customer's invoice was generated for a slightly different period (e.g., Feb 1 - Feb 28 vs Feb 1 - Mar 2 due to a user error), they will not be flagged as "already invoiced" and could receive a duplicate invoice. More practically, if the user adjusts the date range by even one day to fix a typo, all customers become eligible again.

The inverse problem is also true: if the same `startDate`/`endDate` was already used but the invoice was deleted, the customer should become eligible again. This is handled correctly (deletion removes the invoice from DB).

**Current Impact:** Moderate — can result in double-invoicing if the billing period dates are entered slightly differently on two separate sessions.

**Fix:** Add a warning when a customer has ANY existing invoice whose `billing_period_start` overlaps with the selected date range (not just exact match), and flag them as "Possible Duplicate" rather than blocking them entirely, so the user can make an informed decision.

---

### Issue 4: `Billing.tsx` "Invoice Payments" Stat Is Scope-Filtered But Labeled as Absolute (LOW-MEDIUM — Semantic Mismatch)

**Location:** `src/pages/Billing.tsx` (lines 325-331)

**Problem:**
```typescript
const stats = {
  total: invoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
  collected: invoices.reduce((sum, i) => sum + Number(i.paid_amount || 0), 0),
  outstanding: calculateOutstandingBalance(invoices),
  overdue: calculateOverdueBalance(invoices),
```

All four stats are computed from the `invoices` state, which is already filtered by `billing_period_start` (the date range selector). So when a user selects "Last 30 days", the stats only reflect invoices from that period.

This is mostly correct behavior, but:

1. The "Outstanding" stat (`calculateOutstandingBalance`) includes ALL unpaid invoice balances within the filtered period — but a customer might have an older overdue invoice from OUTSIDE the selected range that is not shown in the stats. The user might wrongly conclude that ₹5,000 is the total outstanding across all customers, when the real total is ₹15,000 (including older invoices not in the date filter).
2. The "Overdue" stat similarly only shows overdue invoices within the selected date range.

**Impact:** When the date filter is applied, the stat cards show period-scoped financials without any label indicating they are filtered. A user looking at "Last 30 days" sees ₹5,000 overdue but the real figure is higher.

**Fix:** Add a subtitle or badge to each stat card that says "In selected period" to set user expectations. Alternatively, add a global outstanding/overdue summary at the top that always shows all-time figures, and the per-period stats below.

---

### Issue 5: `CustomerDetailDialog.tsx` Invoice List Fetches Using `created_at` Sort, Not `billing_period_start` (LOW — Inconsistency)

**Location:** `src/components/customers/CustomerDetailDialog.tsx` (lines 178-183)

**Problem:**
```typescript
supabase.from("invoices")
  .select("*")
  .eq("customer_id", customer.id)
  .order("created_at", { ascending: false })
  .limit(30),
```

The invoice tab inside the Customer Detail Dialog orders invoices by `created_at`. For a billing system where invoices are generated in batches at month-end, `created_at` is a reasonable proxy for order. However, it's inconsistent with the rest of the system where `billing_period_start` is the canonical date.

**Impact:** Low. If a user generates invoices out of order (manually creating a December invoice in January), it will appear at the top of the list even though it covers an older period.

**Fix:** Change `order("created_at", ...)` to `order("billing_period_start", ...)` in the CustomerDetailDialog invoice fetch.

---

### Issue 6: `Reports.tsx` "Net Profit" Uses Collected Revenue, Not Billed Revenue — May Be Incorrect Label (LOW — Interpretation Risk)

**Location:** `src/pages/Reports.tsx` (line 242)

**Problem:**
```typescript
<p className="text-2xl font-bold text-primary">
  ₹{((revenueData[1]?.value || 0) - totalExpenses).toLocaleString()}
</p>
```

`revenueData[1]` is "Collected" (from the `payments` table), so "Net Profit" = Collected - Expenses.

This is the correct cash-basis accounting approach (matching `AccountantDashboard.tsx` which also uses `totalPaid - monthlyExpenses`). However, the label "Net Profit" without context could confuse users who expect profit = Revenue - Expenses (accrual basis).

The `AccountantDashboard.tsx` correctly labels this as "Net Profit (This Month)" with a subtitle "Collections - Expenses" and "Billed: ₹X" below. The `Reports.tsx` page has no such subtitle explaining the basis.

**Fix (Minor):** Add a tooltip or subtitle `"Cash basis: Collections - Expenses"` below the Net Profit card in Reports.tsx.

---

### Issue 7: `shouldDeliverToday` in Edge Function Has a Broken Schedule Parser — Regex Mismatch (MEDIUM — Silent Auto-Delivery Failure)

**Location:** `supabase/functions/auto-deliver-daily/index.ts` (lines 245-253)

**Problem:** The `shouldDeliverToday` function parses the customer's delivery schedule from their `notes` field using:
```typescript
const scheduleMatch = customer.notes.match(/Schedule:\s*({[^}]+})/);
```

The regex `{[^}]+}` matches only up to the FIRST closing `}`. But the schedule stored by the UI is a nested JSON object like:
```json
{"delivery_days":{"mon":true,"tue":true},"auto_deliver":true,"product_schedules":{"uuid":{"frequency":"daily","delivery_days":{}}}}
```

This nested JSON has multiple `}` characters, so `[^}]+` will only match the innermost `{...}` segment — NOT the full schedule object. The `JSON.parse` will fail silently (caught by `try/catch`), and the function falls back to `customer.subscription_type || "daily"`.

The consequence is: ALL custom per-product delivery schedules and per-customer `delivery_days` settings stored in notes are **silently ignored** by the auto-delivery edge function. All customers default to "daily" delivery regardless of their schedule configuration.

**Fix:** Replace the regex with a greedy parser that correctly handles nested JSON, or use a different parsing approach:
```typescript
const scheduleIdx = customer.notes.indexOf("Schedule:");
if (scheduleIdx !== -1) {
  try {
    const jsonStr = customer.notes.substring(scheduleIdx + "Schedule:".length).trim();
    schedule = JSON.parse(jsonStr);
  } catch {}
}
```

This correctly parses the entire remaining string after "Schedule:" as JSON, handling nested objects.

---

### Issue 8: `Expenses.tsx` "Monthly Expenses" Stat Double-Counts If Date Range > 30 Days (LOW — Stat Calculation Error)

**Location:** `src/pages/Expenses.tsx` (lines 187-192)

**Problem:**
```typescript
const monthlyExpenses = expenses.filter(e => {
  const date = new Date(e.expense_date);
  return date >= startOfMonth(new Date()) && date <= endOfMonth(new Date());
});
const totalThisMonth = monthlyExpenses.reduce(...);
```

The `expenses` state is already filtered by `dateRange` (default: last 30 days). The `monthlyExpenses` variable then applies a secondary in-memory filter for the current calendar month on top. This creates a confusing result: the stat card "This Month" always shows the current calendar month total — even if the date range selector is set to "Last 90 days" or "All time", the stat card only shows the current month (correctly, from within the full filtered list).

However, there is a subtle issue: when the date range is set to "Last 7 days", the `expenses` state only contains the last 7 days. The "This Month" stat card will then only show a partial month total (last 7 days worth of expenses), which is misleading.

**Fix:** Fetch the "This Month" total separately from the date-filtered list, or make the stat card clearly state what period it covers based on the selected date range.

---

## Summary Table

| # | File | Issue | Impact | Category |
|---|------|-------|--------|----------|
| 1 | `auto-deliver-daily/index.ts` | Edge function does NOT create ledger entries — CLEAR | None | Verified Clean |
| 2 | `Customers.tsx`, `CustomerDetailDialog.tsx` | `advance_balance` field is unsynced/stale — shows ₹0 always; actual advance is in `credit_balance < 0` | Medium | Stale data display |
| 3 | `BulkInvoiceGenerator.tsx` | Duplicate detection uses exact period match — even 1-day date typo allows double-invoicing | Medium | Logic flaw |
| 4 | `Billing.tsx` | Stat cards scoped to date filter but not labeled as such — user may think outstanding is total-lifetime | Low-Medium | Misleading display |
| 5 | `CustomerDetailDialog.tsx` | Invoice list ordered by `created_at` not `billing_period_start` | Low | Inconsistency |
| 6 | `Reports.tsx` | "Net Profit" has no basis label — could be confused as accrual profit | Low | Interpretation risk |
| 7 | `auto-deliver-daily/index.ts` | `shouldDeliverToday` regex `{[^}]+}` fails to parse nested JSON — all custom delivery schedules silently ignored | Medium | Silent operational failure |
| 8 | `Expenses.tsx` | "This Month" stat card uses secondary filter on already-date-filtered list — shows partial month when date range is narrow | Low | Stat calculation |

---

## Priority Ranking

**Fix Immediately (before going live):**

1. **Issue 7** — The edge function's schedule parsing silently fails for ALL customers with custom schedules. Every customer defaults to "daily" delivery, ignoring weekly/alternate/custom configurations. This is a silent operational bug that will cause over-delivery for non-daily customers.

2. **Issue 2** — `advance_balance` column is stale/unreliable and being actively displayed in three places. The "Total Advance" stat card, the "Advance Balance" financial card in CustomerDetailDialog, and the "Advance" column in the customer table all show stale data. Replace with computed value from `credit_balance`.

**Fix When Convenient (polish):**

3. **Issue 3** — BulkInvoiceGenerator duplicate detection
4. **Issue 4** — Billing.tsx stat card period labels
5. **Issue 5** — CustomerDetailDialog invoice sort
6. **Issue 6** — Reports.tsx net profit label
7. **Issue 8** — Expenses.tsx month stat calculation

---

## Files to Modify

1. `supabase/functions/auto-deliver-daily/index.ts` — Fix nested JSON parser for schedule extraction (Issue 7)
2. `src/pages/Customers.tsx` — Fix `totalAdvance` to use `-credit_balance` guard (Issue 2), fix Advance column (Issue 2)
3. `src/components/customers/CustomerDetailDialog.tsx` — Remove stale `advance_balance` card, fix invoice sort (Issues 2, 5)
4. `src/pages/Billing.tsx` — Add period-scope labels to stat cards (Issue 4)
5. `src/pages/Reports.tsx` — Add basis label to Net Profit card (Issue 6)
6. `src/components/billing/BulkInvoiceGenerator.tsx` — Improve overlap-based duplicate detection (Issue 3)
7. `src/pages/Expenses.tsx` — Fix monthly stat independence from date filter (Issue 8)
