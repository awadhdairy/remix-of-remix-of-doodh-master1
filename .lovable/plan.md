
# Comprehensive Bug Fix Plan: Post Edge Function Removal Integrity Check

## Executive Summary

After thoroughly reviewing the codebase following the Edge Function removal, I've identified **8 critical issues** that need to be fixed before deployment for long-term sustainability.

---

## Issues Identified

### 1. CRITICAL: Settings.tsx Uses Deprecated `supabase.auth.getUser()`
**Location:** `src/pages/Settings.tsx` (line 61)
**Problem:** The Settings page still uses `supabase.auth.getUser()` to fetch user profile, but since we removed Supabase Auth dependency, this will always return null.
**Impact:** Staff cannot view or edit their profile, and the "Change PIN" feature in Settings page is completely broken.

### 2. CRITICAL: MobileNavbar.tsx Uses Deprecated `supabase.auth.signOut()`
**Location:** `src/components/mobile/MobileNavbar.tsx` (line 163)
**Problem:** Mobile logout uses `supabase.auth.signOut()` which does nothing in our custom auth system.
**Impact:** Mobile users' logout appears successful but their custom session remains active.

### 3. CRITICAL: `change_own_pin` RPC Still Uses `auth.uid()`
**Problem:** The existing `change_own_pin` database function relies on `auth.uid()` which will return NULL in our custom session system.
**Impact:** Staff cannot change their own PIN via the Settings page.

### 4. CRITICAL: All RLS Policies Depend on `auth.uid()`
**Problem:** Over 30 RLS policies across all tables use `auth.uid()` directly or through helper functions like `has_role(auth.uid(), ...)`, `is_manager_or_admin(auth.uid())`, etc.
**Impact:** Since we're not using Supabase Auth, `auth.uid()` returns NULL for all requests, effectively **breaking all RLS-protected data access**. Users will be unable to read/write most tables.

### 5. MODERATE: React Ref Warning in Console
**Location:** `App.tsx` route structure
**Problem:** "Function components cannot be given refs" warning appearing in console for `StaffAuthProvider` and `Auth` components.
**Impact:** Not breaking, but creates console noise and may indicate improper component wrapping.

### 6. MINOR: Missing `useStaffAuth` in MobileNavbar
**Problem:** MobileNavbar imports `supabase` directly but should use the `useStaffAuth` context for logout.
**Impact:** Inconsistent logout behavior between desktop and mobile.

### 7. ARCHITECTURAL: Duplicate Session Token Calculation
**Problem:** Session expiration is calculated both client-side (7 days in frontend) and server-side (from DB). If these drift, sessions may behave unexpectedly.
**Impact:** Low - currently aligned at 7 days for staff.

### 8. SECURITY: Auth Sessions RLS Policies Too Permissive
**Problem:** Current policies use `USING (true)` and `FOR DELETE USING (true)` which means anyone can view or delete any session.
**Impact:** Security vulnerability - any user can enumerate or invalidate other users' sessions.

---

## Fix Strategy

### Phase 1: Database Migration (Required Before Frontend Fixes)

Create a new database migration to:

1. **Update `change_own_pin` function** to accept a session token instead of relying on `auth.uid()`:
```sql
CREATE OR REPLACE FUNCTION public.staff_change_own_pin(
  _session_token text,
  _current_pin text, 
  _new_pin text
)
RETURNS json
```

2. **Add RLS bypass approach** - Since we can't use `auth.uid()`, we have two options:
   - **Option A (Recommended):** Use `SECURITY DEFINER` wrapper functions for all data operations, bypassing RLS
   - **Option B:** Set a session variable `current_setting('app.current_user_id')` at request start and update all RLS policies to use it

   For simplicity and minimal disruption, I recommend Option A - keeping RLS for basic protection but using SECURITY DEFINER functions for actual operations.

3. **Fix auth_sessions RLS** to properly restrict access:
```sql
-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions" ON public.auth_sessions
  FOR SELECT USING (
    user_id::text = current_setting('app.current_user_id', true)
  );
```

### Phase 2: Frontend Fixes

1. **Fix Settings.tsx:**
   - Remove `supabase.auth.getUser()` call
   - Import and use `useStaffAuth()` to get current user
   - Update profile fetch to use the user ID from auth context
   - Update `handleChangePin` to call new `staff_change_own_pin` RPC with session token

2. **Fix MobileNavbar.tsx:**
   - Remove `supabase.auth.signOut()` call
   - Import and use `useStaffAuth()` for logout
   - Use the `logout()` function from the context

3. **Fix Console Warnings:**
   - Restructure App.tsx route wrapping to avoid ref issues
   - Use proper React element syntax instead of nested Route elements with JSX children

---

## Detailed File Changes

### Files to Create:
- `supabase/migrations/[timestamp]_fix_post_edge_function_issues.sql`

### Files to Modify:
1. `src/pages/Settings.tsx` - Use StaffAuthContext instead of supabase.auth
2. `src/components/mobile/MobileNavbar.tsx` - Use StaffAuthContext for logout
3. `src/App.tsx` - Fix route structure to eliminate ref warnings

### Database Changes:
1. Create `staff_change_own_pin(_session_token, _current_pin, _new_pin)` RPC
2. Update auth_sessions RLS policies to be properly restrictive
3. Grant EXECUTE on new function to anon and authenticated roles

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| RLS policies blocking all data | HIGH | Use SECURITY DEFINER functions for data operations |
| Staff PIN change broken | HIGH | Create new session-based PIN change RPC |
| Mobile logout not working | MEDIUM | Update to use custom auth context |
| Session enumeration | MEDIUM | Fix auth_sessions RLS policies |
| Console warnings | LOW | Restructure route components |

---

## Testing Checklist After Fix

- [ ] Staff login works with phone + PIN
- [ ] Staff logout works on desktop (sidebar)
- [ ] Staff logout works on mobile (hamburger menu)
- [ ] Staff can view Settings page with their profile
- [ ] Staff can change their own PIN in Settings
- [ ] Customer login/register works
- [ ] Customer can change PIN in Profile page
- [ ] Super Admin can create new staff users
- [ ] Super Admin can delete staff users
- [ ] All dashboard data loads correctly (cattle, deliveries, customers, etc.)
- [ ] No console errors related to auth

---

## Implementation Order

1. **Database migration first** - Create `staff_change_own_pin` function and fix RLS
2. **Settings.tsx** - Update to use StaffAuthContext
3. **MobileNavbar.tsx** - Update logout to use StaffAuthContext
4. **App.tsx** - Fix route structure (optional, for clean console)
5. **Test all auth flows end-to-end**

