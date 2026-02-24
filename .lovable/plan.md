

# Vendor Payment System — Bug Analysis and Fix Plan

## Issues Found

### Bug 1: Expense Auto-Logging Silently Fails Due to Missing Query Invalidation for `recent-activities`

**Not the root cause** — this is a secondary issue. The `recent-activities` query key is never invalidated after a vendor payment is saved (line 200-202 of `VendorPaymentsDialog.tsx`). Even if we add vendor payments to the Recent Activity feed, the card would show stale data until manual page refresh.

**Fix:** Add `queryClient.invalidateQueries({ queryKey: ["recent-activities"] })` inside `invalidateExpenseRelated` or directly in `VendorPaymentsDialog.tsx` after payment success.

---

### Bug 2: Recent Activity Card Does NOT Fetch Vendor Payments or Expenses

**Location:** `src/components/dashboard/RecentActivityCard.tsx`

**Problem:** The `fetchRecentActivities` function queries exactly 4 tables:
- `milk_production` → production activities
- `deliveries` → delivery activities  
- `payments` → customer payment activities
- `cattle_health` → health activities

It does **not** query `vendor_payments` or `expenses`. So vendor payments will never appear in Recent Activity regardless of whether they were recorded correctly.

**Fix:** Add a 5th query block to fetch recent `vendor_payments` with vendor name join, and add a new activity type `"vendor_payment"` with an appropriate icon (Wallet) and color.

---

### Bug 3: Expense Auto-Logging May Fail Silently — No User Feedback on RLS Denial

**Location:** `src/hooks/useExpenseAutomation.ts` line 47-63

**Problem:** The `createExpense` function catches errors and logs them, but returns `false` without throwing. In `VendorPaymentsDialog.tsx` (line 186-196), if `logVendorPaymentExpense` returns `false`, the toast just says "Payment recorded" instead of "Payment recorded & expense logged". But the user gets no explicit warning that the expense was NOT logged. 

This could happen if:
- The user's role doesn't have INSERT permission on `expenses` (only `super_admin`, `manager`, and `accountant` can insert expenses per RLS)
- A `farm_worker` can insert `vendor_payments` (per RLS) but CANNOT insert `expenses` — so the payment is recorded but the expense is silently skipped

**This is the most likely root cause.** If a farm_worker user makes a vendor payment, the payment goes into `vendor_payments` (allowed by RLS) but the auto-expense insert into `expenses` is denied by RLS (farm_worker has no policy on `expenses`).

**Fix:** 
1. Add explicit warning feedback in `VendorPaymentsDialog.tsx` when expense logging fails
2. Optionally add an RLS policy allowing farm_workers to INSERT expenses (or handle this via a database trigger on `vendor_payments` INSERT that auto-creates the expense using SECURITY DEFINER, bypassing RLS)

---

### Bug 4: `invalidateExpenseRelated` Does Not Invalidate `recent-activities`

**Location:** `src/lib/query-invalidation.ts`

**Problem:** When expenses or vendor payments change, `invalidateExpenseRelated` invalidates `dashboard-data`, `expense-breakdown-chart`, and `month-comparison-chart` — but NOT `recent-activities`. The Recent Activity card uses `staleTime: 30000` (30 seconds), so even after recording a payment, the dashboard won't show it until the stale time expires or the user navigates away and back.

**Fix:** Add `recent-activities` to the invalidation lists for both `invalidateExpenseRelated` and `invalidateProcurementRelated`.

---

## Implementation Plan

### Step 1: Add Vendor Payments to Recent Activity Card
**File:** `src/components/dashboard/RecentActivityCard.tsx`
- Add a 5th query block fetching from `vendor_payments` with `vendor:vendor_id(name)` join
- Add new type `"vendor_payment"` to the ActivityItem type union  
- Add Wallet icon and emerald color for vendor_payment type
- Map results to activity items with description like "₹5,000 to Vendor Name via Cash"

### Step 2: Fix Query Invalidation
**File:** `src/lib/query-invalidation.ts`
- Add `queryClient.invalidateQueries({ queryKey: ["recent-activities"] })` to both `invalidateExpenseRelated` and `invalidateProcurementRelated`

### Step 3: Add Explicit Warning When Expense Logging Fails  
**File:** `src/components/procurement/VendorPaymentsDialog.tsx`
- When `expenseLogged` is `false` and `data` exists (payment was saved but expense wasn't), show a more explicit warning toast mentioning the expense was not auto-tracked (likely a permissions issue)

### Step 4: Add Expenses to Recent Activity Card
**File:** `src/components/dashboard/RecentActivityCard.tsx`
- Add a 6th query block fetching recent `expenses` 
- Add new type `"expense"` with Wallet icon and destructive color
- This ensures manually added expenses AND auto-logged expenses both appear in activity feed

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/RecentActivityCard.tsx` | Add vendor_payments + expenses queries, new types, icons, colors |
| `src/lib/query-invalidation.ts` | Add `recent-activities` to invalidation functions |
| `src/components/procurement/VendorPaymentsDialog.tsx` | Better feedback when expense logging fails |

## No New Bugs Risk
- All changes are additive (new queries, new types, new invalidation keys)
- No existing functionality is removed or altered
- RLS policies are read-only queries in RecentActivityCard (SELECT only), which are already permitted for managers/admins

