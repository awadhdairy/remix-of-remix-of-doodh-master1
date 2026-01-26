

## Implementation Plan: Complete Migration from Edge Functions to Native Supabase

### Phase 1 Status: COMPLETE
All 6 database functions have been successfully created:
- `admin_create_staff_user` 
- `admin_update_user_status`
- `admin_reset_user_pin`
- `admin_delete_user`
- `change_own_pin`
- `run_auto_delivery`

---

### Phase 2: Frontend Changes

#### 1. Auth.tsx - Remove Bootstrap Button
**Lines to modify:** 27, 54-101, 151-153, 257-274

**Changes:**
- Remove `bootstrapping` state variable
- Remove `handleBootstrap` function entirely
- Remove `showBootstrapOption` logic
- Remove the "Setup Admin Account" button
- Keep the login flow (already uses native `supabase.auth.signInWithPassword`)

---

#### 2. UserManagement.tsx - Replace Edge Function Calls
**Lines to modify:** 131-163, 173-197, 200-236, 250-275

**Changes:**
| Current Code | New Code |
|--------------|----------|
| `supabase.functions.invoke("create-user")` | `supabase.auth.signUp()` + `supabase.rpc('admin_create_staff_user')` |
| `supabase.functions.invoke("update-user-status")` | `supabase.rpc('admin_update_user_status')` |
| `supabase.functions.invoke("reset-user-pin")` | `supabase.rpc('admin_reset_user_pin')` + `supabase.auth.updateUser()` |
| `supabase.functions.invoke("delete-user")` | `supabase.rpc('admin_delete_user')` |

**User Creation Flow:**
```typescript
// 1. Create auth user with signUp
const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
  email: `${phone}@awadhdairy.com`,
  password: pin,
});

// 2. Set up profile and role via RPC
const { data: rpcData, error: rpcError } = await supabase.rpc('admin_create_staff_user', {
  _user_id: signUpData.user.id,
  _full_name: fullName,
  _phone: phone,
  _role: selectedRole,
  _pin: pin,
});
```

---

#### 3. Settings.tsx - Replace PIN Change Edge Function
**Lines to modify:** 189-221

**Changes:**
```typescript
// Before
const response = await supabase.functions.invoke("change-pin", {
  body: { currentPin, newPin }
});

// After
const { data, error } = await supabase.rpc('change_own_pin', {
  _current_pin: currentPin,
  _new_pin: newPin,
});

// Also update Supabase Auth password for consistency
if (data?.success) {
  await supabase.auth.updateUser({ password: newPin });
}
```

---

#### 4. useCustomerAuth.tsx - Replace All Edge Function Calls
**Lines to modify:** 96-122, 124-142, 152-169

**Changes for login:**
```typescript
// Before
const { data, error } = await supabase.functions.invoke('customer-auth', {
  body: { action: 'login', phone, pin }
});

// After
// 1. Verify PIN via database function
const { data: verifyData } = await supabase.rpc('verify_customer_pin', {
  _phone: phone,
  _pin: pin
});

// 2. Login via native Supabase Auth
const email = `customer_${phone}@awadhdairy.com`;
const { error: authError } = await supabase.auth.signInWithPassword({
  email,
  password: pin,
});
```

**Changes for register:**
```typescript
// Before
const { data, error } = await supabase.functions.invoke('customer-auth', {
  body: { action: 'register', phone, pin }
});

// After
const { data } = await supabase.rpc('register_customer_account', {
  _phone: phone,
  _pin: pin
});
```

**Changes for changePin:**
```typescript
// Before
const { data, error } = await supabase.functions.invoke('customer-auth', {
  body: { action: 'change-pin', customerId, currentPin, newPin }
});

// After
const { data } = await supabase.rpc('update_customer_pin', {
  _customer_id: customerId,
  _current_pin: currentPin,
  _new_pin: newPin
});
```

---

#### 5. CustomerAuth.tsx - Replace Edge Function Calls
**Lines to modify:** 42-88, 91-131

Same pattern as useCustomerAuth.tsx - replace `supabase.functions.invoke('customer-auth')` with direct RPC calls.

---

#### 6. DeliveryAutomationCard.tsx - Replace Edge Function Call
**Lines to modify:** 41-71

**Changes:**
```typescript
// Before
const { data, error } = await supabase.functions.invoke("auto-deliver-daily", {
  body: { triggered_at: new Date().toISOString(), manual: true },
});

// After
const { data, error } = await supabase.rpc('run_auto_delivery');
```

---

### Phase 3: GitHub Actions Update

#### keep-alive.yml
**Full replacement:**

```yaml
name: Keep Alive Ping

on:
  schedule:
    - cron: '0 3 */2 * *'  # Every alternate day at 3 AM UTC
  workflow_dispatch:

jobs:
  keep-alive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Database via PostgREST
        run: |
          response=$(curl -s -w "\n%{http_code}" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            "https://sgpnlunidlrbfdbegapw.supabase.co/rest/v1/dairy_settings_public?select=dairy_name&limit=1")
          
          http_code=$(echo "$response" | tail -1)
          body=$(echo "$response" | head -n -1)
          
          echo "Response: $body"
          echo "HTTP Status: $http_code"
          
          if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            echo "Keep-alive ping successful at $(date -u)"
          else
            echo "Keep-alive ping failed with status $http_code"
            exit 1
          fi
```

---

### Phase 4: Delete Edge Functions

Remove all 9 Edge Function directories:
- `supabase/functions/auto-deliver-daily/`
- `supabase/functions/bootstrap-admin/`
- `supabase/functions/change-pin/`
- `supabase/functions/create-user/`
- `supabase/functions/customer-auth/`
- `supabase/functions/delete-user/`
- `supabase/functions/health-check/`
- `supabase/functions/reset-user-pin/`
- `supabase/functions/update-user-status/`

---

### Post-Implementation: Supabase Dashboard Setup (One-Time)

1. **Enable Auto-Confirm Emails:**
   - Go to Supabase Dashboard > Authentication > Settings
   - Under "Email Auth", enable "Confirm email"
   - This is required for the `signUp()` flow to work without email verification

2. **Initial Super Admin Setup:**
   - Go to Supabase Dashboard > Authentication > Users
   - Create user with email: `7897716792@awadhdairy.com` and password: your 6-digit PIN
   - Run SQL to set up profile and role (provided after implementation)

3. **Enable pg_cron (Optional for Scheduled Automation):**
   - Go to Supabase Dashboard > Extensions
   - Enable `pg_cron` for scheduled auto-delivery
   - Create cron job: `SELECT cron.schedule('auto-deliver-daily', '30 4 * * *', 'SELECT public.run_auto_delivery()');`

---

### Files Summary

| File | Action |
|------|--------|
| `src/pages/Auth.tsx` | Remove bootstrap functionality |
| `src/pages/UserManagement.tsx` | Replace 4 edge function calls with RPC |
| `src/pages/Settings.tsx` | Replace change-pin edge function with RPC |
| `src/hooks/useCustomerAuth.tsx` | Replace 3 edge function calls with RPC |
| `src/pages/customer/CustomerAuth.tsx` | Replace 2 edge function calls with RPC |
| `src/components/dashboard/DeliveryAutomationCard.tsx` | Replace auto-deliver edge function with RPC |
| `.github/workflows/keep-alive.yml` | Update to call PostgREST directly |
| `supabase/functions/*/` | Delete all 9 directories |

---

### Result After Implementation

- **Zero Edge Functions** - Complete independence from Lovable
- **100% Native Supabase** - Works on any Supabase project forever
- **Free Forever** - No Edge Function invocation costs
- **Same Functionality** - All features preserved
- **Better Performance** - Database functions are faster than Edge Functions
- **Simpler Deployment** - Just deploy frontend to Vercel, database handles everything

