# Comprehensive Fix: Customer Products RLS Policy Violation

## Status: ✅ IMPLEMENTED

**Edge function updated** - now links `user_id` on EVERY login path.

---

## What Was Fixed in Edge Function

The `customer-auth` Edge Function now:
1. Links `customer_accounts.user_id = auth.uid()` on **every successful login**
2. Updates JWT metadata with `customer_id` on every login
3. Handles both primary and retry login paths

---

## REQUIRED: Run SQL in External Supabase

**You must run this SQL** in your External Supabase SQL Editor:
https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql

```sql
-- ============================================================================
-- COMPREHENSIVE FIX: Customer Products RLS + User Linkage
-- ============================================================================

-- PART A: Create secure helper function with triple-fallback
CREATE OR REPLACE FUNCTION public.get_customer_id_from_session()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _customer_id UUID;
  _email TEXT;
  _phone TEXT;
BEGIN
  -- Priority 1: Check customer_accounts table for linked user
  SELECT ca.customer_id INTO _customer_id
  FROM public.customer_accounts ca
  WHERE ca.user_id = auth.uid();
  
  IF _customer_id IS NOT NULL THEN
    RETURN _customer_id;
  END IF;
  
  -- Priority 2: Check JWT user_metadata for customer_id
  BEGIN
    _customer_id := (auth.jwt() -> 'user_metadata' ->> 'customer_id')::UUID;
    IF _customer_id IS NOT NULL THEN
      RETURN _customer_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Priority 3: Look up by email pattern (customer_PHONE@awadhdairy.com)
  BEGIN
    _email := auth.jwt() ->> 'email';
    IF _email LIKE 'customer_%@awadhdairy.com' THEN
      _phone := REPLACE(REPLACE(_email, 'customer_', ''), '@awadhdairy.com', '');
      SELECT ca.customer_id INTO _customer_id
      FROM public.customer_accounts ca
      WHERE ca.phone = _phone;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN _customer_id;
END;
$$;

-- PART B: Drop ALL old customer_products policies
DROP POLICY IF EXISTS "Customers can manage own subscriptions" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can read own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can view own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can add own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can update own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can delete own products" ON public.customer_products;

-- PART C: Create NEW customer policies using the helper function
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

-- PART D: Verify the policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'customer_products';
```

---

## After SQL Migration: User Action Required

1. **Customer must LOGOUT** (click Profile → Logout in portal)
2. **Customer must LOGIN again** with phone + PIN
3. The Edge Function will now link their `user_id` in the database
4. RLS policies will work correctly

---

## Deploy Edge Function to External Project

```bash
supabase functions deploy customer-auth --project-ref iupmzocmmjxpeabkmzri --no-verify-jwt
```
