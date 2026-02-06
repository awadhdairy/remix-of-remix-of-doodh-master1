-- Fix RLS policy for customer_products to work with customer portal auth
-- The issue is customer_accounts.user_id is NULL because we use PIN-based auth

-- First, drop the existing customer-specific policies that rely on user_id
DROP POLICY IF EXISTS "Customers can manage own subscriptions" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can read own products" ON public.customer_products;

-- Create new policies that work with the customer auth system
-- These use auth.uid() and check user_metadata for customer_id

-- Policy 1: Customers can SELECT their own products
CREATE POLICY "Customers can view own products" 
ON public.customer_products 
FOR SELECT 
USING (
  -- Check if the authenticated user's metadata contains this customer_id
  customer_id::text = ((auth.jwt() -> 'user_metadata' ->> 'customer_id'))
);

-- Policy 2: Customers can INSERT their own products  
CREATE POLICY "Customers can add own products"
ON public.customer_products
FOR INSERT
WITH CHECK (
  customer_id::text = ((auth.jwt() -> 'user_metadata' ->> 'customer_id'))
);

-- Policy 3: Customers can UPDATE their own products
CREATE POLICY "Customers can update own products"
ON public.customer_products
FOR UPDATE
USING (
  customer_id::text = ((auth.jwt() -> 'user_metadata' ->> 'customer_id'))
);

-- Policy 4: Customers can DELETE their own products
CREATE POLICY "Customers can delete own products"
ON public.customer_products
FOR DELETE
USING (
  customer_id::text = ((auth.jwt() -> 'user_metadata' ->> 'customer_id'))
);