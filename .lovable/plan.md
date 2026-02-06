

# Fix Customer Portal Authentication Errors - Complete Root Cause Analysis

## Error Summary from Screenshots

| Screenshot | Error | Root Cause |
|------------|-------|------------|
| Screenshot_127.png | `Could not find the function public.verify_customer_pin(_phone, _pin) in the schema cache` | **Missing SQL function** - `verify_customer_pin` not deployed to external Supabase |
| Screenshot_128.png | `duplicate key value violates unique constraint "customer_accounts_phone_key"` | **Registration logic flaw** - trying to insert when account already exists |
| Screenshot_126-2.png | `Function call failed with status 401` | **Edge function not deployed** or JWT verification failing |

---

## Root Cause #1: Missing SQL Functions

The edge function `customer-auth` calls these database functions via RPC:
- `verify_customer_pin(_phone, _pin)` ❌ **NOT in EXTERNAL_SUPABASE_SCHEMA.sql or CUSTOMER_PORTAL_SQL.sql**
- `update_customer_pin(_customer_id, _current_pin, _new_pin)` ❌ **NOT in deployment scripts**
- `register_customer_account(_phone, _pin)` ⚠️ **Exists but missing duplicate check fix**
- `hash_pin_for_customer(_pin)` ✅ Exists

**Impact**: Login always fails because the PIN verification function doesn't exist.

---

## Root Cause #2: Registration Doesn't Handle Existing Accounts Properly

The `register_customer_account` function returns an error when an account exists, but doesn't provide a path to "update" the existing account's PIN if the customer re-registers.

**Current Behavior**:
1. Customer registers with phone 9999999998, PIN 123456 → Account created (pending or approved)
2. Customer clicks Register again with same phone, different PIN → **Error: "duplicate key"**

**Expected Behavior**:
- If customer already has a pending/approved account, return helpful message
- Self-registered PIN should be the only valid PIN (overriding any default logic)

---

## Root Cause #3: Default PIN vs Self-Registered PIN Logic

**Current Logic in Edge Function** (lines 169-248):
```
if (existingAccount) {
  // Has account → verify via verify_customer_pin() RPC
} else {
  // No account → check if customer exists, use default PIN 000000
}
```

**Problem**: The logic is correct, but since `verify_customer_pin` doesn't exist, all logins with existing accounts fail.

---

## Solution Overview

### Fix 1: Add Missing SQL Functions to CUSTOMER_PORTAL_SQL.sql

Add these functions that the edge function depends on:

**A. `verify_customer_pin`** - Verifies PIN against stored hash, handles lockouts

**B. `update_customer_pin`** - Allows customers to change their PIN

**C. Update `register_customer_account`** - Better error messages for existing accounts

### Fix 2: Improve Registration Logic in register_customer_account

When an account already exists:
- If approved: Return "Account exists. Please login instead."
- If pending: Return "Account pending approval. Please wait."
- Do NOT try to insert duplicate

### Fix 3: Update CUSTOMER_PORTAL_SQL.sql with Complete Functions

---

## Files to Modify

| File | Changes |
|------|---------|
| `CUSTOMER_PORTAL_SQL.sql` | Add `verify_customer_pin`, `update_customer_pin`, improve error handling |
| `supabase/functions/customer-auth/index.ts` | Better error messages for duplicate accounts |

---

## SQL Functions to Add

### 1. verify_customer_pin (CRITICAL - Missing)

```sql
CREATE OR REPLACE FUNCTION public.verify_customer_pin(_phone TEXT, _pin TEXT)
RETURNS TABLE(customer_id UUID, user_id UUID, is_approved BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    _locked_until TIMESTAMPTZ;
    _account RECORD;
BEGIN
    -- Check if account is locked
    SELECT locked_until INTO _locked_until
    FROM public.customer_auth_attempts WHERE phone = _phone;
    
    IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
        RAISE EXCEPTION 'Account temporarily locked. Try again later.';
    END IF;
    
    -- Verify PIN using bcrypt
    SELECT ca.customer_id, ca.user_id, ca.is_approved 
    INTO _account
    FROM public.customer_accounts ca
    WHERE ca.phone = _phone
      AND ca.pin_hash = crypt(_pin, ca.pin_hash);
    
    IF _account IS NULL THEN
        -- Record failed attempt
        INSERT INTO public.customer_auth_attempts (phone, failed_count, last_attempt)
        VALUES (_phone, 1, NOW())
        ON CONFLICT (phone) DO UPDATE
        SET failed_count = customer_auth_attempts.failed_count + 1,
            last_attempt = NOW(),
            locked_until = CASE
                WHEN customer_auth_attempts.failed_count >= 4 THEN NOW() + INTERVAL '15 minutes'
                ELSE NULL
            END;
        RETURN;
    ELSE
        -- Clear failed attempts on success
        DELETE FROM public.customer_auth_attempts WHERE phone = _phone;
        UPDATE public.customer_accounts SET last_login = NOW() WHERE phone = _phone;
        RETURN QUERY SELECT _account.customer_id, _account.user_id, _account.is_approved;
    END IF;
END;
$$;
```

### 2. update_customer_pin

```sql
CREATE OR REPLACE FUNCTION public.update_customer_pin(
    _customer_id UUID, 
    _current_pin TEXT, 
    _new_pin TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    _account RECORD;
BEGIN
    -- Validate new PIN format
    IF NOT (_new_pin ~ '^\d{6}$') THEN
        RETURN json_build_object('success', false, 'error', 'New PIN must be 6 digits');
    END IF;

    -- Verify current PIN
    SELECT * INTO _account 
    FROM public.customer_accounts 
    WHERE customer_id = _customer_id 
      AND pin_hash = crypt(_current_pin, pin_hash);
    
    IF _account IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Current PIN is incorrect');
    END IF;
    
    -- Update to new PIN
    UPDATE public.customer_accounts 
    SET pin_hash = crypt(_new_pin, gen_salt('bf')), updated_at = NOW()
    WHERE customer_id = _customer_id;
    
    RETURN json_build_object('success', true, 'message', 'PIN updated successfully');
END;
$$;
```

### 3. Improved register_customer_account (Replace Existing)

```sql
CREATE OR REPLACE FUNCTION public.register_customer_account(_phone TEXT, _pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _customer RECORD;
  _existing_account RECORD;
  _new_customer_id UUID;
BEGIN
  -- Validate PIN format
  IF NOT (_pin ~ '^\d{6}$') THEN
    RETURN json_build_object('success', false, 'error', 'PIN must be 6 digits');
  END IF;
  
  -- Validate phone format
  IF NOT (_phone ~ '^\d{10}$') THEN
    RETURN json_build_object('success', false, 'error', 'Phone must be 10 digits');
  END IF;

  -- Check if account already exists
  SELECT ca.*, c.name as customer_name 
  INTO _existing_account 
  FROM public.customer_accounts ca
  JOIN public.customers c ON c.id = ca.customer_id
  WHERE ca.phone = _phone;
  
  IF _existing_account IS NOT NULL THEN
    -- Account already exists - guide user appropriately
    IF _existing_account.is_approved THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'Account already exists. Please login with your PIN.',
        'has_account', true,
        'is_approved', true
      );
    ELSE
      RETURN json_build_object(
        'success', false, 
        'error', 'Account pending approval. Please wait for admin to approve.',
        'has_account', true,
        'is_approved', false,
        'pending', true
      );
    END IF;
  END IF;
  
  -- Check if existing customer with this phone (pre-registered by admin)
  SELECT * INTO _customer FROM public.customers WHERE phone = _phone AND is_active = true;
  
  IF _customer IS NOT NULL THEN
    -- Existing customer - auto-approve with user's chosen PIN
    INSERT INTO public.customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
    VALUES (_customer.id, _phone, crypt(_pin, gen_salt('bf')), true, 'approved');
    
    RETURN json_build_object(
      'success', true, 
      'approved', true, 
      'message', 'Account created and auto-approved. You can now login with your PIN.',
      'customer_id', _customer.id
    );
  ELSE
    -- New customer - create pending account
    _new_customer_id := gen_random_uuid();
    
    INSERT INTO public.customers (id, name, phone, is_active)
    VALUES (_new_customer_id, 'Pending Registration', _phone, false);
    
    INSERT INTO public.customer_accounts (customer_id, phone, pin_hash, is_approved, approval_status)
    VALUES (_new_customer_id, _phone, crypt(_pin, gen_salt('bf')), false, 'pending');
    
    RETURN json_build_object(
      'success', true, 
      'approved', false, 
      'message', 'Account created. Pending admin approval.',
      'customer_id', _new_customer_id
    );
  END IF;
END;
$$;
```

---

## Edge Function Updates

### Improve error handling in customer-auth/index.ts

Line 91-98: When registration returns an error about existing account, surface it better:

```typescript
if (error) {
  console.error('Registration error:', error);
  // Check if it's a duplicate key error
  if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An account with this phone number already exists. Please login instead.',
        has_account: true
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  return new Response(
    JSON.stringify({ success: false, error: error.message }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## Complete Updated CUSTOMER_PORTAL_SQL.sql

The file will contain all required functions:
1. `hash_pin_for_customer` ✅
2. `verify_customer_pin` ✅ (NEW)
3. `update_customer_pin` ✅ (NEW)  
4. `register_customer_account` ✅ (IMPROVED)
5. `auto_create_customer_account_if_exists` ✅

---

## Deployment Steps After Code Changes

1. **Run Updated SQL**: Execute new `CUSTOMER_PORTAL_SQL.sql` in external Supabase SQL Editor
2. **Redeploy Edge Function**: `supabase functions deploy customer-auth --project-ref iupmzocmmjxpeabkmzri --no-verify-jwt`
3. **Clear Test Data** (if needed): 
   ```sql
   DELETE FROM customer_auth_attempts WHERE phone = '9999999998';
   DELETE FROM customer_accounts WHERE phone = '9999999998';
   ```

---

## Flow After Fix

### Scenario 1: Admin-Added Customer First Login
1. Admin adds customer with phone 9876543210
2. Customer goes to portal, enters phone + PIN `000000`
3. System auto-creates account with PIN 000000 (hashed)
4. Customer logs in successfully
5. Customer should change PIN in profile

### Scenario 2: Self-Registration (New Customer)
1. Customer registers with phone 9999999999, PIN 123456
2. System creates pending account
3. Admin approves in dashboard
4. Customer logs in with PIN 123456

### Scenario 3: Self-Registration (Existing Customer in DB)
1. Admin has already added customer phone 9876543210
2. Customer registers with that phone + PIN 654321
3. System auto-approves and uses PIN 654321 (NOT 000000)
4. Customer logs in with PIN 654321

### Scenario 4: Already Registered - Try to Register Again
1. Customer with account tries to register again
2. System returns: "Account already exists. Please login."
3. No duplicate error

---

## Summary

| Issue | Root Cause | Solution |
|-------|------------|----------|
| verify_customer_pin not found | Function missing from SQL | Add to CUSTOMER_PORTAL_SQL.sql |
| Duplicate key error | No check before insert | Improve register_customer_account to return helpful message |
| 401 error | Edge function not deployed | Redeploy with --no-verify-jwt |
| Default PIN override | Already correct in code | No change needed (self-registered PIN is used) |

