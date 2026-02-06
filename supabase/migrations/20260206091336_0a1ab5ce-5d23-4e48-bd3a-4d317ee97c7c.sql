-- Fix security issue: Use SECURITY DEFINER function instead of user_metadata
-- This prevents users from manipulating their own metadata to gain access

-- First, drop the insecure policies
DROP POLICY IF EXISTS "Customers can view own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can add own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can update own products" ON public.customer_products;
DROP POLICY IF EXISTS "Customers can delete own products" ON public.customer_products;

-- Create a secure function to get customer_id from auth session
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
  -- First try to get from customer_accounts linked to auth user
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

-- Create secure RLS policies using the function
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