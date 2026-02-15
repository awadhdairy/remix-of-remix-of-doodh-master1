

# Fix: Auto-Delivery Edge Function Connecting to Wrong Database

## Root Cause

The `auto-deliver-daily` edge function uses `Deno.env.get("SUPABASE_URL")` which points to the **Lovable Cloud database** (empty -- 0 customers, 0 subscriptions). It should use `EXTERNAL_SUPABASE_URL` (your real database with all customer data) with a fallback to `SUPABASE_URL`.

Three other edge functions (`telegram-daily-summary`, `telegram-event-notify`, `send-telegram`) already have the correct pattern:
```
const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
```

The `auto-deliver-daily` function was missed during the previous fix.

## What Will Change

### File: `supabase/functions/auto-deliver-daily/index.ts`

**Lines 31-33** -- Change the Supabase client initialization from:
```typescript
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
```
To:
```typescript
const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
```

This is the exact same pattern used by the 3 Telegram functions. It works correctly in both environments:
- **Lovable Cloud deployment**: `EXTERNAL_SUPABASE_URL` exists (set as a secret) -- connects to your real database
- **External Supabase deployment**: `EXTERNAL_SUPABASE_URL` doesn't exist -- falls back to `SUPABASE_URL` which points to itself

### Audit: Other Edge Functions That Need the Same Fix

| Edge Function | Current Pattern | Status |
|---|---|---|
| `auto-deliver-daily` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `telegram-daily-summary` | `EXTERNAL_ OR SUPABASE_` | Already correct |
| `telegram-event-notify` | `EXTERNAL_ OR SUPABASE_` | Already correct |
| `send-telegram` | `EXTERNAL_ OR SUPABASE_` | Already correct |
| `archive-old-data` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `change-pin` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `create-user` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `customer-auth` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `delete-user` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `health-check` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `reset-user-pin` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `setup-external-db` | `SUPABASE_URL` only | **BROKEN -- will fix** |
| `update-user-status` | `SUPABASE_URL` only | **BROKEN -- will fix** |

**9 additional edge functions** have the same bug. All will be updated to the `EXTERNAL_ || SUPABASE_` fallback pattern.

## Files Modified

| File | Change |
|---|---|
| `supabase/functions/auto-deliver-daily/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/archive-old-data/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/change-pin/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/create-user/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/customer-auth/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/delete-user/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/health-check/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/reset-user-pin/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/setup-external-db/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |
| `supabase/functions/update-user-status/index.ts` | Use `EXTERNAL_SUPABASE_URL` fallback |

## What Will NOT Change
- No frontend code changes
- No database schema changes
- No GitHub Actions workflow changes
- No changes to the 3 Telegram functions (already correct)
- No changes to CORS configuration
- No changes to any other page or component
- The `EXTERNAL_SUPABASE_URL` and `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` secrets are already configured

## Why This Fix Is Safe
- The `||` fallback ensures the function works in BOTH deployment targets
- When deployed to the external project directly (via `supabase functions deploy`), the fallback to `SUPABASE_URL` kicks in naturally
- When auto-deployed by Lovable, the `EXTERNAL_` secrets are used to reach the real database
- No existing functionality is affected -- this is a one-line change per function

