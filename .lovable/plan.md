
# Fix Customer Portal Loading Issues

## Problem Summary

The Customer Portal shows empty cards and "Not logged in" errors because:

1. **Customer ID not persisted after login**: The login response includes `customer_id`, but it's not being saved to the auth context properly
2. **User metadata not being read correctly**: The `useCustomerAuth` hook relies on `user_metadata.customer_id` which may not exist
3. **RLS policies blocking data access**: Without a valid `customerId`, data queries fail or return empty

---

## Root Causes Identified

| Issue | Location | Root Cause |
|-------|----------|------------|
| Empty dashboard | `CustomerDashboard.tsx` | `customerId` is null, so `fetchDashboardData()` returns early |
| Products not showing | `CustomerProducts.tsx` | `customerId` is null, `fetchData()` returns early |
| PIN change fails | `useCustomerAuth.tsx:158` | `customerId` is null, returns "Not logged in" |
| Subscription empty | `CustomerSubscription.tsx` | `customerId` is null |

**Core Issue**: After login, `customer_id` from the API response is passed to `useCustomerAuth.login()` but the hook's `setCustomerId()` is only called when the session has `user_metadata.is_customer`. The session set via `setSession()` doesn't automatically include the updated metadata.

---

## Solution

### Fix 1: Update useCustomerAuth Hook

Modify the `login` function to:
1. Store `customer_id` from the API response directly using `setCustomerId()`
2. Fetch `customerData` immediately after login
3. Not rely solely on `onAuthStateChange` for customer data

**Changes to `src/hooks/useCustomerAuth.tsx`:**

```typescript
// In login function, after setSession, add:
if (data.customer_id) {
  setCustomerId(data.customer_id);
  // Immediately fetch customer data
  fetchCustomerData(data.customer_id);
}
```

### Fix 2: Persist customerId in localStorage

To survive page refreshes, store `customerId` in localStorage and restore it on mount:

```typescript
// On login success:
localStorage.setItem('customer_id', data.customer_id);
setCustomerId(data.customer_id);

// On mount/getSession:
const storedCustomerId = localStorage.getItem('customer_id');
if (storedCustomerId) {
  setCustomerId(storedCustomerId);
  fetchCustomerData(storedCustomerId);
}

// On logout:
localStorage.removeItem('customer_id');
```

### Fix 3: Update the Edge Function to Include customer_id in User Metadata

Ensure the auth user creation/update includes `customer_id` in metadata so the JWT token contains it:

**In `customer-auth/index.ts`:**

When creating or updating auth user, ensure metadata includes:
```typescript
user_metadata: {
  phone,
  customer_id: account.customer_id,
  is_customer: true
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useCustomerAuth.tsx` | Store customerId from login response, persist in localStorage, restore on mount |
| `supabase/functions/customer-auth/index.ts` | Ensure user metadata always has customer_id on login |

---

## Technical Implementation Details

### useCustomerAuth.tsx Changes

1. **Add localStorage persistence** for `customerId`
2. **Set customerId directly** from login response (not just from metadata)
3. **Restore customerId on mount** from localStorage
4. **Clear customerId on logout** from localStorage

### Edge Function Changes

1. **After successful login**, update the auth user's metadata to include `customer_id`:

```typescript
// Before returning success, ensure metadata is up to date
await supabaseAdmin.auth.admin.updateUserById(session.user.id, {
  user_metadata: {
    ...session.user.user_metadata,
    customer_id: account.customer_id,
    is_customer: true,
    phone
  }
});
```

---

## Expected Behavior After Fix

1. **Login**: Customer logs in → `customer_id` stored in context AND localStorage
2. **Dashboard**: `customerId` available → data fetches work → cards display data
3. **Products**: Products load from database (RLS allows authenticated users)
4. **Subscription**: Customer's subscribed products load correctly
5. **PIN Change**: `customerId` available → PIN change works
6. **Page Refresh**: `customerId` restored from localStorage → session persists

---

## Testing Checklist

- [ ] Customer can login with phone + PIN
- [ ] Dashboard shows balance, delivery stats, subscriptions
- [ ] Products page shows available products with pricing
- [ ] Subscription page shows customer's subscribed products
- [ ] Customer can add/remove products from subscription
- [ ] Customer can change PIN successfully
- [ ] Session persists after page refresh
- [ ] Logout clears session completely
