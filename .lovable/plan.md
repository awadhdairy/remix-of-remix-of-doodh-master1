
# Comprehensive Fix: Products Section Issues

## Problem Analysis

Based on my investigation, there are **three interconnected issues** in the Products section:

### Issue 1: Cannot Delete Products (Foreign Key Constraint)
**Error Message:** `"update or delete on table 'products' violates foreign key constraint 'customer_products_product_id_fkey' on table 'customer_products'"`

**Root Cause:** 
The `customer_products` table has a foreign key to `products`, but it lacks `ON DELETE CASCADE` or `ON DELETE SET NULL`. When trying to delete a product that customers have subscribed to, the database blocks the operation.

**Current Schema (line 273):**
```sql
CREATE TABLE IF NOT EXISTS public.customer_products (
  ...
  product_id UUID NOT NULL REFERENCES public.products(id), -- No ON DELETE clause
  ...
);
```

**Also affected tables:**
- `delivery_items.product_id` references `products.id`
- `price_rules.product_id` references `products.id`

---

### Issue 2: Cannot Add/Edit Products (RLS Policy Issue)
**Root Cause:**
The RLS policy for INSERT/UPDATE on `products` requires the user to be a manager or admin:

```sql
CREATE POLICY "Managers and admins can manage products" ON public.products
  FOR ALL USING (public.is_manager_or_admin(auth.uid()));
```

This depends on:
1. `auth.uid()` returning a valid user ID (user must be authenticated via Supabase Auth)
2. That user ID must exist in the `user_roles` table with role `super_admin` or `manager`

**Potential Issues:**
- User may not be properly authenticated (Supabase Auth session)
- User's role may not be set correctly in `user_roles` table
- The `is_manager_or_admin` function may not be working correctly

---

### Issue 3: Wrong Database Connection (Migration Issue)
**Root Cause:**
The code in `src/lib/external-supabase.ts` is still pointing to the OLD Supabase project:

```typescript
const EXTERNAL_URL = 'https://htsfxnuttobkdquxwvjj.supabase.co';  // OLD PROJECT
```

But you wanted to migrate to the NEW project:
```
https://ohrytohcbbkorivsuukm.supabase.co
```

---

## Solution Plan

### Step 1: Update Database Foreign Keys (SQL Migration)

Add `ON DELETE` behavior to foreign keys that reference products:

```sql
-- First, drop existing foreign key constraints
ALTER TABLE public.customer_products
DROP CONSTRAINT IF EXISTS customer_products_product_id_fkey;

ALTER TABLE public.delivery_items
DROP CONSTRAINT IF EXISTS delivery_items_product_id_fkey;

ALTER TABLE public.price_rules
DROP CONSTRAINT IF EXISTS price_rules_product_id_fkey;

-- Recreate with proper ON DELETE behavior
ALTER TABLE public.customer_products
ADD CONSTRAINT customer_products_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) 
ON DELETE CASCADE;

ALTER TABLE public.delivery_items
ADD CONSTRAINT delivery_items_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) 
ON DELETE CASCADE;

ALTER TABLE public.price_rules
ADD CONSTRAINT price_rules_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) 
ON DELETE SET NULL;
```

**Business Logic:**
- When a product is deleted, all customer subscriptions for that product are automatically removed (`CASCADE`)
- Delivery items for that product are removed (`CASCADE`)
- Price rules become unlinked but preserved (`SET NULL`)

---

### Step 2: Improve Products Page with Soft Delete + Checks

Update `src/pages/Products.tsx` to:

1. **Check for dependencies before deleting** - Show warning if product has active subscriptions
2. **Add soft delete option** - Set `is_active = false` instead of hard delete
3. **Show better error messages** - Parse foreign key errors and show user-friendly messages

```typescript
// Before deleting, check if product has active subscriptions
const checkProductDependencies = async (productId: string) => {
  const { count } = await supabase
    .from('customer_products')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);
  
  return count || 0;
};

// Offer soft delete as alternative
const handleSoftDelete = async (product: Product) => {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', product.id);
  // ...
};
```

---

### Step 3: Add RLS Policy for INSERT (WITH CHECK)

The current RLS policy uses `USING` which works for SELECT/UPDATE/DELETE but INSERT requires `WITH CHECK`:

```sql
-- Drop the FOR ALL policy and create specific ones
DROP POLICY IF EXISTS "Managers and admins can manage products" ON public.products;

-- SELECT policy for all authenticated users
CREATE POLICY "Staff can read products" ON public.products
  FOR SELECT USING (public.is_authenticated());

-- INSERT/UPDATE/DELETE for managers and admins
CREATE POLICY "Managers and admins can insert products" ON public.products
  FOR INSERT WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Managers and admins can update products" ON public.products
  FOR UPDATE USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Managers and admins can delete products" ON public.products
  FOR DELETE USING (public.is_manager_or_admin(auth.uid()));
```

---

### Step 4: Update External Supabase URL

Update `src/lib/external-supabase.ts` to use the new Supabase project:

```typescript
// Old
const EXTERNAL_URL = 'https://htsfxnuttobkdquxwvjj.supabase.co';

// New
const EXTERNAL_URL = 'https://ohrytohcbbkorivsuukm.supabase.co';
const EXTERNAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg';
```

---

### Step 5: Update EXTERNAL_SUPABASE_SCHEMA.sql

Update the schema file to include:
1. New foreign key constraints with `ON DELETE CASCADE`
2. Separate RLS policies for INSERT/UPDATE/DELETE
3. Update the dashboard URL comment

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/external-supabase.ts` | Update URL and anon key to new project |
| `src/pages/Products.tsx` | Add dependency check before delete, improve error handling, add soft delete option |
| `EXTERNAL_SUPABASE_SCHEMA.sql` | Update foreign key constraints, update RLS policies, update dashboard URL |

---

## SQL Changes Required (Run in External Supabase)

```sql
-- 1. Fix foreign key constraints
ALTER TABLE public.customer_products
DROP CONSTRAINT IF EXISTS customer_products_product_id_fkey;

ALTER TABLE public.customer_products
ADD CONSTRAINT customer_products_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) 
ON DELETE CASCADE;

ALTER TABLE public.delivery_items
DROP CONSTRAINT IF EXISTS delivery_items_product_id_fkey;

ALTER TABLE public.delivery_items
ADD CONSTRAINT delivery_items_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES public.products(id) 
ON DELETE CASCADE;

-- 2. Verify RLS is enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 3. Fix RLS policies (drop old, create specific ones)
DROP POLICY IF EXISTS "Managers and admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Staff can read products" ON public.products;

CREATE POLICY "Authenticated users can read products" ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can insert products" ON public.products
  FOR INSERT WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Managers can update products" ON public.products
  FOR UPDATE USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Managers can delete products" ON public.products
  FOR DELETE USING (public.is_manager_or_admin(auth.uid()));
```

---

## Manual Steps Required

1. **Run SQL in External Supabase SQL Editor:**
   - Go to: `https://supabase.com/dashboard/project/ohrytohcbbkorivsuukm/sql`
   - Run the SQL commands above

2. **Verify User Role:**
   - Check if your logged-in user has a record in `user_roles` table with `role = 'super_admin'` or `role = 'manager'`
   - If not, add one:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('your-user-uuid', 'super_admin');
   ```

---

## Summary

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Cannot delete products | Foreign key without `ON DELETE CASCADE` | Add `ON DELETE CASCADE` to foreign keys |
| Cannot add/edit products | RLS policy missing `WITH CHECK` for INSERT | Create separate INSERT policy with `WITH CHECK` |
| Wrong database | Old Supabase URL hardcoded | Update to new project URL and anon key |
