

# Add Missing `verify_pin` Function to Codebase

## Summary

The `verify_pin` database function is missing from `EXTERNAL_SUPABASE_SCHEMA.sql`, causing the "Incorrect PIN" error during factory reset. This function is required by the `archive-old-data` edge function for PIN verification.

## Changes Required

### 1. Update `EXTERNAL_SUPABASE_SCHEMA.sql`

**Location:** Section 14: Authentication Functions (after line 738, before `staff_login`)

Add the `verify_pin` function:

```sql
-- Verify PIN for authentication (used by edge functions)
CREATE OR REPLACE FUNCTION public.verify_pin(_phone TEXT, _pin TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _user_id UUID;
  _locked_until TIMESTAMPTZ;
  _failed_count INTEGER;
BEGIN
  -- Check if account is locked
  SELECT locked_until, failed_count INTO _locked_until, _failed_count
  FROM public.auth_attempts WHERE phone = _phone;
  
  IF _locked_until IS NOT NULL AND _locked_until > NOW() THEN
    RAISE EXCEPTION 'Account temporarily locked. Try again later.';
  END IF;
  
  -- Verify PIN using pgcrypto
  SELECT id INTO _user_id
  FROM public.profiles
  WHERE phone = _phone
    AND pin_hash = crypt(_pin, pin_hash);
  
  IF _user_id IS NULL THEN
    -- Increment failed attempts
    INSERT INTO public.auth_attempts (phone, failed_count, last_attempt)
    VALUES (_phone, 1, NOW())
    ON CONFLICT (phone) DO UPDATE
    SET failed_count = auth_attempts.failed_count + 1,
        last_attempt = NOW(),
        locked_until = CASE
          WHEN auth_attempts.failed_count >= 4 THEN NOW() + INTERVAL '15 minutes'
          ELSE NULL
        END;
    RETURN NULL;
  ELSE
    -- Reset attempts on success
    DELETE FROM public.auth_attempts WHERE phone = _phone;
    RETURN _user_id;
  END IF;
END;
$$;
```

---

### 2. Update Edge Function Error Handling

**File:** `supabase/functions/archive-old-data/index.ts`

Update PIN verification to capture and log RPC errors (around line 275):

```typescript
// Before
const { data: verifiedUserId } = await supabaseAdmin.rpc("verify_pin", {...});

// After
const { data: verifiedUserId, error: verifyError } = await supabaseAdmin.rpc("verify_pin", {...});

if (verifyError) {
  console.error(`[ARCHIVE] PIN verification error: ${verifyError.message}`);
  if (verifyError.message.includes('locked')) {
    return Response with 429 "Account temporarily locked"
  }
  return Response with 500 "PIN verification failed: {error}"
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `EXTERNAL_SUPABASE_SCHEMA.sql` | Add `verify_pin` function after line 738 |
| `supabase/functions/archive-old-data/index.ts` | Add error capture for `verify_pin` RPC call |

---

## Immediate Action Required

After I apply the code changes, you must:

1. **Run the SQL on your external Supabase** (one-time fix for existing deployment):
   ```
   https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql
   ```

2. **Clear any lockouts**:
   ```sql
   DELETE FROM public.auth_attempts WHERE phone = '7897716792';
   ```

3. **Test the function**:
   ```sql
   SELECT public.verify_pin('7897716792', '101101');
   ```
   Should return a UUID.

4. **Pull changes and redeploy**:
   ```bash
   git pull origin main
   supabase functions deploy archive-old-data --no-verify-jwt
   ```

---

## Technical Details

- **Function Purpose:** Verifies staff PIN with brute-force protection (5 attempts → 15 min lockout)
- **Return Value:** Returns user UUID on success, NULL on wrong PIN
- **Raises Exception:** When account is locked
- **Security:** Uses `pgcrypto` extension for secure password hashing via `crypt()` function
- **Search Path:** Set to `'public', 'extensions'` to ensure `pgcrypto` functions are accessible

