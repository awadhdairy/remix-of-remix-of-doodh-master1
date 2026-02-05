

# Fix Foreign Key Cascade for Customer Deletion

## Problem Identified

When trying to delete a customer, the database throws:
```
update or delete on table "customers" violates foreign key constraint 
"customer_ledger_customer_id_fkey" on table "customer_ledger"
```

This is because **9 tables** reference `customers.id` without `ON DELETE CASCADE`, meaning the database prevents deleting a customer that has related records.

## Root Cause

The `EXTERNAL_SUPABASE_SCHEMA.sql` file is missing `ON DELETE CASCADE` on multiple foreign key constraints. The Lovable Cloud migrations have this configured correctly, but the external Supabase schema doesn't match.

## Tables Affected

| Table | Current FK Definition | Status |
|-------|----------------------|--------|
| `customer_products` | `REFERENCES customers(id) ON DELETE CASCADE` | ✅ OK |
| `customer_accounts` | `REFERENCES customers(id)` | ❌ Missing CASCADE |
| `customer_vacations` | `REFERENCES customers(id)` | ❌ Missing CASCADE |
| `customer_ledger` | `REFERENCES customers(id)` | ❌ Missing CASCADE |
| `deliveries` | `REFERENCES customers(id)` | ❌ Missing CASCADE |
| `route_stops` | `REFERENCES customers(id)` | ❌ Missing CASCADE |
| `invoices` | `REFERENCES customers(id)` | ❌ Missing CASCADE |
| `payments` | `REFERENCES customers(id)` | ❌ Missing CASCADE |
| `customer_bottles` | `REFERENCES customers(id)` | ❌ Missing CASCADE |
| `bottle_transactions` | `REFERENCES customers(id)` | ❌ Missing CASCADE |

## Solution

### Part 1: Update Schema File (Code Change)

Update `EXTERNAL_SUPABASE_SCHEMA.sql` to add `ON DELETE CASCADE` to all customer foreign keys:

```text
Line 236:
Before: customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id),
After:  customer_id UUID NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,

Line 283:
Before: customer_id UUID NOT NULL REFERENCES public.customers(id),
After:  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

Line 294:
Before: customer_id UUID NOT NULL REFERENCES public.customers(id),
After:  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

Line 312:
Before: customer_id UUID NOT NULL REFERENCES public.customers(id),
After:  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

Line 334:
Before: customer_id UUID NOT NULL REFERENCES public.customers(id),
After:  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

Line 348:
Before: customer_id UUID NOT NULL REFERENCES public.customers(id),
After:  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

Line 367:
Before: customer_id UUID NOT NULL REFERENCES public.customers(id),
After:  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

Line 551:
Before: customer_id UUID NOT NULL REFERENCES public.customers(id),
After:  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

Line 563:
Before: customer_id UUID REFERENCES public.customers(id),
After:  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
```

### Part 2: Fix Existing Database (Manual SQL)

Since the external database already exists, you need to **run migration SQL** to alter the existing foreign keys.

Add a new section in schema file or run this SQL directly on external Supabase:

```sql
-- Drop and recreate foreign keys with ON DELETE CASCADE

-- customer_accounts
ALTER TABLE public.customer_accounts 
  DROP CONSTRAINT IF EXISTS customer_accounts_customer_id_fkey,
  ADD CONSTRAINT customer_accounts_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- customer_vacations
ALTER TABLE public.customer_vacations 
  DROP CONSTRAINT IF EXISTS customer_vacations_customer_id_fkey,
  ADD CONSTRAINT customer_vacations_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- customer_ledger
ALTER TABLE public.customer_ledger 
  DROP CONSTRAINT IF EXISTS customer_ledger_customer_id_fkey,
  ADD CONSTRAINT customer_ledger_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- deliveries
ALTER TABLE public.deliveries 
  DROP CONSTRAINT IF EXISTS deliveries_customer_id_fkey,
  ADD CONSTRAINT deliveries_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- route_stops
ALTER TABLE public.route_stops 
  DROP CONSTRAINT IF EXISTS route_stops_customer_id_fkey,
  ADD CONSTRAINT route_stops_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- invoices
ALTER TABLE public.invoices 
  DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey,
  ADD CONSTRAINT invoices_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- payments
ALTER TABLE public.payments 
  DROP CONSTRAINT IF EXISTS payments_customer_id_fkey,
  ADD CONSTRAINT payments_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- customer_bottles
ALTER TABLE public.customer_bottles 
  DROP CONSTRAINT IF EXISTS customer_bottles_customer_id_fkey,
  ADD CONSTRAINT customer_bottles_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- bottle_transactions
ALTER TABLE public.bottle_transactions 
  DROP CONSTRAINT IF EXISTS bottle_transactions_customer_id_fkey,
  ADD CONSTRAINT bottle_transactions_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
```

---

## Implementation Summary

| Task | Location | Action |
|------|----------|--------|
| Update schema file | `EXTERNAL_SUPABASE_SCHEMA.sql` | Add `ON DELETE CASCADE` to 9 FK definitions |
| Add migration section | End of `EXTERNAL_SUPABASE_SCHEMA.sql` | Add ALTER TABLE statements for existing DBs |
| Fix live database | External Supabase SQL Editor | Run the ALTER TABLE SQL above |

---

## Behavior After Fix

When a customer is deleted:
- All their ledger entries will be automatically deleted
- All their deliveries and delivery items will be automatically deleted
- All their invoices and payments will be automatically deleted
- All their vacation records will be automatically deleted
- All their bottle records will be automatically deleted
- All their account records will be automatically deleted
- All their route stops will be automatically deleted

This is the expected behavior for maintaining referential integrity.

