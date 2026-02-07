

# Fix Plan: Race Condition in Milk Procurement Pending Payment

## Issue Identified

The "Pending Payment" stat is showing 0 due to a **race condition** in the code, not because of an empty database.

### Root Cause Analysis

```
Timeline of execution:
1. Component mounts with vendors = [] (empty array)
2. useEffect triggers fetchData()
3. fetchData() calls Promise.all([fetchVendors(), fetchProcurements()])
4. Both functions run IN PARALLEL
5. fetchProcurements() calculates: totalPending = vendors.filter(...) → uses STALE empty array
6. fetchVendors() completes and calls setVendors(data)
7. React batches updates, but totalPending was already calculated as 0
```

The existing fix at lines 174-180 only updates `activeVendors` when vendors change, but does NOT recalculate `totalPending`:

```typescript
// Current code - only fixes activeVendors, NOT totalPending
useEffect(() => {
  setStats(prev => ({
    ...prev,
    activeVendors: vendors.filter((v) => v.is_active).length
  }));
}, [vendors]);
```

---

## Solution: Recalculate totalPending When Vendors Change

### File: `src/pages/MilkProcurement.tsx`

**Change 1**: Update the existing `useEffect` (lines 174-180) to also recalculate `totalPending`:

```typescript
// FIX: Update stats when vendors state changes (fixes race condition)
useEffect(() => {
  if (vendors.length > 0 || !loading) {
    const totalPending = vendors
      .filter(v => v.is_active && Number(v.current_balance) > 0)
      .reduce((sum, v) => sum + Number(v.current_balance), 0);
    
    setStats(prev => ({
      ...prev,
      activeVendors: vendors.filter((v) => v.is_active).length,
      totalPending: totalPending, // FIX: Recalculate pending when vendors update
    }));
  }
}, [vendors, loading]);
```

This ensures that after `fetchVendors()` completes and updates the `vendors` state, the `totalPending` will be recalculated with the actual vendor data.

---

## Additional Verification: Other Fixes Applied Correctly

### Fix 2: Dashboard Pending Amount - VERIFIED ✅
**File:** `src/hooks/useDashboardData.ts`

The code correctly fetches ALL unpaid invoices (not just this month):
```typescript
// Line 78-81: Fetches all unpaid invoices
const unpaidInvoicesPromise = supabase
  .from("invoices")
  .select("final_amount, paid_amount")
  .neq("payment_status", "paid");

// Line 146: Calculates from all unpaid
pendingAmount: unpaidInvoices.reduce((sum, i) => sum + (Number(i.final_amount) - Number(i.paid_amount || 0)), 0),
```

### Fix 3: Accountant Dashboard Vendor Payables - VERIFIED ✅
**File:** `src/components/dashboard/AccountantDashboard.tsx`

The code correctly:
- Fetches vendor balances (lines 86-90)
- Calculates vendor payables (lines 106-107)
- Displays the new stat card (lines 198-204)

### Fix 4: Reports Procurement Tab - VERIFIED ✅
**File:** `src/pages/Reports.tsx`

The code correctly:
- Fetches procurement and vendor data (lines 82-90)
- Calculates procurement stats (lines 150-162)
- Displays the Procurement tab (lines 304-353)

---

## Technical Summary

| Fix | Status | Issue |
|-----|--------|-------|
| Procurement Pending Payment | NEEDS CHANGE | Race condition - vendors state empty during calculation |
| Dashboard Pending Amount | ✅ CORRECT | Properly fetches all unpaid invoices |
| Accountant Vendor Payables | ✅ CORRECT | Properly displays vendor payables |
| Reports Procurement Tab | ✅ CORRECT | Properly shows procurement summary |

---

## Implementation

Only one file needs to be modified:

**`src/pages/MilkProcurement.tsx`** - Lines 174-180

Replace the existing `useEffect` to include `totalPending` recalculation when vendors state updates.

---

## Verification

After the fix, the "Pending Payment" stat will:
1. Show 0 initially (correct for empty database)
2. Show the correct sum of `current_balance` from all active vendors when data exists
3. Update correctly when vendor payments are recorded
4. Not be affected by the date range filter (since it uses vendor balances, not procurement records)

