

# Plan: Replace Edge Functions with Database RPCs

## Overview

This plan replaces 5 Edge Functions with their existing database RPC equivalents. The database functions already exist and have been verified to contain equivalent or better logic than the Edge Functions.

## Current State Analysis

### Edge Functions to Replace

| Edge Function | Database RPC | Frontend Location | Status |
|--------------|--------------|-------------------|--------|
| `update-user-status` | `admin_update_user_status` | `UserManagement.tsx:176-181` | RPC exists |
| `reset-user-pin` | `admin_reset_user_pin` | `UserManagement.tsx:213-218` | RPC exists |
| `change-pin` | `change_own_pin` | `Settings.tsx:191-196` | RPC exists |
| `auto-deliver-daily` | `run_auto_delivery` | `DeliveryAutomationCard.tsx:44-46` | RPC exists |
| `health-check` | Direct REST query | `keep-alive.yml:16-17` | No RPC needed |

### Verified Database Functions

All replacement RPCs are `SECURITY DEFINER` functions with proper authorization checks:

1. **`admin_update_user_status(_target_user_id, _is_active)`**
   - Returns JSON with success/error
   - Verifies caller is `super_admin`
   - Prevents self-deactivation

2. **`admin_reset_user_pin(_target_user_id, _new_pin)`**
   - Returns JSON with success/error
   - Verifies caller is `super_admin`
   - Validates 6-digit PIN format

3. **`change_own_pin(_current_pin, _new_pin)`**
   - Returns JSON with success/error
   - Uses `auth.uid()` for self-identification
   - Verifies current PIN before update

4. **`run_auto_delivery()`**
   - Returns JSON with scheduled/delivered/skipped counts
   - Already scheduled via pg_cron at 4:30 AM UTC

---

## Implementation Steps

### Step 1: Update UserManagement.tsx

Replace Edge Function calls with direct RPC calls for user status toggle and PIN reset.

**File:** `src/pages/UserManagement.tsx`

**Change 1: Update `handleToggleStatus` function (lines 173-197)**

```typescript
// BEFORE (Edge Function call)
const response = await supabase.functions.invoke("update-user-status", {
  body: { userId, isActive: !currentStatus },
});

// AFTER (Direct RPC call)
const { data, error } = await supabase.rpc('admin_update_user_status', {
  _target_user_id: userId,
  _is_active: !currentStatus,
});

if (error) throw new Error(error.message);
if (!data?.success) throw new Error(data?.error || 'Failed to update status');
toast.success(data.message);
```

**Change 2: Update `handleResetPin` function (lines 200-236)**

```typescript
// BEFORE (Edge Function call)
const response = await supabase.functions.invoke("reset-user-pin", {
  body: { userId: selectedUser.id, newPin },
});

// AFTER (Direct RPC call)
const { data, error } = await supabase.rpc('admin_reset_user_pin', {
  _target_user_id: selectedUser.id,
  _new_pin: newPin,
});

if (error) throw new Error(error.message);
if (!data?.success) throw new Error(data?.error || 'Failed to reset PIN');
toast.success(data.message);
```

---

### Step 2: Update Settings.tsx

Replace Edge Function call with direct RPC for PIN change.

**File:** `src/pages/Settings.tsx`

**Change: Update `handleChangePin` function (lines 161-221)**

```typescript
// BEFORE (Edge Function call)
const response = await supabase.functions.invoke("change-pin", {
  body: { currentPin, newPin },
});

// AFTER (Direct RPC call)
const { data, error } = await supabase.rpc('change_own_pin', {
  _current_pin: currentPin,
  _new_pin: newPin,
});

if (error) throw new Error(error.message);
if (!data?.success) throw new Error(data?.error || 'Failed to change PIN');
toast({ title: "PIN changed", description: data.message });
```

---

### Step 3: Update DeliveryAutomationCard.tsx

Replace Edge Function call with direct RPC for manual auto-delivery trigger.

**File:** `src/components/dashboard/DeliveryAutomationCard.tsx`

**Change: Update `handleTriggerCronJob` function (lines 41-71)**

```typescript
// BEFORE (Edge Function call)
const { data, error } = await supabase.functions.invoke("auto-deliver-daily", {
  body: { triggered_at: new Date().toISOString(), manual: true },
});
const result = data?.result;

// AFTER (Direct RPC call)
const { data, error } = await supabase.rpc('run_auto_delivery');

if (error) throw error;

// RPC returns the result directly, not nested
const result = data;
if (result) {
  toast({
    title: "Auto-delivery complete",
    description: `Delivered: ${result.delivered}, Scheduled: ${result.scheduled}, Skipped: ${result.skipped}`,
  });
  setLastResult({
    scheduled: result.scheduled,
    skipped: result.skipped,
    autoDelivered: result.delivered,
    errors: result.errors || [],
  });
}
```

---

### Step 4: Update GitHub Workflow keep-alive.yml

Replace Edge Function health check with direct REST API query.

**File:** `.github/workflows/keep-alive.yml`

**Change: Update curl command (lines 14-29)**

```yaml
# BEFORE (Edge Function)
response=$(curl -s -w "\n%{http_code}" \
  "https://eqedibnoatuxczjwkbbx.supabase.co/functions/v1/health-check")

# AFTER (Direct REST query to public view)
response=$(curl -s -w "\n%{http_code}" \
  "https://sgpnlunidlrbfdbegapw.supabase.co/rest/v1/dairy_settings_public?select=dairy_name&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNncG5sdW5pZGxyYmZkYmVnYXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNTQ1NzYsImV4cCI6MjA4NDkzMDU3Nn0.4gMVIz6scGWTPq4o4TjKEy6Zlmn8MjVoMUUhw8nTFys" \
  -H "Content-Type: application/json")
```

Note: This also fixes the incorrect project URL in the current workflow (it was pointing to a different project ID `eqedibnoatuxczjwkbbx` instead of the current `sgpnlunidlrbfdbegapw`).

---

### Step 5: Delete Edge Functions

After verifying the RPC calls work correctly, delete the following Edge Function directories:

```text
supabase/functions/update-user-status/    (DELETE)
supabase/functions/reset-user-pin/        (DELETE)
supabase/functions/change-pin/            (DELETE)
supabase/functions/health-check/          (DELETE)
supabase/functions/auto-deliver-daily/    (DELETE)
```

**Important:** The deployed Edge Functions will also need to be deleted using the Supabase CLI or dashboard to avoid confusion:

```bash
supabase functions delete update-user-status
supabase functions delete reset-user-pin
supabase functions delete change-pin
supabase functions delete health-check
supabase functions delete auto-deliver-daily
```

---

## What Remains After Migration

These 4 Edge Functions will remain as they require Supabase Admin API access:

| Edge Function | Reason to Keep |
|--------------|----------------|
| `bootstrap-admin` | Uses `auth.admin.createUser()` |
| `create-user` | Uses `signUp()` with service role |
| `delete-user` | Uses `auth.admin.deleteUser()` |
| `customer-auth` | Uses `signUp()` for customer registration |

---

## Technical Details

### Response Format Alignment

The database RPCs return JSON in this format:
```json
{
  "success": true,
  "message": "Operation completed successfully"
}
// or
{
  "success": false,
  "error": "Error description"
}
```

The frontend code will be updated to handle this format directly instead of the Edge Function response wrapper.

### Key Differences from Edge Functions

| Aspect | Edge Function | Database RPC |
|--------|--------------|--------------|
| Cold start | 500-2000ms | 0ms |
| Auth verification | Manual token parsing | Automatic via `auth.uid()` |
| Service role access | Yes (can update auth.users) | No (database-only) |
| Password sync | Updated auth password too | Only updates pin_hash |

**Note on Password Sync:** The Edge Functions for PIN changes also updated the Supabase Auth password. Since we use custom PIN-based authentication (via `verify_pin` RPC), the auth password sync is not critical. The primary authentication method is the `pin_hash` in the `profiles` table.

### pg_cron Already Configured

The `run_auto_delivery` function is already scheduled via pg_cron:
```sql
-- Runs daily at 4:30 AM UTC (10:00 AM IST)
SELECT cron.schedule(
  'auto-deliver-daily',
  '30 4 * * *',
  $$SELECT run_auto_delivery()$$
);
```

The manual trigger button in `DeliveryAutomationCard` will continue to work via direct RPC call.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/UserManagement.tsx` | Replace 2 Edge Function calls with RPCs |
| `src/pages/Settings.tsx` | Replace 1 Edge Function call with RPC |
| `src/components/dashboard/DeliveryAutomationCard.tsx` | Replace 1 Edge Function call with RPC |
| `.github/workflows/keep-alive.yml` | Replace Edge Function URL with REST query |

## Files to Delete

| Directory | Reason |
|-----------|--------|
| `supabase/functions/update-user-status/` | Replaced by `admin_update_user_status` RPC |
| `supabase/functions/reset-user-pin/` | Replaced by `admin_reset_user_pin` RPC |
| `supabase/functions/change-pin/` | Replaced by `change_own_pin` RPC |
| `supabase/functions/health-check/` | Replaced by direct REST query |
| `supabase/functions/auto-deliver-daily/` | Replaced by `run_auto_delivery` RPC + pg_cron |

---

## Benefits of This Migration

1. **Faster Response Times**: No Edge Function cold starts (500-2000ms savings)
2. **Lower Costs**: No Edge Function compute charges
3. **Simpler Architecture**: Fewer moving parts to maintain
4. **Better Security**: All authorization logic in `SECURITY DEFINER` functions
5. **Easier Debugging**: Logs in PostgreSQL instead of Edge Function logs
6. **Atomic Operations**: Database transactions instead of HTTP calls

---

## Verification Checklist

After implementation, verify:

- [ ] Super admin can toggle user status (activate/deactivate)
- [ ] Super admin can reset another user's PIN
- [ ] Any authenticated user can change their own PIN
- [ ] Manual "Run Auto-Delivery Now" button works
- [ ] Scheduled auto-delivery still runs at 10:00 AM IST
- [ ] GitHub keep-alive workflow succeeds
- [ ] No 401/403 errors in browser console

