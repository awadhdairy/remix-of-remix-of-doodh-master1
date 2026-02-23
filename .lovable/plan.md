

# Vendor Payment System -- Integration Issues and Fixes

## Issues Found

### Issue 1: Double Balance Update Creates Race Condition (MEDIUM)

**Location:** `src/components/procurement/VendorPaymentsDialog.tsx` lines 182-194

**Problem:** After inserting a vendor payment, the code does THREE balance updates:
1. **Line 183-187:** Direct `.update({ current_balance: newBalance })` using stale local state (`vendorBalance`)
2. **DB trigger** on `vendor_payments` INSERT automatically fires `recalculate_vendor_balance()` (authoritative)
3. **Line 191:** Explicit RPC call to `recalculate_vendor_balance` (redundant backup)

The direct update at step 1 uses `vendorBalance` from React state, which may be stale if another tab/user modified data. The DB trigger (step 2) then recalculates correctly. But the explicit RPC (step 3) runs AFTER the trigger and produces the same result. The real problem: step 1 may briefly set an incorrect balance before the trigger fixes it, and if there is a timing issue, the stale value could persist.

**Fix:** Remove the direct `.update()` call (lines 183-187) and the explicit RPC call (lines 190-194). The database trigger already handles balance recalculation atomically on INSERT. Just rely on the trigger, then refetch the balance.

---

### Issue 2: No Vendor Payment History Outside the Dialog (MEDIUM -- Missing Integration)

**Location:** Entire `MilkProcurement.tsx` page and `ProcurementAnalytics.tsx`

**Problem:** Vendor payments are ONLY visible inside the `VendorPaymentsDialog` (a modal). There is no:
- "Total Paid" stat card on the Procurement page (only "Pending Payment" exists)
- Payment history tab in the Procurement page
- Payment data in `ProcurementAnalytics.tsx` (analytics only shows procurement quantities/amounts, not payments made)

Users have to open each vendor's payment dialog individually to see payment history. There is no consolidated view across all vendors.

**Fix:** 
- Add a "Total Paid" stat card on the Procurement page that queries `vendor_payments` for the current month
- Add a "Payments" sub-tab or section showing recent payments across all vendors in the Procurement page
- Include payment totals in `ProcurementAnalytics.tsx` summary

---

### Issue 3: Vendor Payments Not Shown in Reports (LOW-MEDIUM)

**Location:** `src/pages/Reports.tsx`

**Problem:** The Reports page shows expenses (which would include auto-logged vendor payment expenses), but it does NOT show a dedicated "Vendor Payments" breakdown. Since vendor payments are auto-logged as expenses under category "feed" with title "Vendor Payment - {name}", they are mixed in with feed purchases and not distinguishable in the Reports page.

**Fix:** This is partially mitigated by the expense auto-logging, but the category "feed" for vendor payments is misleading. Vendor payments are payments to milk vendors, not feed purchases. Consider either:
- Adding a "vendor_payment" expense category
- Or keeping "feed" but adding a filter/tag in reports to distinguish vendor payments from feed purchases

---

### Issue 4: `fetchVendorBalance` Redundant After Payment Save (LOW)

**Location:** `VendorPaymentsDialog.tsx` lines 223-224

**Problem:** After saving a payment, `fetchVendorBalance()` is called to refresh the displayed balance. But because the direct `.update()` at line 183 already modified the balance BEFORE the trigger runs, the fetched value may be the stale direct-update value, not the trigger-recalculated value. This is a timing issue.

**Fix:** After removing the direct update (Issue 1 fix), add a small delay or rely on the trigger having completed before fetching. Alternatively, use the RPC's return value (it returns the new balance) to set state directly.

---

## Priority and Implementation Plan

### Step 1: Fix the double balance update (Issue 1)
- Remove lines 182-194 (direct update + RPC call) from `VendorPaymentsDialog.tsx`
- The DB trigger handles everything
- After insert, just call `fetchVendorBalance()` (already done at line 224) -- the trigger will have run by then since the INSERT completes before `.select().single()` returns

### Step 2: Add "Total Paid" stat and recent payments section (Issue 2)
- In `MilkProcurement.tsx`, add a query to `vendor_payments` for the current month to get total paid amount
- Add a "Total Paid (Month)" stat card alongside existing stats
- Add a "Recent Payments" section/tab showing the last 20 payments across all vendors, with vendor name, amount, date, and payment mode

### Step 3: Include payments in ProcurementAnalytics (Issue 2 continued)
- In `ProcurementAnalytics.tsx`, fetch `vendor_payments` for the selected date range
- Add a "Total Paid" summary stat alongside existing Total Quantity / Total Amount
- Optionally add a payment trend line to the daily chart

### Step 4: Fix expense category for vendor payments (Issue 3)
- Change the expense category from `"feed"` to `"vendor_payment"` in `useExpenseAutomation.ts` `logVendorPaymentExpense`
- Add `"vendor_payment"` to the `categoryLabels` and `categoryColors` in `Expenses.tsx`
- Update `ExpenseAutomationCard.tsx` categorization to account for the new category

---

## Files to Modify

1. **`src/components/procurement/VendorPaymentsDialog.tsx`** -- Remove redundant direct balance update and RPC call
2. **`src/pages/MilkProcurement.tsx`** -- Add "Total Paid" stat card, add recent payments section across all vendors
3. **`src/components/procurement/ProcurementAnalytics.tsx`** -- Include vendor payment totals in analytics
4. **`src/hooks/useExpenseAutomation.ts`** -- Change vendor payment expense category from "feed" to "vendor_payment"
5. **`src/pages/Expenses.tsx`** -- Add "vendor_payment" to category labels and colors
6. **`src/components/dashboard/ExpenseAutomationCard.tsx`** -- Update categorization for new "vendor_payment" category

