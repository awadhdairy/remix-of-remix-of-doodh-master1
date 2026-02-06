

# Comprehensive Fix: Customer Products RLS Policy Violation

## Problem Analysis

After thorough investigation, I've identified **multiple interrelated issues** causing the persistent "new row violates row-level security policy for table customer_products" error:

### Root Causes

1. **Missing `customer_id` in JWT Metadata**
   - The JWT token shows `user_metadata` as:
     ```json
     {"email_verified":true,"full_name":"Super Admin","phone":"7897716792"}
     ```
   - But it should contain:
     ```json
     {"phone":"7897716792","customer_id":"xxx","is_customer":true}
     ```
   - The edge function updates metadata, but existing sessions don't have the updated JWT

2. **Unlinked `user_id` in `customer_accounts`**
   - The RLS policies require: `customer_accounts.user_id = auth.uid()`
   - For existing customers, `user_id` is often NULL
   - The edge function only links on new account creation, not on subsequent logins

3. **Policies in External Database Not Updated**
   - The EXTERNAL Supabase project (iupmzocmmjxpeabkmzri) still has the OLD policies
   - Migrations were applied to Lovable Cloud (which is NOT being used)

4. **Customer User Using Staff Login Email Pattern**
   - From JWT: `"email":"7897716792@awadhdairy.com"` - This is the **customer portal email pattern**
   - But `user_metadata.full_name` = "Super Admin" suggests account mixing

---

## Complete Solution

### Step 1: Run SQL Migration (External Supabase)

Execute this SQL in your **External Supabase SQL Editor**:
https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql

```text
-- ============================================================================
-- COMPREHENSIVE FIX: Customer Products RLS + User Linkage
-- ============================================================================

-- PART A: Create secure helper function with JWT fallback
-- This function checks BOTH the database linkage AND the JWT metadata
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
  -- Priority 1: Check customer_accounts table for linked user
  SELECT ca.customer_id INTO _customer_id
  FROM public.customer_accounts ca
  WHERE ca.user_id = auth.uid();
  
  IF _customer_id IS NOT NULL THEN
    RETURN _customer_id;
  END IF;
  
  -- Priority 2: Check JWT user_metadata for customer_id (set by edge function)
  BEGIN
    _customer_id := (auth.jwt() -> 'user_metadata' ->> 'customer_id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    _customer_id := NULL;
  END;
  
  IF _customer_id IS NOT NULL THEN
    RETURN _customer_id;
  END IF;
  
  -- Priority 3: Look up by email pattern (customer_PHONE@awadhdairy.com)
  DECLARE
    _email TEXT;
    _phone TEXT;
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

-- Keep existing staff policies (don't drop these)
-- "Managers and admins have full access to customer_products"
-- "Delivery staff can read customer_products"
-- "Auditors can read customer_products"

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
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'customer_products';
```

### Step 2: Update Edge Function (customer-auth/index.ts)

The edge function needs to **always update `customer_accounts.user_id`** during login, not just during registration. I will update:

1. **Lines 312-316**: Add explicit user_id linking on every login
2. **Lines 376-385**: Ensure metadata sync happens correctly
3. **Add new code after line 393**: Force update of `customer_accounts.user_id` for every successful login

### Step 3: Deploy Edge Function

After I update the code, deploy to external project:
```bash
supabase functions deploy customer-auth --project-ref iupmzocmmjxpeabkmzri --no-verify-jwt
```

### Step 4: User Action Required

**The customer MUST:**
1. **Logout completely** (click Profile → Logout)
2. **Login again** with their phone + PIN
3. This triggers the edge function which will:
   - Link their `auth.uid()` to `customer_accounts.user_id`
   - Set `customer_id` in JWT metadata
   - Both the database AND JWT will now authorize the request

---

## Technical Summary

| Component | Current State | Fix |
|-----------|--------------|-----|
| RLS Policies | Require `user_id = auth.uid()` | Add fallback via `get_customer_id_from_session()` |
| JWT Metadata | Missing `customer_id` | Edge function updates on every login |
| `customer_accounts.user_id` | Often NULL | Edge function links on every login |
| Database | Using external project | SQL runs in external SQL Editor |

---

## Files to Modify

1. **`supabase/functions/customer-auth/index.ts`** - Update login flow to always link user_id
2. **External SQL** - Create helper function + update RLS policies

