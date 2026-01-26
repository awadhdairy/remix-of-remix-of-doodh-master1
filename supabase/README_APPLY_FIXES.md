# How to Apply Database Fixes for Admin User Creation

The admin user creation feature requires database functions that need to be applied to your Supabase database.

## Problem
When creating users as admin:
- Admin gets logged out
- New user is created with wrong role (super_admin instead of selected role)
- Error message "Only super admin or manager can create staff users" appears

## Solution
Apply the database fixes by running the SQL script in your Supabase Dashboard.

## Steps

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project (rihedsukjinwqvsvufls)

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Fix Script**
   - Open the file `supabase/APPLY_FIXES.sql` from this repository
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" or press Ctrl+Enter

4. **Verify Success**
   - At the bottom of the script, there's a verification query
   - You should see 6 functions listed:
     - admin_create_staff_user
     - admin_update_user_status
     - admin_reset_user_pin
     - admin_delete_user
     - admin_reactivate_user
     - has_role

5. **Test in the App**
   - Log in as super admin
   - Go to User Management
   - Create a new user with any role (Manager, Accountant, etc.)
   - Verify:
     - Admin stays logged in
     - New user has correct role assigned
     - No error messages

## What the Fix Does

1. **Creates `admin_create_staff_user` function**: Properly sets the user's role after signup
2. **Validates admin permission**: Only super_admin can create users
3. **Validates user existence**: Ensures the auth user was created before setting profile
4. **Checks phone uniqueness**: Prevents duplicate phone numbers
5. **Handles errors gracefully**: Returns proper error messages

## Frontend Fix (Already Applied)

The frontend code has been updated to:
- Save admin session before creating new user
- Immediately restore admin session after signup
- Properly handle RPC errors and stop execution if role assignment fails
