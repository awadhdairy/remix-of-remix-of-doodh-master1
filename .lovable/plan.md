

## Complete Independence from Lovable Edge Functions

### Overview
This plan will migrate your entire authentication and automation system from Lovable Edge Functions to native Supabase, ensuring your Vercel + Supabase deployment works independently and FREE forever.

---

### Current Edge Functions (to be replaced)

| Edge Function | Current Purpose | Migration Strategy |
|---------------|-----------------|-------------------|
| `bootstrap-admin` | First-time super admin setup | Remove - use Supabase Dashboard directly |
| `create-user` | Staff user creation | Database function + frontend signup |
| `customer-auth` | Customer login/register/change-pin | Database functions already exist + direct Supabase Auth |
| `change-pin` | Staff PIN change | New database function |
| `reset-user-pin` | Admin resets staff PIN | New database function |
| `update-user-status` | Activate/deactivate users | New database function |
| `delete-user` | Remove staff accounts | New database function |
| `auto-deliver-daily` | Daily delivery automation | `pg_cron` scheduled job |
| `health-check` | Database keep-alive | GitHub Action calling direct table query |

---

### Phase 1: Database Functions (New)

Create these new SECURITY DEFINER functions that will replace Edge Functions:

**1. `admin_create_staff_user`**
- Called after frontend creates auth user via `supabase.auth.signUp()`
- Sets up profile, role, and PIN hash
- Verifies caller is super_admin

**2. `admin_update_user_status`**
- Activates/deactivates users
- Checks caller is super_admin
- Prevents self-deactivation

**3. `admin_reset_user_pin`**
- Resets PIN for any user
- Super_admin only

**4. `admin_delete_user`**
- Marks user for deletion (auth deletion handled separately)
- Super_admin only

**5. `change_own_pin`**
- Authenticated user changes their own PIN
- Verifies current PIN first

**6. `run_auto_delivery`**
- Contains the auto-delivery logic from Edge Function
- Can be called via pg_cron or manually

---

### Phase 2: pg_cron for Scheduled Tasks

**Replace `auto-deliver-daily` Edge Function:**

Enable `pg_cron` and `pg_net` extensions, then create a scheduled job:

```sql
SELECT cron.schedule(
  'auto-deliver-daily',
  '30 4 * * *',  -- 4:30 AM UTC = 10:00 AM IST
  $$SELECT public.run_auto_delivery()$$
);
```

This runs the auto-delivery logic daily at 10 AM IST using native Postgres scheduling.

---

### Phase 3: Frontend Auth Changes

**File: `src/pages/Auth.tsx`**

| Current | New |
|---------|-----|
| `supabase.functions.invoke('bootstrap-admin')` | **Remove entirely** - bootstrap via Supabase Dashboard |
| Login via `supabase.auth.signInWithPassword` | **Keep as-is** - already using native auth! |

Changes:
- Remove the "Setup Admin Account" button and `handleBootstrap` function
- Staff login already uses native Supabase Auth (good!)

---

**File: `src/pages/UserManagement.tsx`**

| Current | New |
|---------|-----|
| `supabase.functions.invoke('create-user')` | `supabase.auth.signUp()` + `supabase.rpc('admin_create_staff_user')` |
| `supabase.functions.invoke('update-user-status')` | `supabase.rpc('admin_update_user_status')` |
| `supabase.functions.invoke('reset-user-pin')` | `supabase.rpc('admin_reset_user_pin')` + `supabase.auth.admin` (via service role) |
| `supabase.functions.invoke('delete-user')` | `supabase.rpc('admin_delete_user')` + auth cleanup |

**Note on User Creation Challenge:**
- Creating users requires `auth.admin.createUser()` which needs service role key
- Solution: Use `supabase.auth.signUp()` with auto-confirm enabled in Supabase settings
- Then call `admin_create_staff_user()` RPC to set up profile/role

---

**File: `src/pages/Settings.tsx`**

| Current | New |
|---------|-----|
| `supabase.functions.invoke('change-pin')` | `supabase.rpc('change_own_pin')` + `supabase.auth.updateUser()` |

---

**File: `src/hooks/useCustomerAuth.tsx`**

| Current | New |
|---------|-----|
| `supabase.functions.invoke('customer-auth', { action: 'login' })` | `supabase.rpc('verify_customer_pin')` + `supabase.auth.signInWithPassword()` |
| `supabase.functions.invoke('customer-auth', { action: 'register' })` | `supabase.rpc('register_customer_account')` + `supabase.auth.signUp()` |
| `supabase.functions.invoke('customer-auth', { action: 'change-pin' })` | `supabase.rpc('update_customer_pin')` + `supabase.auth.updateUser()` |

**Note:** The database functions `register_customer_account`, `verify_customer_pin`, and `update_customer_pin` already exist!

---

**File: `src/pages/customer/CustomerAuth.tsx`**

Same changes as `useCustomerAuth.tsx` - replace Edge Function calls with RPC + direct auth.

---

**File: `src/components/dashboard/DeliveryAutomationCard.tsx`**

| Current | New |
|---------|-----|
| `supabase.functions.invoke('auto-deliver-daily')` | `supabase.rpc('run_auto_delivery')` |

---

### Phase 4: GitHub Actions Update

**File: `.github/workflows/keep-alive.yml`**

Change from calling Edge Function to calling Supabase REST API directly:

```yaml
- name: Ping Database
  run: |
    response=$(curl -s -w "\n%{http_code}" \
      -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
      -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
      "https://sgpnlunidlrbfdbegapw.supabase.co/rest/v1/dairy_settings_public?select=dairy_name&limit=1")
```

This pings the database directly via PostgREST without needing Edge Functions.

---

### Phase 5: Delete Edge Functions

Remove all Edge Function directories:
- `supabase/functions/bootstrap-admin/`
- `supabase/functions/create-user/`
- `supabase/functions/customer-auth/`
- `supabase/functions/change-pin/`
- `supabase/functions/reset-user-pin/`
- `supabase/functions/update-user-status/`
- `supabase/functions/delete-user/`
- `supabase/functions/auto-deliver-daily/`
- `supabase/functions/health-check/`

---

### Phase 6: Initial Super Admin Setup (One-Time)

Since you chose "Direct Supabase Auth" for bootstrap, here's the one-time setup:

1. Go to **Supabase Dashboard** → Authentication → Users
2. Click **Add User** and create:
   - Email: `7897716792@awadhdairy.com` (your admin phone)
   - Password: Your 6-digit PIN
3. Run this SQL in Supabase SQL Editor:

```sql
-- Replace {USER_ID} with the actual UUID from step 2
UPDATE public.profiles 
SET role = 'super_admin', phone = '7897716792', full_name = 'Super Admin', is_active = true
WHERE id = '{USER_ID}';

INSERT INTO public.user_roles (user_id, role) 
VALUES ('{USER_ID}', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

SELECT public.update_pin_only('{USER_ID}'::uuid, 'YOUR_PIN');
```

---

### Technical Details

#### New Database Functions (SQL)

**`admin_update_user_status`**
```sql
CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  _target_user_id uuid, 
  _is_active boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  IF _target_user_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deactivate yourself');
  END IF;
  
  UPDATE public.profiles SET is_active = _is_active WHERE id = _target_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;
```

**`admin_reset_user_pin`**
```sql
CREATE OR REPLACE FUNCTION public.admin_reset_user_pin(
  _target_user_id uuid, 
  _new_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  UPDATE public.profiles 
  SET pin_hash = crypt(_new_pin, gen_salt('bf')) 
  WHERE id = _target_user_id;
  
  RETURN json_build_object('success', true);
END;
$$;
```

**`change_own_pin`**
```sql
CREATE OR REPLACE FUNCTION public.change_own_pin(
  _current_pin text, 
  _new_pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  _user_id uuid;
BEGIN
  _user_id := auth.uid();
  
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _user_id AND pin_hash = crypt(_current_pin, pin_hash)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
  END IF;
  
  UPDATE public.profiles 
  SET pin_hash = crypt(_new_pin, gen_salt('bf')) 
  WHERE id = _user_id;
  
  RETURN json_build_object('success', true);
END;
$$;
```

**`admin_create_staff_user`**
```sql
CREATE OR REPLACE FUNCTION public.admin_create_staff_user(
  _user_id uuid,
  _full_name text,
  _phone text,
  _role user_role,
  _pin text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Upsert profile
  INSERT INTO public.profiles (id, full_name, phone, role, is_active, pin_hash)
  VALUES (_user_id, _full_name, _phone, _role::text, true, crypt(_pin, gen_salt('bf')))
  ON CONFLICT (id) DO UPDATE SET
    full_name = _full_name,
    phone = _phone,
    role = _role::text,
    is_active = true,
    pin_hash = crypt(_pin, gen_salt('bf'));
  
  -- Upsert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id) DO UPDATE SET role = _role;
  
  RETURN json_build_object('success', true);
END;
$$;
```

---

### Supabase Settings Required

1. **Authentication → Settings → Email Auth**
   - Enable "Auto-confirm email signups" (critical for user creation to work)

2. **Extensions**
   - Enable `pg_cron` (for scheduled jobs)
   - Enable `pg_net` (for HTTP calls if needed)

---

### Files Summary

**Database Migrations (New Functions):**
- `admin_update_user_status`
- `admin_reset_user_pin`
- `admin_delete_user`
- `change_own_pin`
- `admin_create_staff_user`
- `run_auto_delivery` (port from Edge Function)
- pg_cron job setup

**Files to Modify:**

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Remove bootstrap button |
| `src/pages/UserManagement.tsx` | Replace all Edge Function calls with RPC + signUp |
| `src/pages/Settings.tsx` | Replace change-pin Edge Function with RPC |
| `src/hooks/useCustomerAuth.tsx` | Replace all Edge Function calls with RPC + direct auth |
| `src/pages/customer/CustomerAuth.tsx` | Replace Edge Function calls with RPC |
| `src/components/dashboard/DeliveryAutomationCard.tsx` | Replace Edge Function with RPC |
| `.github/workflows/keep-alive.yml` | Call PostgREST directly instead of Edge Function |

**Files to Delete:**
- All 9 Edge Function directories under `supabase/functions/`

---

### Result After Implementation

- **Zero Edge Functions** - complete independence from Lovable
- **100% Native Supabase** - works on any Supabase project forever
- **Free Forever** - no Edge Function invocation costs
- **Same Functionality** - all features preserved
- **Better Performance** - database functions are faster than Edge Functions
- **Simpler Deployment** - just deploy frontend to Vercel, database handles everything

---

### Important Notes

1. **PIN + Password Sync:** When changing PINs, we update both `profiles.pin_hash` (for verification) AND the Supabase Auth password (for login). The frontend will use `supabase.auth.updateUser({ password: newPin })` for the current user.

2. **User Creation Flow:** Since we can't use `auth.admin.createUser()` from frontend, the flow becomes:
   - Super admin calls `supabase.auth.signUp({ email, password: pin })`
   - Then calls `supabase.rpc('admin_create_staff_user')` to set up profile/role/pin_hash

3. **Customer Auth:** Existing database functions (`register_customer_account`, `verify_customer_pin`, `update_customer_pin`) already handle most logic - we just need to add direct Supabase Auth calls.

4. **Auto-Delivery:** The `pg_cron` job runs entirely within Postgres, making it more reliable and free.

