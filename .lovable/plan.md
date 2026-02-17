

# Post-Fix Audit: Remaining Issues and New Bugs

After thoroughly reviewing all financial flows following the recent fixes, here is the complete list of remaining issues, ordered by impact.

---

## Issue 1: QuickAddOnOrderDialog Still Uses Manual Ledger Insert (HIGH -- Regression from Fix 1)

**Location:** `src/components/customers/QuickAddOnOrderDialog.tsx` (lines 192-217)

**Problem:** This file was missed during the atomic ledger migration. It still uses the old manual pattern:

```
const { data: lastEntry } = await supabase
  .from("customer_ledger")
  .select("running_balance")
  ...
const newBalance = previousBalance + totalAmount;
await supabase.from("customer_ledger").insert({
  running_balance: newBalance,
});
```

This is the exact race condition that was fixed everywhere else. Every add-on order placed through the customer detail dialog bypasses the atomic `insert_ledger_with_balance` RPC.

**Fix:** Replace lines 192-217 with a single `supabase.rpc("insert_ledger_with_balance", {...})` call.

---

## Issue 2: Revenue Growth Chart Uses `paid_amount` from Invoices Instead of Payments Table (MEDIUM -- Data Interpretation Error)

**Location:** `src/hooks/useDashboardCharts.ts` (lines 83-97)

**Problem:** The `fetchRevenueGrowth` function (used by the `RevenueGrowthChart` on the main dashboard) calculates "Collected" as:
```
const collected = (data || []).reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
```

This sources from `invoices.paid_amount` rather than the `payments` table. This contradicts the standardization done in Reports.tsx and AccountantDashboard.tsx (which now correctly use the `payments` table). The result:
- General/advance payments are excluded from the "Collected" line
- The chart understates actual collections
- Dashboard chart contradicts the Accountant Dashboard numbers

**Fix:** Fetch from the `payments` table for each month instead of using `invoices.paid_amount`.

---

## Issue 3: SmartInvoiceCreator Ledger Entry Has No `reference_id` (MEDIUM -- Data Integrity Gap)

**Location:** `src/components/billing/SmartInvoiceCreator.tsx` (lines 381-389)

**Problem:** The invoice ledger entry is created WITHOUT a `reference_id` linking it to the invoice:
```
await supabase.rpc("insert_ledger_with_balance", {
  _customer_id: customerId,
  ...
  // _reference_id is missing!
});
```

This means:
- Invoice deletion in Billing.tsx (line 271-274) searches by `reference_id` to delete payment ledger entries, but the invoice's own ledger entry has no `reference_id`
- The deletion falls back to the `ilike` description match (line 260-262), which is fragile
- If the invoice number changes or the description format changes, the ledger entry becomes orphaned

**Fix:** After inserting the invoice, retrieve its ID and pass it as `_reference_id` to the RPC call. This requires changing the insert to use `.select("id").single()` to get the generated ID back.

---

## Issue 4: Reports "Pending" Metric Can Be Negative (LOW-MEDIUM -- Display Logic Error)

**Location:** `src/pages/Reports.tsx` (lines 120-124)

**Problem:** The "Pending" metric is calculated as:
```
{ name: "Pending", value: monthlyRevenue - monthlyCollected }
```

Since `monthlyCollected` now uses the `payments` table (which includes general/advance payments), it can exceed `monthlyRevenue` (which is billed invoices only). This would result in a **negative "Pending" value**, which is misleading.

**Fix:** Use `Math.max(0, monthlyRevenue - monthlyCollected)` to prevent negative display, or clarify the label to "Net Receivable" which can legitimately be negative (meaning advance credit exists).

---

## Issue 5: Billing Page "Collected" Stat Uses Invoice `paid_amount` (LOW -- Inconsistency)

**Location:** `src/pages/Billing.tsx` (line 320)

**Problem:** The Billing page stats card for "Collected" uses:
```
collected: invoices.reduce((sum, i) => sum + Number(i.paid_amount || 0), 0),
```

This is sourced from `invoices.paid_amount` which is capped at `final_amount` (per the overpayment fix). If a customer pays Rs 700 on a Rs 500 invoice, the stat shows Rs 500 collected (capped) while the actual collection was Rs 700. This is technically correct for "invoice collections" but inconsistent with the dashboard and reports which show actual payments.

**Impact:** Low -- this is a Billing-specific view where showing invoice-level collection is reasonable. But the label "Collected" is ambiguous. Consider relabeling to "Invoice Payments" or adding a tooltip.

---

## Summary

| # | Issue | Impact | Effort | Category |
|---|-------|--------|--------|----------|
| 1 | QuickAddOnOrderDialog manual ledger insert (race condition) | High | Low | Bug from previous fix round |
| 2 | Revenue Growth Chart uses wrong data source for "Collected" | Medium | Low | Data interpretation error |
| 3 | SmartInvoiceCreator ledger has no reference_id | Medium | Low | Data integrity gap |
| 4 | Reports "Pending" can go negative | Low-Medium | Trivial | Display logic |
| 5 | Billing "Collected" uses capped paid_amount | Low | Trivial | Label inconsistency |

## What Is Working Correctly

- All payment entry points in Billing.tsx, Customers.tsx, CustomerDetailDialog.tsx use atomic RPC
- useLedgerAutomation.ts uses atomic RPC
- useAutoInvoiceGenerator.ts creates ledger entries for bulk invoices
- Invoice deletion recalculates running balances
- Invoice edit recalculates running balances
- AccountantDashboard uses cash-basis profit (totalPaid - expenses)
- Reports.tsx uses payments table for "Collected"
- Overpayment capping on invoice paid_amount works correctly
- Vendor payables tracking is accurate
- Overdue detection via effective status is sound
- `update_customer_balance_from_ledger` DB trigger properly syncs `customers.credit_balance`

## Recommended Priority

Fix Issue 1 immediately (it is an active race condition bug). Issues 2 and 3 should follow as they affect data accuracy. Issues 4 and 5 are cosmetic/labeling.

