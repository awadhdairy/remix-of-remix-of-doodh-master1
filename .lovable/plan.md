# Fix RLS Policy for External Supabase - Customer Products

**Status: ✅ APPROVED - Ready to Execute**

---

## Action Required: Run SQL in External Supabase

**URL:** https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql

Copy and paste this SQL:

```sql
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
  
  IF _customer_id IS NOT NULL THEN
    RETURN _customer_id;
  END IF;
  
  -- Fallback: Check auth_sessions for customer session
  SELECT s.user_id INTO _customer_id
  FROM public.auth_sessions s
  WHERE s.user_id IN (
    SELECT ca2.customer_id FROM public.customer_accounts ca2 
    WHERE ca2.user_id = auth.uid()
  )
  AND s.user_type = 'customer'
  AND s.expires_at > NOW();
  
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

## After Running SQL

1. **Customer must logout and login again** - This links their auth user ID to customer_accounts
2. **Verify the fix** by running:
```sql
SELECT ca.phone, ca.customer_id, ca.user_id, c.name 
FROM customer_accounts ca
JOIN customers c ON c.id = ca.customer_id
WHERE ca.is_approved = true;
```

The `user_id` column should now be populated after login.

---

## Edge Function Deployment (if needed)

```bash
supabase functions deploy customer-auth --project-ref iupmzocmmjxpeabkmzri --no-verify-jwt
```
