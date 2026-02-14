

# Fix: Delivery Automation Not Functioning

## Root Cause Analysis

After comprehensive analysis, there are **3 critical failures** preventing delivery automation from working at any level:

### Problem 1: Edge Function Not Configured (Blocks ALL edge function calls)
The `auto-deliver-daily` edge function is **missing from `supabase/config.toml`**. Without `verify_jwt = false`, the Supabase API gateway rejects all unauthenticated requests before they reach the function code.

- The "Run Auto-Delivery Now" button calls `invokeExternalFunctionWithSession`, which tries to get a Supabase Auth JWT. But this app uses **custom PIN-based auth** (no Supabase Auth session), so `auth.getSession()` returns null, and the function returns `'Authentication required'` before even making the network call.
- The GitHub Actions cron job sends a bare POST request with no auth headers at all -- rejected by the gateway.

### Problem 2: GitHub Actions Missing API Key Header (Blocks cron automation)
The GitHub Actions workflow (`auto-deliver-daily.yml`) sends the request with only `Content-Type` header. Supabase requires the `apikey` header even when `verify_jwt = false`. Without it, the request gets a 401 from the gateway.

### Problem 3: Frontend Scheduler Blocked by RLS (Blocks "Schedule Today" / "Auto-Deliver All")
The `useAutoDeliveryScheduler` hook uses the `externalSupabase` client (anon key). All table operations (SELECT, INSERT, UPDATE on `deliveries`, `delivery_items`, `customer_products`) go through RLS policies that check `auth.uid()`. Since this app uses custom PIN auth, `auth.uid()` is always NULL for the anon client, so:
- SELECT queries return 0 rows (no subscriptions found)
- INSERT/UPDATE operations silently fail (no matching policy)

This is why every button shows "0 scheduled, 0 delivered" -- it's not a logic bug, it's a permissions wall.

---

## Solution

### Fix 1: Add `auto-deliver-daily` to `config.toml`
**File: `supabase/config.toml`**

Add the missing entry:
```toml
[functions.auto-deliver-daily]
verify_jwt = false
```

### Fix 2: Fix GitHub Actions Workflow to Include Required Headers
**File: `.github/workflows/auto-deliver-daily.yml`**

Add the `apikey` header and `Authorization` header (using service role key for server-to-server calls):
```yaml
- name: Trigger Auto Delivery
  env:
    SUPABASE_URL: ${{ secrets.EXTERNAL_SUPABASE_URL }}
    SUPABASE_ANON_KEY: ${{ secrets.EXTERNAL_SUPABASE_ANON_KEY }}
  run: |
    response=$(curl -s -w "\n%{http_code}" \
      -X POST \
      -H "Content-Type: application/json" \
      -H "apikey: ${SUPABASE_ANON_KEY}" \
      "${SUPABASE_URL}/functions/v1/auto-deliver-daily" \
      -d '{}')
```

### Fix 3: Make Edge Function the Single Source of Truth for All Delivery Automation
The edge function already uses `SUPABASE_SERVICE_ROLE_KEY` internally, which bypasses RLS. This is the correct pattern. The problem is that the frontend buttons ("Schedule Today", "Auto-Deliver All") use the anon client directly instead of going through the edge function.

**Fix the `DeliveryAutomationCard` to route ALL operations through the edge function:**

**File: `src/components/dashboard/DeliveryAutomationCard.tsx`**

- Change "Schedule Today" to call the edge function with `{ mode: "schedule_only" }` instead of using `useAutoDeliveryScheduler` directly
- Change "Auto-Deliver All" to call the edge function with `{ mode: "auto_deliver_pending" }` instead of using `useAutoDeliveryScheduler` directly
- Keep "Run Auto-Delivery Now" calling the edge function (already correct pattern, just needs auth fix)

**File: `supabase/functions/auto-deliver-daily/index.ts`**

Update the edge function to support different modes:
- `mode: "full"` (default, current behavior) -- schedule + auto-deliver
- `mode: "schedule_only"` -- only create pending deliveries, don't mark as delivered
- `mode: "auto_deliver_pending"` -- only mark existing pending deliveries as delivered

Since the edge function uses the service role key, all database operations bypass RLS, solving the permissions issue.

### Fix 4: Fix Frontend Edge Function Invocation (No Supabase Auth Dependency)
**File: `src/components/dashboard/DeliveryAutomationCard.tsx`**

Replace `invokeExternalFunctionWithSession` (which requires Supabase Auth JWT) with `invokeExternalFunction` (which only needs the anon key as apikey). Since `verify_jwt = false` is set, the edge function doesn't need a JWT -- just the apikey for gateway routing.

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/config.toml` | Add `[functions.auto-deliver-daily]` with `verify_jwt = false` |
| `.github/workflows/auto-deliver-daily.yml` | Add `apikey` header using `EXTERNAL_SUPABASE_ANON_KEY` secret |
| `supabase/functions/auto-deliver-daily/index.ts` | Add `mode` parameter support (schedule_only, auto_deliver_pending, full) |
| `src/components/dashboard/DeliveryAutomationCard.tsx` | Route all 3 buttons through edge function using `invokeExternalFunction` (no JWT needed) |

## What Will NOT Change
- No database schema changes
- No RLS policy changes (edge function bypasses RLS via service role key)
- No changes to `useAutoDeliveryScheduler` hook (kept for potential future use)
- No changes to Deliveries page, Billing, Customers, or any other page
- No changes to Telegram notifications
- No changes to the `run_auto_delivery` database function
- The `BulkDeliveryActions` component continues working as-is (it operates on already-existing deliveries)

## Verification After Implementation
- "Schedule Today" should create pending deliveries for all eligible customers
- "Auto-Deliver All" should mark all pending deliveries as delivered
- "Run Auto-Delivery Now" should do both (schedule + deliver) in one call
- GitHub Actions cron should work at 10:00 AM IST daily

