

# Comprehensive Solution: Fix Duplicate Phone Key Constraint & Prevent Future Orphaned Data

## Problem Analysis

### Current Situation
From the SQL query results and error message:
- **Auth User ID**: `5b2b5877-1d73-428f-842d-47b4f2d0e82d`
- **Email**: `7897716792@awadhdairy.com` 
- **user_roles entry**: `super_admin` ✅
- **profiles entry**: Missing (`NULL`) ❌

When attempting to INSERT a profile with phone `7897716792`:
```
ERROR: 23505: duplicate key value violates unique constraint "profiles_phone_key"
Key (phone)=(7897716792) already exists.
```

### Root Cause
There's an **orphaned profile record** in the `profiles` table with:
- Phone = `7897716792`
- But `id` = some OTHER UUID (not `5b2b5877-...`)

This creates a data integrity nightmare:
1. Auth user exists in `auth.users` → ID: 5b2b5877-...
2. Role assigned in `user_roles` → user_id: 5b2b5877-...  
3. Old orphaned profile in `profiles` → id: DIFFERENT UUID, phone: 7897716792
4. INSERT fails because phone is UNIQUE

### Why This Happens

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Data Integrity Failure Points                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. setup-external-db creates auth user (5b2b5877...)           │
│                    ↓                                             │
│  2. Tries profile.upsert({id: 5b2b5877, phone: 7897716792})     │
│                    ↓                                             │
│  3. FAILS! Another profile (id=XYZ) has phone=7897716792        │
│                    ↓                                             │
│  4. Auth user exists without matching profile                   │
│                    ↓                                             │
│  5. Function reports success (doesn't check upsert error)       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Comprehensive Solution Overview

| Component | Problem | Solution |
|-----------|---------|----------|
| `setup-external-db` | Silent upsert failures | Add proper error handling, cleanup orphans first |
| `create-user` | Phone conflict possible | Check and handle existing orphaned profiles |
| Database Schema | No cascade cleanup | Add trigger to sync phone uniqueness |
| New SQL Function | Manual intervention needed | Create `cleanup_orphaned_data` function |
| Edge Function | No admin cleanup tool | Add `find-and-cleanup-all-orphans` action |

---

## Implementation Plan

### Phase 1: Immediate SQL Fix (Manual - Run in External Supabase)

Run these queries in the external Supabase SQL Editor to fix the current state:

```sql
-- Step 1: Find the orphaned profile with phone 7897716792
SELECT id, full_name, phone, role, is_active, created_at
FROM public.profiles
WHERE phone = '7897716792';

-- Step 2: Check if this orphaned profile has a matching auth user
-- (Run after Step 1 to get the orphaned profile's ID)

-- Step 3: Delete the orphaned profile (if it's not linked to a valid auth user)
-- Replace <ORPHANED_ID> with the actual ID from Step 1
DELETE FROM public.profiles 
WHERE phone = '7897716792' 
  AND id != '5b2b5877-1d73-428f-842d-47b4f2d0e82d';

-- Step 4: Delete any orphaned user_roles entry
DELETE FROM public.user_roles 
WHERE user_id NOT IN (
  SELECT id FROM auth.users
  UNION
  SELECT id FROM public.profiles
);

-- Step 5: Now insert the correct profile for the super admin
INSERT INTO public.profiles (id, full_name, phone, role, is_active, pin_hash)
VALUES (
  '5b2b5877-1d73-428f-842d-47b4f2d0e82d',
  'Super Admin',
  '7897716792',
  'super_admin',
  true,
  crypt('101101', gen_salt('bf'))
);
```

---

### Phase 2: Update `setup-external-db` Edge Function

**File**: `supabase/functions/setup-external-db/index.ts`

**Changes**:

1. **Add orphan cleanup BEFORE profile operations**:
```typescript
// Clean up any orphaned profile with the admin phone number
const { data: orphanedProfile } = await supabaseAdmin
  .from('profiles')
  .select('id')
  .eq('phone', PERMANENT_ADMIN_PHONE)
  .neq('id', adminUserId) // Not matching current auth user
  .maybeSingle();

if (orphanedProfile) {
  console.log('[SETUP] Found orphaned profile, cleaning up:', orphanedProfile.id);
  // Delete orphaned user_roles first
  await supabaseAdmin.from('user_roles').delete().eq('user_id', orphanedProfile.id);
  // Delete orphaned profile
  await supabaseAdmin.from('profiles').delete().eq('id', orphanedProfile.id);
}
```

2. **Add proper error handling for upsert operations**:
```typescript
const { error: profileError } = await supabaseAdmin
  .from('profiles')
  .upsert({
    id: adminUserId,
    full_name: PERMANENT_ADMIN_NAME,
    phone: PERMANENT_ADMIN_PHONE,
    role: 'super_admin',
    is_active: true
  }, { onConflict: 'id' });

if (profileError) {
  console.error('[SETUP] Profile upsert failed:', profileError);
  throw new Error(`Profile creation failed: ${profileError.message}`);
}
```

3. **Add comprehensive cleanup function at the start**:
```typescript
// Clean up ALL orphaned data before proceeding
async function cleanupOrphans(supabaseAdmin: SupabaseClient) {
  // Find profiles with no matching auth user
  const { data: allProfiles } = await supabaseAdmin.from('profiles').select('id');
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  
  const authUserIds = new Set(authUsers?.users?.map(u => u.id) || []);
  const orphanedProfileIds = allProfiles
    ?.filter(p => !authUserIds.has(p.id))
    .map(p => p.id) || [];
  
  for (const orphanId of orphanedProfileIds) {
    await supabaseAdmin.from('user_roles').delete().eq('user_id', orphanId);
    await supabaseAdmin.from('profiles').delete().eq('id', orphanId);
    console.log('[SETUP] Cleaned orphaned profile:', orphanId);
  }
  
  return orphanedProfileIds.length;
}
```

---

### Phase 3: Update `create-user` Edge Function

**File**: `supabase/functions/create-user/index.ts`

**Changes**:

1. **Enhanced phone number conflict detection**:
```typescript
// Check if phone number already exists in profiles
const { data: existingProfile } = await supabaseAdmin
  .from('profiles')
  .select('id, is_active, full_name')
  .eq('phone', phone)
  .maybeSingle();

if (existingProfile) {
  // Check if this profile has a matching auth user
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id);
  
  if (!authUser?.user) {
    // This is an ORPHANED profile - clean it up automatically
    console.log(`[CREATE-USER] Found orphaned profile ${existingProfile.id}, cleaning up...`);
    await supabaseAdmin.from('user_roles').delete().eq('user_id', existingProfile.id);
    await supabaseAdmin.from('profiles').delete().eq('id', existingProfile.id);
    // Now proceed with creation
  } else if (existingProfile.is_active) {
    return new Response(
      JSON.stringify({ error: 'A user with this phone number already exists' }),
      { status: 400, ... }
    );
  } else {
    return new Response(
      JSON.stringify({ error: 'This phone number belongs to a deactivated user. Please reactivate instead.' }),
      { status: 400, ... }
    );
  }
}
```

---

### Phase 4: Add New Database Function (SQL)

**Add to**: `EXTERNAL_SUPABASE_SCHEMA.sql`

```sql
-- Cleanup orphaned data function
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orphaned_profiles INT := 0;
  _orphaned_roles INT := 0;
  _result JSONB;
BEGIN
  -- Find and delete profiles with no matching auth user
  WITH deleted_profiles AS (
    DELETE FROM public.profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM auth.users au WHERE au.id = p.id
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO _orphaned_profiles FROM deleted_profiles;

  -- Find and delete user_roles with no matching profile
  WITH deleted_roles AS (
    DELETE FROM public.user_roles ur
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id
    )
    RETURNING user_id
  )
  SELECT COUNT(*) INTO _orphaned_roles FROM deleted_roles;

  RETURN json_build_object(
    'success', true,
    'orphaned_profiles_deleted', _orphaned_profiles,
    'orphaned_roles_deleted', _orphaned_roles
  );
END;
$$;
```

---

### Phase 5: Enhanced `delete-user` Edge Function

**File**: `supabase/functions/delete-user/index.ts`

**Add new action**: `find-and-cleanup-all-orphans`

This action finds and cleans up:
1. Profiles without matching auth.users
2. user_roles without matching profiles
3. auth.users without matching profiles (already exists)

```typescript
// Add new action handler
if (action === 'cleanup-all-orphan-types') {
  console.log('Comprehensive orphan cleanup...');
  
  // 1. Get all auth users
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const authUserIds = new Set(authUsers?.users?.map(u => u.id) || []);
  
  // 2. Get all profiles
  const { data: profiles } = await supabaseAdmin.from('profiles').select('id, phone');
  const profileIds = new Set(profiles?.map(p => p.id) || []);
  
  const results = { 
    orphanedProfiles: 0, 
    orphanedRoles: 0, 
    orphanedAuthUsers: 0 
  };
  
  // 3. Delete profiles without matching auth users
  for (const profile of (profiles || [])) {
    if (!authUserIds.has(profile.id)) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', profile.id);
      await supabaseAdmin.from('profiles').delete().eq('id', profile.id);
      results.orphanedProfiles++;
    }
  }
  
  // 4. Delete auth users without matching profiles
  for (const authUser of (authUsers?.users || [])) {
    if (authUser.email?.endsWith('@awadhdairy.com') && !profileIds.has(authUser.id)) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      results.orphanedAuthUsers++;
    }
  }
  
  // 5. Delete user_roles without matching profiles
  const { data: roles } = await supabaseAdmin.from('user_roles').select('user_id');
  for (const role of (roles || [])) {
    if (!profileIds.has(role.user_id) && !authUserIds.has(role.user_id)) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', role.user_id);
      results.orphanedRoles++;
    }
  }
  
  return new Response(JSON.stringify({ success: true, ...results }), ...);
}
```

---

### Phase 6: Add Admin UI for Data Integrity Management

**File**: `src/components/settings/DataIntegrityManager.tsx` (New File)

A simple admin component to:
- Show orphaned data counts
- One-click cleanup button
- Audit log of cleanup operations

---

## Implementation Order

| Step | Action | Risk Level |
|------|--------|------------|
| 1 | Run manual SQL fix (Phase 1) | Low - Fixes immediate issue |
| 2 | Update `setup-external-db` (Phase 2) | Low - Prevents future orphans |
| 3 | Update `create-user` (Phase 3) | Low - Auto-cleanup on create |
| 4 | Add SQL cleanup function (Phase 4) | Low - Database-level safety net |
| 5 | Update `delete-user` (Phase 5) | Low - Admin cleanup tool |
| 6 | Add UI component (Phase 6) | Low - Optional visibility |

---

## Testing After Implementation

1. **Run setup-external-db** - should complete without errors
2. **Login as super admin** - phone 7897716792, PIN 101101
3. **Create new user** - verify no orphan issues
4. **Delete user** - verify cleanup is complete
5. **Data Archive** - verify preview/export/execute all work

---

## Files to Modify

| File | Type | Changes |
|------|------|---------|
| `supabase/functions/setup-external-db/index.ts` | Edge Function | Add orphan cleanup, error handling |
| `supabase/functions/create-user/index.ts` | Edge Function | Enhanced conflict detection |
| `supabase/functions/delete-user/index.ts` | Edge Function | Add comprehensive cleanup action |
| `EXTERNAL_SUPABASE_SCHEMA.sql` | SQL Schema | Add cleanup_orphaned_data function |
| `src/components/settings/DataIntegrityManager.tsx` | New Component | Admin UI for data integrity |
| `src/pages/Settings.tsx` | Page | Add DataIntegrityManager section |

---

## SQL Commands Summary (Run in External Supabase)

**Immediate Fix (Run First)**:
```sql
-- Find the orphan
SELECT * FROM public.profiles WHERE phone = '7897716792';

-- Delete orphan (adjust ID if different)
DELETE FROM public.profiles 
WHERE phone = '7897716792' 
  AND id != '5b2b5877-1d73-428f-842d-47b4f2d0e82d';

-- Create correct profile
INSERT INTO public.profiles (id, full_name, phone, role, is_active, pin_hash)
VALUES (
  '5b2b5877-1d73-428f-842d-47b4f2d0e82d',
  'Super Admin', '7897716792', 'super_admin', true,
  crypt('101101', gen_salt('bf'))
);
```

**Add Cleanup Function (After Fix)**:
```sql
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _orphaned_profiles INT := 0;
  _orphaned_roles INT := 0;
BEGIN
  WITH deleted_profiles AS (
    DELETE FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
    RETURNING id
  )
  SELECT COUNT(*) INTO _orphaned_profiles FROM deleted_profiles;

  WITH deleted_roles AS (
    DELETE FROM public.user_roles ur
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id)
    RETURNING user_id
  )
  SELECT COUNT(*) INTO _orphaned_roles FROM deleted_roles;

  RETURN json_build_object(
    'success', true,
    'orphaned_profiles_deleted', _orphaned_profiles,
    'orphaned_roles_deleted', _orphaned_roles
  );
END;
$$;
```

