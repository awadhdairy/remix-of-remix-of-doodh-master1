
# Fix: Vendor Payment Auto-Expense + Finance Data Sync

## Root Causes Found

### Root Cause 1: VendorPaymentsDialog has no query invalidation
The `VendorPaymentsDialog` component calls `logVendorPaymentExpense` but never invalidates any query cache. It doesn't import or use `useQueryClient`, so even when the expense IS successfully created, the Expenses page and Dashboard remain stale until manual refresh.

### Root Cause 2: Expense creation errors are silent
`useExpenseAutomation.createExpense()` catches errors via `logger.error` and returns `false`, but the calling code in `VendorPaymentsDialog` does not check the return value. The toast always says "expense logged" regardless of success/failure.

### Root Cause 3: Employees.tsx salary expense missing dashboard invalidation
When salary is paid and expense auto-logged, it invalidates `["expenses"]` but does NOT call `invalidateExpenseRelated()` -- so the dashboard expense charts stay stale.

## Fixes

### Fix 1: Add query invalidation to VendorPaymentsDialog
- Import `useQueryClient` and `invalidateExpenseRelated` + `invalidateProcurementRelated`
- After successful payment + expense logging, invalidate `["expenses"]`, expense-related, and procurement-related queries
- Change toast message based on actual expense creation result

**File: `src/components/procurement/VendorPaymentsDialog.tsx`**
- Add imports for `useQueryClient`, `invalidateExpenseRelated`, `invalidateProcurementRelated`
- Initialize `queryClient` via hook
- After `logVendorPaymentExpense` call, check return value and invalidate queries
- Show accurate toast (distinguish between "payment recorded + expense logged" vs "payment recorded, expense failed")

### Fix 2: Add dashboard invalidation to Employees.tsx salary payment
- Import `invalidateExpenseRelated` from query-invalidation
- Add `invalidateExpenseRelated(queryClient)` after salary expense logging (line ~265)

**File: `src/pages/Employees.tsx`**

### Fix 3: Better error visibility in useExpenseAutomation
- Add a `toast` parameter (optional) to `createExpense` so callers can opt-in to visible error feedback
- No -- simpler approach: just ensure the return value (`boolean`) is checked by callers. Already returns `false` on failure.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/procurement/VendorPaymentsDialog.tsx` | Add `useQueryClient`, invalidate expenses + dashboard after payment; check expense result for accurate toast |
| `src/pages/Employees.tsx` | Add `invalidateExpenseRelated` call after salary expense |

## Safety
- No logic changes to `useExpenseAutomation` itself
- No database changes
- No automation/integration affected
- Only adding cache invalidation calls and improving toast accuracy
