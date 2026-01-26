

# Comprehensive Fix Plan: Authentication & Dashboard Display

## Summary of Issues Found

After thorough investigation of your external Supabase (`rihedsukjinwqvsvufls`), I identified the following issues:

### Issue 1: Missing `verify_staff_pin` Function
The external Supabase has `verify_pin` and `verify_customer_pin` but is **missing** `verify_staff_pin` which the Auth.tsx code calls during login fallback.

### Issue 2: Dashboard Shows "User" and "Farm Worker"
Despite the database having correct data:
- `profiles` table: `full_name = 'Super Admin'`, `role = 'super_admin'`
- `user_roles` table: `role = 'super_admin'`

The dashboard shows generic values because of an RLS policy mismatch - the `useUserRole` hook queries `profiles_safe` and `user_roles`, but current RLS policies may be blocking proper data access for the authenticated user.

### Issue 3: RPC Function Permissions
While functions have `PUBLIC` execute grants, explicit `anon` and `authenticated` role grants ensure reliable access.

---

## Technical Solution

### Step 1: Create Missing `verify_staff_pin` Function

```sql
-- Function to verify staff PIN against profiles table
CREATE OR REPLACE FUNCTION public.verify_staff_pin(_phone text, _pin text)
RETURNS TABLE (user_id uuid, is_active boolean, full_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.is_active, p.full_name, p.role::text
  FROM public.profiles p
  WHERE p.phone = _phone
    AND p.pin_hash = crypt(_pin, p.pin_hash);
END;
$$;
```

### Step 2: Grant Execute Permissions on All RPC Functions

```sql
-- Grant permissions for login and user management functions
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.verify_pin(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_pin(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.verify_customer_pin(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_customer_pin(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.register_customer_account(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_customer_account(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_create_staff_user(uuid, text, text, user_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_own_pin(text, text) TO authenticated;
```

### Step 3: Fix RLS Policy for profiles_safe View

The `profiles_safe` view inherits RLS from the base `profiles` table. The current policies require authentication, but there's a potential issue with how views interact with RLS. We'll add explicit SELECT permissions:

```sql
-- Ensure profiles_safe view works correctly for authenticated users
-- The view should be accessible to authenticated users reading their own profile
GRANT SELECT ON public.profiles_safe TO authenticated;
```

### Step 4: Verify auth.users and profiles Linkage

Check that the `auth.users.id` matches `profiles.id` for Super Admin:

```sql
-- Verification query (run to check, not execute)
SELECT 
  u.id as auth_user_id, 
  u.email,
  p.id as profile_id, 
  p.full_name, 
  p.role as profile_role,
  ur.role as user_roles_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = '7897716792@awadhdairy.com';
```

---

## Complete SQL Script

Run this in your external Supabase SQL Editor:

```sql
-- ============================================
-- STEP 1: Create missing verify_staff_pin function
-- ============================================
CREATE OR REPLACE FUNCTION public.verify_staff_pin(_phone text, _pin text)
RETURNS TABLE (user_id uuid, is_active boolean, full_name text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.is_active, p.full_name, p.role::text
  FROM public.profiles p
  WHERE p.phone = _phone
    AND p.pin_hash = crypt(_pin, p.pin_hash);
END;
$$;

-- ============================================
-- STEP 2: Grant execute permissions on functions
-- ============================================

-- Login functions (need anon access for pre-auth)
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_customer_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_customer_account(text, text) TO anon, authenticated;

-- Admin functions (authenticated only, function itself checks super_admin role)
GRANT EXECUTE ON FUNCTION public.admin_create_staff_user(uuid, text, text, user_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_own_pin(text, text) TO authenticated;

-- Helper functions
GRANT EXECUTE ON FUNCTION public.has_role(uuid, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, user_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin(uuid) TO authenticated;

-- ============================================
-- STEP 3: Grant SELECT on profiles_safe view
-- ============================================
GRANT SELECT ON public.profiles_safe TO authenticated;

-- ============================================
-- STEP 4: Verification queries (check output)
-- ============================================

-- Verify Super Admin setup
SELECT 
  'auth.users' as source, u.id, u.email 
FROM auth.users u 
WHERE u.email = '7897716792@awadhdairy.com'

UNION ALL

SELECT 
  'profiles' as source, p.id, p.full_name 
FROM public.profiles p 
WHERE p.phone = '7897716792'

UNION ALL

SELECT 
  'user_roles' as source, ur.user_id, ur.role::text 
FROM public.user_roles ur 
WHERE ur.user_id = (SELECT id FROM public.profiles WHERE phone = '7897716792');
```

---

## Expected Outcome

After running the SQL:

| Component | Before | After |
|-----------|--------|-------|
| Login Flow | `verify_staff_pin` fails (function missing) | Works with fallback PIN verification |
| Dashboard Name | Shows "User" | Shows "Super Admin" |
| Dashboard Role Badge | Shows "Farm Worker" | Shows "Super Admin" |
| User Management | May fail on RPC calls | All admin functions work |

---

## Verification Steps

After running the SQL, test:

1. **Login**: Enter `7897716792` + `101101` → Should reach dashboard
2. **Dashboard Header**: Should show "Welcome, Super Admin" with purple "Super Admin" badge
3. **Sidebar Footer**: Should show "Super Admin" name and role
4. **User Management**: Navigate to `/users` → Should be able to create new staff

---

## Why Dashboard Shows Wrong Data (Root Cause)

The `useUserRole` hook queries:
1. `user_roles` table for role
2. `profiles_safe` view for full_name

If RLS blocks these queries (e.g., user not properly authenticated or ID mismatch), the hook returns `null` values, and the UI falls back to:
- `userName || "User"` → "User"
- `roleLabels[role] || role` → If role is null, it shows nothing or default

The fix ensures:
1. Views are accessible to authenticated users
2. RLS policies correctly match `auth.uid()` to profile/role records
3. All database IDs are properly linked

