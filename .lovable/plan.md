

# Complete Customer Portal Implementation Plan

## Executive Summary

The Customer Portal already exists with most modules implemented. However, there are critical gaps in the authentication flow and admin approval workflow that need to be addressed. This plan enhances the existing implementation to meet all requirements.

---

## Current State Analysis

| Module | Status | Gap |
|--------|--------|-----|
| Customer Auth (`/customer/auth`) | Exists | Missing default PIN (000000) for existing customers |
| Customer Dashboard (`/customer/dashboard`) | Exists | Minor UI enhancements needed |
| Customer Subscription (`/customer/subscription`) | Exists | Complete |
| Customer Products (`/customer/products`) | Exists | Complete |
| Customer Deliveries (`/customer/deliveries`) | Exists | Complete |
| Customer Billing (`/customer/billing`) | Exists | Complete |
| Customer Profile (`/customer/profile`) | Exists | Complete |
| Admin Approval Flow | Partial | Need prominent approval UI in admin portal |

---

## Implementation Tasks

### Task 1: Enhance Customer Auth Edge Function

**File: `supabase/functions/customer-auth/index.ts`**

Update the login action to support **default PIN (000000)** for existing customers whose phone number is in the `customers` table but who haven't registered yet:

**Logic Flow:**
```text
1. User enters phone + PIN
2. Check if customer_account exists for this phone:
   a. YES: Verify PIN against stored hash
   b. NO: Check if customer exists in customers table with this phone
      - If YES and PIN is "000000":
        → Auto-create customer_account with default PIN
        → Auto-approve account
        → Create auth user
        → Return session
      - If NO: Return "Invalid credentials"
3. Proceed with normal login flow
```

**Code Changes:**
- Add new case in `login` action to detect existing customers without accounts
- Auto-create approved customer_account with hashed PIN
- Use a constant `DEFAULT_CUSTOMER_PIN = "000000"` for first-time login

---

### Task 2: Update Database Function for Default PIN Support

**New SQL Function: `auto_approve_existing_customer`**

Add to `EXTERNAL_SUPABASE_SCHEMA.sql`:

```sql
CREATE OR REPLACE FUNCTION public.auto_create_customer_account_if_exists(
  _phone TEXT,
  _pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _customer RECORD;
  _existing_account RECORD;
BEGIN
  -- Check if account already exists
  SELECT * INTO _existing_account FROM customer_accounts WHERE phone = _phone;
  IF _existing_account IS NOT NULL THEN
    RETURN json_build_object('exists', true, 'has_account', true);
  END IF;
  
  -- Check if customer exists with this phone (pre-registered by admin)
  SELECT * INTO _customer FROM customers WHERE phone = _phone AND is_active = true;
  
  IF _customer IS NOT NULL THEN
    -- Create auto-approved account with provided PIN
    INSERT INTO customer_accounts (
      customer_id, phone, pin_hash, is_approved, approval_status
    ) VALUES (
      _customer.id, 
      _phone, 
      crypt(_pin, gen_salt('bf')), 
      true, 
      'approved'
    );
    
    RETURN json_build_object(
      'exists', true,
      'has_account', false,
      'auto_created', true,
      'customer_id', _customer.id,
      'customer_name', _customer.name
    );
  END IF;
  
  RETURN json_build_object('exists', false);
END;
$$;
```

---

### Task 3: Add Customer Approvals to Admin Dashboard

**File: `src/pages/Dashboard.tsx`**

Add the `CustomerAccountApprovals` component prominently at the top of the admin dashboard (visible only to super_admin and manager roles).

```typescript
// At top of Dashboard component
import { CustomerAccountApprovals } from "@/components/customers/CustomerAccountApprovals";
import { useUserRole } from "@/hooks/useUserRole";

// Inside render, before other cards
const { role } = useUserRole();
const isAdmin = role === 'super_admin' || role === 'manager';

{isAdmin && <CustomerAccountApprovals />}
```

---

### Task 4: Add Approvals Tab to Customers Page

**File: `src/pages/Customers.tsx`**

Ensure the "Pending Approvals" section is visible at the top of the Customers page for admin/manager users.

The `CustomerAccountApprovals` component already exists and is imported but may not be prominently displayed. Verify it's shown at the top of the page.

---

### Task 5: Update CustomerAuth.tsx UI

**File: `src/pages/customer/CustomerAuth.tsx`**

Add informational text about default PIN for existing customers:

```text
In the login tab, add a note:
"If you're an existing customer, use PIN 000000 for first-time login"
```

---

### Task 6: Ensure Complete Backend Connectivity

**Verification Checklist:**

| Component | Backend Table | Status |
|-----------|---------------|--------|
| CustomerDashboard | customers, customer_products, deliveries, customer_vacations | Connected |
| CustomerSubscription | customer_products, products, customer_vacations | Connected |
| CustomerProducts | products, customer_products | Connected |
| CustomerDeliveries | deliveries, delivery_items, products | Connected |
| CustomerBilling | invoices, customer_ledger, dairy_settings | Connected |
| CustomerProfile | customers, customer_accounts | Connected |
| CustomerAuth | customer_accounts, customers (via edge function) | Needs update |

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/customer-auth/index.ts` | Modify | Add default PIN login for existing customers |
| `EXTERNAL_SUPABASE_SCHEMA.sql` | Modify | Add auto_create_customer_account_if_exists function |
| `src/pages/Dashboard.tsx` | Modify | Add CustomerAccountApprovals for admins |
| `src/pages/Customers.tsx` | Verify | Ensure approvals are visible |
| `src/pages/customer/CustomerAuth.tsx` | Modify | Add default PIN hint text |

---

## Edge Function Update Details

### Modified Login Flow

```text
case 'login':
  1. Validate phone (10 digits) and PIN (6 digits)
  
  2. Check for existing customer_account:
     → If found: verify PIN, check approval status
     → If not found: continue to step 3
  
  3. Check if customer exists in customers table:
     → If found AND PIN === "000000":
        - Auto-create customer_account (approved)
        - Create auth user
        - Return session (login success)
     → If found AND PIN !== "000000":
        - Return error: "Use PIN 000000 for first login"
     → If not found:
        - Return error: "Invalid credentials"
  
  4. Generate session and return
```

---

## Security Considerations

1. **Default PIN is single-use**: After first login with 000000, the PIN is stored hashed and user must use that PIN going forward (or change it)

2. **Only existing customers can use default PIN**: The phone must already exist in the `customers` table (added by admin)

3. **New registrations still require approval**: Users whose phone is NOT in the customers table still go through the approval flow

4. **PIN is hashed immediately**: The 000000 is never stored in plain text

---

## Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Existing customer (phone in DB) logs in with 000000 | Auto-creates account, logs in |
| Existing customer logs in with wrong PIN | Error: "Invalid PIN" or "Use 000000 for first login" |
| Existing customer with account logs in with correct PIN | Normal login |
| New phone number registers | Creates pending account, shows approval message |
| Admin approves pending account | Customer can now login |
| Customer changes PIN in profile | New PIN works for future logins |

---

## Manual SQL to Run

After code deployment, run this on external Supabase SQL Editor:

```sql
-- Add auto-create customer account function
CREATE OR REPLACE FUNCTION public.auto_create_customer_account_if_exists(
  _phone TEXT,
  _pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _customer RECORD;
  _existing_account RECORD;
BEGIN
  SELECT * INTO _existing_account FROM customer_accounts WHERE phone = _phone;
  IF _existing_account IS NOT NULL THEN
    RETURN json_build_object('exists', true, 'has_account', true);
  END IF;
  
  SELECT * INTO _customer FROM customers WHERE phone = _phone AND is_active = true;
  
  IF _customer IS NOT NULL THEN
    INSERT INTO customer_accounts (
      customer_id, phone, pin_hash, is_approved, approval_status
    ) VALUES (
      _customer.id, 
      _phone, 
      crypt(_pin, gen_salt('bf')), 
      true, 
      'approved'
    );
    
    RETURN json_build_object(
      'exists', true,
      'has_account', false,
      'auto_created', true,
      'customer_id', _customer.id,
      'customer_name', _customer.name
    );
  END IF;
  
  RETURN json_build_object('exists', false);
END;
$$;
```

---

## Summary

This implementation:
1. Allows existing customers (added by admin) to login directly with default PIN 000000
2. Auto-approves and creates their account on first login
3. New customers still go through registration + admin approval
4. Adds prominent approval UI in admin dashboard
5. Maintains complete database connectivity for all customer modules

