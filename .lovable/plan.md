

# Fix Plan: Delete User Edge Function

## Problem Summary

The `delete-user` Edge Function fails with `AuthApiError: User not found` because:
- Staff users are created via `admin_create_staff()` function which inserts ONLY into `profiles` table
- The Edge Function tries to delete from `auth.users` first, but user doesn't exist there
- The `profiles` table has NO foreign key to `auth.users`, so it's completely standalone

## Current Flow (Broken)

```text
delete-user called with userId
        │
        ▼
supabaseAdmin.auth.admin.deleteUser(userId)
        │
        ▼
ERROR: User not found in auth.users  ← Fails here!
(profiles and user_roles never cleaned up)
```

## Solution: Hybrid Deletion Logic

The Edge Function must handle two types of users:
1. **Auth-based users**: Exist in `auth.users` (like super_admin created via bootstrap)
2. **Profile-only users**: Exist only in `profiles` table (created via `admin_create_staff`)

## Fixed Flow

```text
delete-user called with userId
        │
        ▼
Check if user exists in auth.users
        │
   ┌────┴────┐
   │         │
   ▼         ▼
EXISTS    DOESN'T EXIST
   │         │
   ▼         ▼
Delete     Delete directly from:
from       1. user_roles
auth.users 2. profiles
(cascade)  (manual cleanup)
   │         │
   └────┬────┘
        ▼
   SUCCESS
```

## Changes Required

### 1. Update delete-user Edge Function

The key changes:
- Try to delete from `auth.users` first
- If "User not found" error (404), fall back to manual deletion from `profiles` and `user_roles`
- Always ensure both tables are cleaned up

### Code Changes (for External Supabase Dashboard)

Replace the standard deletion section (around line 180-210) with this logic:

```typescript
// Attempt to delete from auth.users first
const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

if (authDeleteError) {
  // Check if it's a "User not found" error (user only exists in profiles)
  if (authDeleteError.status === 404 || authDeleteError.message?.includes('not found')) {
    console.log('User not in auth.users, deleting from profiles/user_roles directly')
    
    // Delete from user_roles first
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
    
    if (rolesError) {
      console.error('Error deleting user_roles:', rolesError)
    }
    
    // Delete from profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } else {
    // Some other auth error
    console.error('Error deleting user from auth:', authDeleteError)
    return new Response(
      JSON.stringify({ error: 'Failed to delete user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
} else {
  // Auth user deleted successfully, also clean up profiles/user_roles just in case
  // (cascade may not work since there's no FK)
  await supabaseAdmin.from('user_roles').delete().eq('user_id', userId)
  await supabaseAdmin.from('profiles').delete().eq('id', userId)
}
```

### 2. Complete Updated Edge Function

I will provide the complete updated code that needs to be pasted into the External Supabase dashboard.

## Technical Summary

| Component | Current State | Fix Required |
|-----------|--------------|--------------|
| JWT Verification | Working correctly | No change |
| Auth user deletion | Fails if user not in auth.users | Add fallback logic |
| Profile deletion | Never executed | Add explicit deletion |
| user_roles deletion | Never executed | Add explicit deletion |

## Implementation Steps

1. Go to External Supabase Dashboard → Edge Functions → delete-user → Code
2. Replace the entire code with the fixed version (I will provide after approval)
3. Save/Deploy
4. Test deleting a user

## Optional Future Improvement

Consider adding foreign keys to prevent orphaned records:

```sql
-- Add FK from profiles to auth.users (optional, for new users)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add FK from user_roles to profiles
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

Note: This would only work for users created in auth.users first. Your current staff creation flow creates profiles-only users, so the FK may not be suitable unless you change the user creation flow.

