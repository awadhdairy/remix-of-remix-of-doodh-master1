
# Complete Migration to External Supabase - Zero Lovable Cloud Dependency

## Current State Analysis

After comprehensive code review, I found that:

### Already Migrated (75 files)
All database operations correctly use `externalSupabase` from `@/lib/external-supabase`:
- All pages (Customers, Billing, Deliveries, etc.)
- All hooks (useAutoInvoiceGenerator, useDashboardData, etc.)
- All components

### Problem Areas (6 files using `supabase.functions.invoke`)
These files call edge functions using `supabase.functions.invoke()`, which routes to **whichever Supabase the client is connected to**. In Lovable Editor, this goes to Lovable Cloud. On Vercel, it would go to external Supabase.

| File | Functions Called | Status |
|------|-----------------|--------|
| `src/pages/Settings.tsx` | change-pin | Needs fix |
| `src/pages/UserManagement.tsx` | create-user, update-user-status, reset-user-pin, delete-user | Needs fix |
| `src/pages/customer/CustomerAuth.tsx` | customer-auth | Needs fix |
| `src/hooks/useCustomerAuth.tsx` | customer-auth | Needs fix |
| `src/components/settings/DataArchiveManager.tsx` | archive-old-data | Needs fix |
| `src/components/dashboard/DeliveryAutomationCard.tsx` | auto-deliver-daily | Needs fix |

### Root Cause
When you use `supabase.functions.invoke("function-name")`, the SDK makes a request to:
`{SUPABASE_URL}/functions/v1/function-name`

In Lovable Editor, the `supabase` client uses Lovable Cloud's URL, so function calls fail because:
1. Functions exist in code but deploy to Lovable Cloud (wrong project)
2. External Supabase (ohrytohcbbkorivsuukm) doesn't have these functions deployed

---

## Solution: Direct Edge Function Calls

Replace `supabase.functions.invoke()` with direct `fetch()` calls to the external Supabase URL, using the `invokeExternalFunction` helper that already exists.

### Architecture After Fix

```
Frontend (Vercel/Lovable Editor)
        │
        ▼
┌───────────────────────────────┐
│  invokeExternalFunction()     │ ◄── Hardcoded external URL
│  (src/lib/external-supabase)  │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  External Supabase            │
│  ohrytohcbbkorivsuukm         │
│  └── Edge Functions           │
│      └── All 10 functions     │
└───────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Enhance External Function Helper

Modify `src/lib/external-supabase.ts` to add a specialized helper that handles the app's custom session token authentication (used by staff auth system):

```typescript
// Add session-aware function invocation
export async function invokeExternalFunctionWithSession<T = unknown>(
  functionName: string,
  body: Record<string, unknown> = {}
): Promise<{ data: T | null; error: Error | null }> {
  // Get session token from localStorage (staff auth system)
  const sessionToken = localStorage.getItem('session_token');
  
  // Also check for Supabase Auth token (customer auth system)
  const { data: { session } } = await externalSupabase.auth.getSession();
  const authToken = session?.access_token || sessionToken;
  
  return invokeExternalFunction<T>(functionName, body, authToken || undefined);
}
```

### Phase 2: Update All Edge Function Calls (6 files)

#### File 1: `src/pages/Settings.tsx`
**Line 196**: Replace `supabase.functions.invoke("change-pin", ...)` with:
```typescript
const response = await invokeExternalFunctionWithSession("change-pin", {
  currentPin,
  newPin,
});
```

#### File 2: `src/pages/UserManagement.tsx`
**Lines 138, 176, 216, 258**: Replace all `supabase.functions.invoke()` calls with `invokeExternalFunctionWithSession()`:
- create-user
- update-user-status
- reset-user-pin
- delete-user

#### File 3: `src/pages/customer/CustomerAuth.tsx`
**Lines 43, 95**: Replace customer-auth calls with direct invocation

#### File 4: `src/hooks/useCustomerAuth.tsx`
**Lines 98, 126, 158**: Replace all customer-auth function calls

#### File 5: `src/components/settings/DataArchiveManager.tsx`
**Lines 104, 152, 226**: Replace archive-old-data calls with session-aware invocation

#### File 6: `src/components/dashboard/DeliveryAutomationCard.tsx`
**Line 44**: Replace auto-deliver-daily call

### Phase 3: Deploy Edge Functions to External Supabase

The edge function code is already correct and uses Supabase's built-in environment variables. You need to deploy them to your external project:

```bash
# One-time setup
supabase login
supabase link --project-ref ohrytohcbbkorivsuukm

# Deploy all functions
supabase functions deploy archive-old-data --no-verify-jwt
supabase functions deploy auto-deliver-daily --no-verify-jwt
supabase functions deploy change-pin --no-verify-jwt
supabase functions deploy create-user --no-verify-jwt
supabase functions deploy customer-auth --no-verify-jwt
supabase functions deploy delete-user --no-verify-jwt
supabase functions deploy health-check --no-verify-jwt
supabase functions deploy reset-user-pin --no-verify-jwt
supabase functions deploy setup-external-db --no-verify-jwt
supabase functions deploy update-user-status --no-verify-jwt
```

---

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `src/lib/external-supabase.ts` | MODIFY | Add `invokeExternalFunctionWithSession` helper |
| `src/pages/Settings.tsx` | MODIFY | Replace function invoke (1 location) |
| `src/pages/UserManagement.tsx` | MODIFY | Replace function invokes (4 locations) |
| `src/pages/customer/CustomerAuth.tsx` | MODIFY | Replace function invokes (2 locations) |
| `src/hooks/useCustomerAuth.tsx` | MODIFY | Replace function invokes (3 locations) |
| `src/components/settings/DataArchiveManager.tsx` | MODIFY | Replace function invokes (3 locations) |
| `src/components/dashboard/DeliveryAutomationCard.tsx` | MODIFY | Replace function invoke (1 location) |

**Total: 7 files, 14 function call replacements**

---

## Technical Details

### Authentication Handling

The app has TWO authentication systems:
1. **Staff Auth**: Custom session tokens in `localStorage.session_token`, validated via `auth_sessions` table
2. **Customer Auth**: Supabase Auth with JWT tokens, validated via `supabase.auth.getSession()`

The helper will check both and use whichever is available.

### Error Response Handling

Current code expects:
```typescript
const response = await supabase.functions.invoke("fn", { body });
// response.error = FunctionsFetchError
// response.data = parsed JSON body
```

New helper returns:
```typescript
const response = await invokeExternalFunctionWithSession("fn", body);
// response.error = Error (if any)
// response.data = parsed JSON body
```

The structure is compatible, minimal code changes needed.

---

## Verification Checklist

After implementation:

1. **Staff Auth Works**
   - Login as super_admin
   - Create new user (UserManagement)
   - Change own PIN (Settings)
   - Reset another user's PIN
   - Delete a user

2. **Customer Auth Works**
   - Customer login
   - Customer registration
   - Customer PIN change

3. **Automation Works**
   - Manual trigger of auto-deliver-daily
   - Data archive preview/export/execute

4. **Deploy to Vercel**
   - Set environment variables:
     - VITE_SUPABASE_URL
     - VITE_SUPABASE_ANON_KEY
   - Verify all functions work in production

---

## Summary

This migration ensures:
- **Zero runtime dependency on Lovable Cloud**
- All edge functions deployed to YOUR Supabase (ohrytohcbbkorivsuukm)
- All frontend calls go directly to external Supabase
- Database operations already use external Supabase (no changes needed)
- Complete independence for Vercel + External Supabase hosting

The website will work identically in Lovable Editor preview AND production Vercel deployment.
