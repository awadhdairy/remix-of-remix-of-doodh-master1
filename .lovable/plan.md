
# Fix RLS Policy for External Supabase - Customer Products

## Problem Summary

The "Failed to update subscription - new row violates row-level security policy" error is occurring because:

1. This project uses **External Supabase** (project `iupmzocmmjxpeabkmzri`), NOT Lovable Cloud
2. The migrations I created were applied to the Lovable Cloud database, which is NOT being used
3. The External Supabase database still has the old RLS policies that require `customer_accounts.user_id = auth.uid()`
4. The `user_id` column in `customer_accounts` is NULL because it wasn't being linked during customer login

---

## Solution Overview

You need to manually run SQL commands in your **External Supabase SQL Editor** to fix this issue.

**External Supabase SQL Editor URL:**
https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql

---

## SQL Migration to Run

Copy and paste this SQL into your External Supabase SQL Editor:

```text
-- ============================================================================
-- FIX: Customer Products RLS Policy
-- Run in: https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql
-- ============================================================================

-- Step 1: Create a secure function to get customer_id from auth session
CREATE OR REPLACE FUNCTION public.get_customer_id_from_session()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_id UUID;
BEGIN
  -- Get customer_id from customer_accounts linked to auth user
  SELECT ca.customer_id INTO _customer_id
  FROM public.customer_accounts ca
  WHERE ca.user_id = auth.uid();
  
  RETURN _customer_id;
END;
$$;

-- Step 2: Drop old RLS policies on customer_products (if they exist)
DROP POLICY IF EXISTS "Customers can manage own subscriptions" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can read own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can view own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can add own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can update own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can delete own products" ON public.customer_products;

-- Step 3: Create new secure RLS policies
CREATE POLICY "Customers can view own products" 
ON public.customer_products 
FOR SELECT 
USING (
  customer_id = public.get_customer_id_from_session()
  OR public.is_manager_or_admin(auth.uid())
  OR public.has_role(auth.uid(), 'delivery_staff')
  OR public.has_role(auth.uid(), 'auditor')
);

CREATE POLICY "Customers can add own products"
ON public.customer_products
FOR INSERT
WITH CHECK (
  customer_id = public.get_customer_id_from_session()
  OR public.is_manager_or_admin(auth.uid())
);

CREATE POLICY "Customers can update own products"
ON public.customer_products
FOR UPDATE
USING (
  customer_id = public.get_customer_id_from_session()
  OR public.is_manager_or_admin(auth.uid())
);

CREATE POLICY "Customers can delete own products"
ON public.customer_products
FOR DELETE
USING (
  customer_id = public.get_customer_id_from_session()
  OR public.is_manager_or_admin(auth.uid())
);

-- Step 4: Verify the policies were created
SELECT policyname FROM pg_policies WHERE tablename = 'customer_products';
```

---

## Additional Step: Fix Missing user_id in customer_accounts

The Edge Function should be updating `customer_accounts.user_id` when customers log in, but if there are existing customers who logged in before the fix, their `user_id` will still be NULL.

**After the customer logs out and logs back in**, the Edge Function will link their `user_id` to their `customer_accounts` record.

**To verify the fix is working**, run this query after a customer logs in:

```text
SELECT 
  ca.phone,
  ca.customer_id,
  ca.user_id,
  c.name as customer_name
FROM customer_accounts ca
JOIN customers c ON c.id = ca.customer_id
WHERE ca.is_approved = true;
```

The `user_id` column should now be populated after the customer logs in.

---

## Summary of Actions Required

| Step | Action | Location |
|------|--------|----------|
| 1 | Run the SQL migration above | External Supabase SQL Editor |
| 2 | Redeploy the `customer-auth` Edge Function | Your CLI or Supabase Dashboard |
| 3 | Ask customer to logout and login again | Customer Portal |
| 4 | Verify `user_id` is populated | External Supabase SQL Editor |

---

## Edge Function Deployment Command

Make sure the Edge Function is deployed to your External Supabase project:

```bash
supabase functions deploy customer-auth --project-ref iupmzocmmjxpeabkmzri --no-verify-jwt
```

---

## Why This Happens

The RLS security check flow is:

1. Customer makes a request (e.g., add product to subscription)
2. Supabase checks RLS policies on `customer_products` table
3. Policy calls `get_customer_id_from_session()` which looks up `customer_accounts.user_id = auth.uid()`
4. If `user_id` is NULL (not linked), the function returns NULL
5. Policy check fails: `NULL = customer_id` is always false
6. RLS violation error is thrown

After applying the fix and the customer logs in again, the Edge Function will:
1. Create/update the auth user in Supabase Auth
2. Store the auth user's ID in `customer_accounts.user_id`
3. Now `get_customer_id_from_session()` will return the correct `customer_id`
4. RLS check passes
