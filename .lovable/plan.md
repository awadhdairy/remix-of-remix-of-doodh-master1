
# Fix: Align archive-old-data Edge Function with Supabase Auth

## Problem Summary

The `archive-old-data` edge function uses a **custom session token** system (`auth_sessions` table) for authentication, but your app uses **Supabase Auth** (JWT tokens). This mismatch causes "Invalid or expired session" errors.

## Root Cause

| Component | Current Behavior |
|-----------|-----------------|
| `Auth.tsx` | Uses `supabase.auth.signInWithPassword()` - creates Supabase JWT |
| `invokeExternalFunctionWithSession` | Sends Supabase JWT as Bearer token |
| `archive-old-data` function | Expects custom `session_token` from `auth_sessions` table |
| **Result** | JWT ≠ session_token → "Invalid or expired session" |

## Solution

Update `archive-old-data` edge function to use **Supabase Auth JWT validation** (same as `create-user`, `change-pin`, `delete-user`), not the custom `auth_sessions` table.

## Files to Modify

| File | Action |
|------|--------|
| `supabase/functions/archive-old-data/index.ts` | Replace custom session validation with Supabase Auth JWT validation |

## Implementation Details

### Before (Lines 46-71)
```typescript
// Get authorization header
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(JSON.stringify({ error: "Authorization required" }), ...);
}

// Validate session via custom auth_sessions table ❌
const token = authHeader.replace("Bearer ", "");
const { data: sessionData } = await supabase
  .from("auth_sessions")
  .select("user_id, user_type")
  .eq("session_token", token)
  .gt("expires_at", new Date().toISOString())
  .limit(1);

if (!sessionData || sessionData.length === 0) {
  return new Response(JSON.stringify({ error: "Invalid or expired session" }), ...);
}
const userId = sessionData[0].user_id;
```

### After (Using Supabase Auth like other functions)
```typescript
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Get authorization header
const authHeader = req.headers.get("Authorization");
if (!authHeader) {
  return new Response(JSON.stringify({ error: "Authorization required" }), ...);
}

// Validate via Supabase Auth JWT ✅
const token = authHeader.replace("Bearer ", "");
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});

const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
if (userError || !user) {
  return new Response(JSON.stringify({ error: "Invalid or expired session" }), ...);
}

const userId = user.id;
```

## Updated Edge Function Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                    archive-old-data Function                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Get Authorization header (Bearer token)                       │
│                          ↓                                       │
│ 2. Create Supabase client with user's JWT                        │
│    supabaseClient = createClient(url, anonKey, {Authorization})  │
│                          ↓                                       │
│ 3. Validate JWT: supabaseClient.auth.getUser()                   │
│    ✓ Returns user object with id                                 │
│                          ↓                                       │
│ 4. Check super_admin role in user_roles table                    │
│    (using service role client)                                   │
│                          ↓                                       │
│ 5. Process archive request (preview/export/execute)              │
└─────────────────────────────────────────────────────────────────┘
```

## Complete Code Changes

Replace lines 36-71 in `archive-old-data/index.ts` with:

```typescript
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration");
}

// Admin client for database operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Get authorization header
const authHeader = req.headers.get("Authorization");
if (!authHeader || !authHeader.startsWith("Bearer ")) {
  return new Response(
    JSON.stringify({ error: "Authorization required" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Validate via Supabase Auth JWT
const token = authHeader.replace("Bearer ", "");
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});

const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
if (userError || !user) {
  console.log(`[ARCHIVE] Auth failed: ${userError?.message}`);
  return new Response(
    JSON.stringify({ error: "Invalid or expired session" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const userId = user.id;

// Verify super_admin role (server-side check using admin client)
const { data: roleData } = await supabaseAdmin
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .eq("role", "super_admin")
  .limit(1);
```

## Also Update PIN Verification (Lines 220-248)

Replace the PIN verification logic that uses `verify_pin` with user's phone to work with the user ID directly:

```typescript
// Get user's phone for PIN verification
const { data: userProfile } = await supabaseAdmin
  .from("profiles")
  .select("phone")
  .eq("id", userId)
  .single();

if (!userProfile?.phone) {
  return new Response(
    JSON.stringify({ error: "User profile not found" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const { data: verifiedUserId } = await supabaseAdmin.rpc("verify_pin", {
  _phone: userProfile.phone,
  _pin: pin,
});

if (!verifiedUserId || verifiedUserId !== userId) {
  return new Response(
    JSON.stringify({ error: "Incorrect PIN" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

## Deployment After Fix

After updating the code, redeploy to external Supabase:

```bash
supabase functions deploy archive-old-data --no-verify-jwt --project-ref ohrytohcbbkorivsuukm
```

## Testing Checklist

1. Login as super_admin on Vercel deployment
2. Navigate to Settings → Data Management
3. Select retention period (e.g., 1 Year)
4. Click "Preview Data" - should show record counts ✅
5. Click "Export Backup" - should download Excel ✅
6. Enter PIN and confirm deletion - should work ✅

## Summary

The fix aligns `archive-old-data` with the same Supabase Auth JWT validation pattern used by all other edge functions (`create-user`, `change-pin`, `delete-user`, etc.). This ensures consistent authentication across the entire application.
