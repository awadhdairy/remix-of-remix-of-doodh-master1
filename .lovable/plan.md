
# Phase 1 Implementation Plan: Critical Financial Fixes

## Overview

This plan implements the critical fixes identified in the audit, focusing on **reliability and defensive programming** to ensure the app works correctly regardless of database trigger configuration.

---

## Issues Being Fixed

| Issue | Severity | Description | Solution |
|-------|----------|-------------|----------|
| #1 | Medium | `activeVendors` stat uses stale data | Use fresh vendor data from fetch |
| #5 | Critical | Bulk delivery uses RPC that may not exist | Replace with direct query |
| #2/#3 | Critical | Vendor balance may not update after payment | Add explicit RPC call as backup |

---

## Implementation Details

### Fix 1: Vendor Balance Update Safety (VendorPaymentsDialog.tsx)

**Problem**: After recording a payment, the vendor's `current_balance` may not update if database triggers aren't set up on the external Supabase.

**Solution**: After inserting a payment, explicitly call `recalculate_vendor_balance` RPC to ensure balance is correct. This is safe because:
- If triggers exist, it recalculates to same value (harmless)
- If triggers don't exist, it fixes the balance

**Code Change**:
```typescript
// After successful payment insert (line ~174)
const { data, error } = await supabase
  .from("vendor_payments")
  .insert({...})
  .select()
  .single();

if (!error && data) {
  // Ensure vendor balance is recalculated (backup if triggers missing)
  await supabase.rpc("recalculate_vendor_balance", { 
    p_vendor_id: vendor.id 
  });
  
  // Continue with expense logging...
}
```

**Safety**: Uses `.rpc()` which returns gracefully if function doesn't exist.

---

### Fix 2: Bulk Delivery Vacation Check (BulkDeliveryActions.tsx)

**Problem**: Uses `supabase.rpc("is_customer_on_vacation")` which may not exist in all database setups.

**Solution**: Replace RPC call with direct query to `customer_vacations` table. This is:
- More reliable (works on any Supabase)
- Same logic, just executed differently
- No dependency on custom database functions

**Current Code (Lines 77-83)**:
```typescript
const { data: vacationCheck } = await supabase
  .rpc("is_customer_on_vacation", {
    _customer_id: delivery.customer_id,
    _check_date: delivery.delivery_date,
  });
```

**New Code**:
```typescript
// Direct query - works on any database
const { data: vacationCheck } = await supabase
  .from("customer_vacations")
  .select("id")
  .eq("customer_id", delivery.customer_id)
  .eq("is_active", true)
  .lte("start_date", delivery.delivery_date)
  .gte("end_date", delivery.delivery_date)
  .limit(1)
  .maybeSingle();

// vacationCheck will be an object if on vacation, null if not
if (vacationCheck) {
  skipped++;
} else {
  // Mark as delivered...
}
```

---

### Fix 3: Procurement Stats Race Condition (MilkProcurement.tsx)

**Problem**: The `activeVendors` stat is calculated inside `fetchProcurements()` using the OLD `vendors` state from before the parallel fetch. Both fetches run simultaneously via `Promise.all()`, so `vendors` state isn't updated yet.

**Current Code (Line 250-257)**:
```typescript
setStats({
  todayTotal,
  monthTotal,
  totalPending,
  activeVendors: vendors.filter((v) => v.is_active).length, // STALE!
  avgFat,
  avgRate,
});
```

**Solution**: Refactor to ensure fresh vendor data is used. Two approaches:

**Approach A (Preferred)**: Calculate `activeVendors` in a separate useEffect that watches `vendors` state:
```typescript
// Add new useEffect after vendors is set
useEffect(() => {
  setStats(prev => ({
    ...prev,
    activeVendors: vendors.filter((v) => v.is_active).length
  }));
}, [vendors]);
```

**Approach B**: Fetch vendors first, then use the result directly:
```typescript
const fetchData = async () => {
  setLoading(true);
  const vendorData = await fetchVendorsAndReturn();
  await fetchProcurements(vendorData);
  setLoading(false);
};
```

**Chosen Solution**: Approach A - simpler, cleaner, less code change.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/procurement/VendorPaymentsDialog.tsx` | Add `recalculate_vendor_balance` RPC call after payment insert |
| `src/components/deliveries/BulkDeliveryActions.tsx` | Replace RPC with direct query |
| `src/pages/MilkProcurement.tsx` | Add useEffect to update activeVendors stat |

---

## Testing Verification

After implementation, verify:

1. **Vendor Payments**:
   - Record a payment for a vendor
   - Check that `current_balance` is updated in the vendor list
   - Verify the payment appears in history

2. **Bulk Delivery**:
   - Create a customer vacation schedule for today
   - Run bulk delivery update
   - Verify the customer is skipped (not marked delivered)
   - Verify non-vacation customers are marked delivered

3. **Procurement Stats**:
   - Add/remove vendors
   - Check that "Active Vendors" stat updates correctly
   - No flicker or stale data

---

## Code Safety Guarantees

- No breaking changes to existing functionality
- All changes are additive or replacement (same behavior, different implementation)
- RPC calls use graceful error handling
- Direct queries are standard Supabase operations (well-tested)
- No database schema changes required
