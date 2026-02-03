
# Comprehensive Fix: Remove Bootstrap Dependency & Fix Create-User Error

## Problem Summary

### 1. Create-User Edge Function Error
The `create-user` edge function is failing because it uses `SUPABASE_SERVICE_ROLE_KEY` (Lovable Cloud's internal variable) instead of `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` (your external Supabase project's service role key).

**Current code (line 20 of create-user/index.ts):**
```typescript
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')  // WRONG
```

**All other functions use:**
```typescript
const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')  // CORRECT
```

### 2. Bootstrap Dependency Issues
The project has several places that depend on bootstrap logic:
- `setup-external-db` function reads `BOOTSTRAP_ADMIN_PHONE` and `BOOTSTRAP_ADMIN_PIN` from environment
- `bootstrap_super_admin()` SQL function in the schema
- Documentation files reference bootstrap process

### 3. Missing Permanent Admin
The admin account (phone: `7897716792`, PIN: `101101`) needs to be hardcoded directly into the setup function so it works without environment variables.

---

## Solution Overview

| Component | Change Required |
|-----------|-----------------|
| `create-user/index.ts` | Fix environment variable from `SUPABASE_SERVICE_ROLE_KEY` to `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` |
| `setup-external-db/index.ts` | Hardcode permanent admin credentials, remove `BOOTSTRAP_ADMIN_PHONE` and `BOOTSTRAP_ADMIN_PIN` dependencies |
| Secrets cleanup | Remove unused `BOOTSTRAP_ADMIN_PHONE` and `BOOTSTRAP_ADMIN_PIN` secrets |

---

## Technical Implementation Details

### Fix 1: Update create-user/index.ts

**File:** `supabase/functions/create-user/index.ts`

**Changes:**
1. Replace `SUPABASE_SERVICE_ROLE_KEY` with `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`
2. Add `EXTERNAL_SUPABASE_URL` usage for consistency with other functions
3. Fix the role check to use the safe query pattern (avoid `.single()` errors)

```typescript
// BEFORE (broken):
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabaseAdmin = createClient(EXTERNAL_URL, serviceRoleKey)

// AFTER (fixed):
const supabaseUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
```

### Fix 2: Update setup-external-db/index.ts

**File:** `supabase/functions/setup-external-db/index.ts`

**Changes:**
1. Hardcode permanent admin credentials directly in code:
   - Phone: `7897716792`
   - PIN: `101101`
2. Remove dependency on `BOOTSTRAP_ADMIN_PHONE` and `BOOTSTRAP_ADMIN_PIN` environment variables
3. Make the function truly idempotent (safe to run multiple times)

```typescript
// BEFORE (reads from env):
const adminPhone = Deno.env.get('BOOTSTRAP_ADMIN_PHONE')!
const adminPin = Deno.env.get('BOOTSTRAP_ADMIN_PIN')!

// AFTER (hardcoded permanent admin):
const PERMANENT_ADMIN_PHONE = '7897716792'
const PERMANENT_ADMIN_PIN = '101101'
```

### Fix 3: Align Role Check Pattern

All edge functions will use the safe role-check pattern to prevent `.single()` errors when checking admin permissions:

```typescript
// Safe pattern (handles duplicate roles gracefully):
const { data: roleRows, error: roleError } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', requestingUser.id)
  .eq('role', 'super_admin')
  .limit(1)

const isSuperAdmin = !roleError && roleRows && roleRows.length > 0
```

---

## Files to Modify

### 1. supabase/functions/create-user/index.ts
- Replace hardcoded `EXTERNAL_URL` constant with `EXTERNAL_SUPABASE_URL` env variable
- Replace `SUPABASE_SERVICE_ROLE_KEY` with `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`
- Update role check to use safe query pattern
- Add better error logging

### 2. supabase/functions/setup-external-db/index.ts
- Remove `BOOTSTRAP_ADMIN_PHONE` and `BOOTSTRAP_ADMIN_PIN` env variable reads
- Hardcode permanent admin credentials
- Keep the seed data functionality intact

---

## Verification After Implementation

### Test 1: Health Check
```bash
curl "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/health-check"
```
Expected: `{"status": "healthy"}`

### Test 2: Setup External DB (Bootstrap Permanent Admin)
```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db" \
  -H "Content-Type: application/json"
```
Expected: `{"success": true, "admin_phone": "7897716792", ...}`

### Test 3: Admin Login
- Go to `/auth`
- Enter phone: `7897716792`
- Enter PIN: `101101`
- Should successfully log in as super_admin

### Test 4: Create New User (via Admin)
- Log in as admin
- Go to User Management
- Click "Add New User"
- Fill in details and submit
- Should successfully create the user

---

## Environment Variables Status

| Variable | Status | Purpose |
|----------|--------|---------|
| `EXTERNAL_SUPABASE_URL` | Keep | Required for all functions |
| `EXTERNAL_SUPABASE_ANON_KEY` | Keep | Required for all functions |
| `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` | Keep | Required for admin operations |
| `BOOTSTRAP_ADMIN_PHONE` | Can Remove | No longer needed (hardcoded) |
| `BOOTSTRAP_ADMIN_PIN` | Can Remove | No longer needed (hardcoded) |

---

## Security Considerations

1. **Hardcoded Admin Credentials**: The permanent admin phone/PIN is hardcoded in the edge function code. This is acceptable because:
   - Edge function code is server-side only (not exposed to clients)
   - The admin can change their PIN after first login
   - This is a standard pattern for initial system setup

2. **Service Role Key**: Still stored as a secret (never hardcoded)

3. **PIN Storage**: PINs are still hashed using bcrypt in the database

---

## Summary of Changes

| File | Lines Changed | Description |
|------|---------------|-------------|
| `create-user/index.ts` | ~30 lines | Fix env variables, use safe role check |
| `setup-external-db/index.ts` | ~10 lines | Hardcode permanent admin, remove bootstrap env deps |

This fix will:
- Allow the admin to create new users successfully
- Remove all bootstrap environment variable dependencies
- Make the permanent admin (7897716792/101101) work reliably
- Align all edge functions to use the same environment variable pattern
