
# Comprehensive Fix for 401 Unauthorized Error in Archive Edge Function

## Root Cause Analysis

After thorough investigation comparing the failing `archive-old-data` function with the working `delete-user` function, I identified **two critical issues**:

### Issue 1: Wrong Key Used for Supabase Client

**`archive-old-data` (broken):**
```typescript
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});
```

**`delete-user` (working):**
```typescript
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: authHeader } }
});
```

The `archive-old-data` function uses the **anon key** for the user verification client, but `auth.getUser(token)` works more reliably when using the **service role key** with explicit auth options disabled.

### Issue 2: Missing Auth Configuration Options

The `archive-old-data` function is missing the critical auth configuration:
```typescript
auth: {
  autoRefreshToken: false,
  persistSession: false,
}
```

These options ensure the Supabase client doesn't attempt to manage sessions internally, which can conflict with manual JWT verification.

### Issue 3: Frontend Session Token May Be Stale

The frontend's `invokeExternalFunctionWithSession` only uses `getSession()` which reads from cache. If the cached token is expired, the edge function will reject it with 401.

---

## Solution

### Change 1: Fix Edge Function Client Configuration

**File:** `supabase/functions/archive-old-data/index.ts`

Update lines 66-70 to match the working pattern from `delete-user`:

```text
Before (Lines 66-70):
  const token = authHeader.replace("Bearer ", "");
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

After:
  const token = authHeader.replace("Bearer ", "");
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
```

---

### Change 2: Improve Frontend Token Handling

**File:** `src/lib/external-supabase.ts`

Update `invokeExternalFunctionWithSession` to refresh the session if the token is missing or potentially stale:

```text
Before (Lines 103-121):
  export async function invokeExternalFunctionWithSession<T = unknown>(
    functionName: string,
    body: Record<string, unknown> = {}
  ): Promise<{ data: T | null; error: Error | null }> {
    const { data: { session }, error: sessionError } = await externalSupabase.auth.getSession();
    
    if (sessionError) {
      console.warn('Session error:', sessionError.message);
    }
    
    const authToken = session?.access_token;
    
    if (!authToken) {
      console.warn(`No auth token available for ${functionName}`);
    }
    
    return invokeExternalFunction<T>(functionName, body, authToken || undefined);
  }

After:
  export async function invokeExternalFunctionWithSession<T = unknown>(
    functionName: string,
    body: Record<string, unknown> = {}
  ): Promise<{ data: T | null; error: Error | null }> {
    // Try getSession first (cached token)
    let { data: { session } } = await externalSupabase.auth.getSession();
    
    // If no token, try refreshing the session
    if (!session?.access_token) {
      console.log(`[${functionName}] No cached token, attempting refresh...`);
      const { data: refreshData, error: refreshError } = await externalSupabase.auth.refreshSession();
      if (refreshError) {
        console.warn(`[${functionName}] Session refresh failed:`, refreshError.message);
      }
      session = refreshData.session;
    }
    
    const authToken = session?.access_token;
    
    if (!authToken) {
      console.warn(`[${functionName}] No auth token available - user may need to login`);
      return {
        data: null,
        error: new Error('Authentication required. Please login again.')
      };
    }
    
    console.log(`[${functionName}] Calling with auth token (expires: ${session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'unknown'})`);
    return invokeExternalFunction<T>(functionName, body, authToken);
  }
```

---

## Technical Summary

| Component | Current Issue | Fix |
|-----------|---------------|-----|
| Edge function client | Uses `supabaseAnonKey` | Use `supabaseServiceKey` |
| Edge function auth config | Missing options | Add `autoRefreshToken: false, persistSession: false` |
| Frontend token logic | Only uses cached `getSession()` | Add `refreshSession()` fallback |

---

## Deployment Steps

After approval and code changes:

1. **Re-deploy the edge function** to your external Supabase:
   ```bash
   supabase link --project-ref iupmzocmmjxpeabkmzri
   supabase functions deploy archive-old-data
   ```

2. **Test the factory reset:**
   - Log out and log back in to ensure a fresh session
   - Navigate to Settings → Data Management
   - Select "Factory Reset" and click "Preview Data"
   - The 401 error should be resolved

---

## Why This Works

1. **Service Role Key**: When verifying JWTs via `getUser(token)`, using the service role key provides elevated privileges that don't hit RLS restrictions during the verification process.

2. **Disabled Auth Options**: Setting `autoRefreshToken: false` and `persistSession: false` prevents the Supabase client from trying to manage the session itself, which can cause conflicts with manual JWT handling.

3. **Session Refresh**: Adding a `refreshSession()` fallback ensures that even if the cached token is expired, a fresh one is obtained before calling the edge function.

This matches the exact pattern used in other working edge functions like `delete-user`, `update-user-status`, and `create-user`.
