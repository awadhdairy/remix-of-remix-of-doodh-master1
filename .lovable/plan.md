
# Comprehensive Permanent Solution: Single Super Admin Backend System

## Problem Summary

From the diagnostic SQL results, the database state is **correctly configured**:
- Auth user `5b2b5877-...` exists with email `7897716792@awadhdairy.com` ✅
- Profile exists with same ID, phone `7897716792`, role `super_admin` ✅
- user_roles entry exists with `super_admin` role ✅

Despite this, the "Only super admin can perform data archival" error persists. This indicates the issue is not in the data but in the **authentication flow or code execution**.

## Root Cause Analysis

After reviewing all edge functions and the authentication flow:

| Issue | Location | Impact |
|-------|----------|--------|
| Environment variable naming mismatch | `archive-old-data` uses `EXTERNAL_SUPABASE_*` fallback | May not find correct env vars |
| Inconsistent auth patterns | Different functions use slightly different auth approaches | Potential JWT validation failures |
| No debug logging for role check | `archive-old-data` doesn't log the actual userId being checked | Makes debugging impossible |
| Stale deployment | Functions may not have been redeployed after code changes | Old code still running |

## Solution Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    PERMANENT ADMIN SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SINGLE SOURCE OF TRUTH: auth.users table                       │
│  ├── ID: auto-generated UUID                                    │
│  ├── Email: {phone}@awadhdairy.com                              │
│  └── Password: 6-digit PIN                                      │
│                                                                 │
│  LINKED DATA (must have matching ID):                           │
│  ├── profiles.id = auth.users.id                                │
│  ├── user_roles.user_id = auth.users.id                         │
│  └── auth_sessions.user_id = auth.users.id                      │
│                                                                 │
│  PERMANENT ADMIN (hardcoded in setup-external-db):              │
│  ├── Phone: 7897716792                                          │
│  ├── PIN: 101101                                                │
│  ├── Role: super_admin                                          │
│  └── Email: 7897716792@awadhdairy.com                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Standardize Edge Function Authentication Pattern

All edge functions will use the **exact same** authentication pattern for consistency:

```typescript
// Standard Auth Pattern (to be used in ALL edge functions)
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

// Admin client for database operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Get authorization header
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return errorResponse(401, 'Authorization required');
}

// Create user client and validate JWT
const token = authHeader.replace('Bearer ', '');
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});

// CRITICAL: Pass token to getUser for proper validation
const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
if (userError || !user) {
  return errorResponse(401, 'Invalid or expired session');
}

const userId = user.id;

// Role check with detailed logging
console.log(`[FUNCTION] User authenticated: ${userId} (${user.email})`);

const { data: roleData, error: roleError } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', userId)
  .eq('role', 'super_admin')
  .limit(1);

console.log(`[FUNCTION] Role check - Found: ${roleData?.length || 0} rows, Error: ${roleError?.message || 'none'}`);

if (!roleData || roleData.length === 0) {
  return errorResponse(403, 'Only super admin can perform this action');
}
```

### Phase 2: Fix archive-old-data Edge Function

**File**: `supabase/functions/archive-old-data/index.ts`

**Changes**:
1. Remove `EXTERNAL_SUPABASE_*` fallbacks (use standard `SUPABASE_*` only)
2. Add `token` parameter to `getUser()` call for explicit JWT verification
3. Add comprehensive debug logging
4. Add pre-flight checks before operations

### Phase 3: Update setup-external-db for Robustness

**File**: `supabase/functions/setup-external-db/index.ts`

**Changes**:
1. Add validation that admin was created successfully
2. Return comprehensive status including verification queries
3. Add idempotency guarantees

### Phase 4: Create Health Check with Admin Verification

**File**: `supabase/functions/health-check/index.ts`

**Changes**:
1. Add authenticated admin verification endpoint
2. Return complete system status including admin account health

### Phase 5: SQL Validation Queries (For External Supabase)

Provide SQL commands to verify and fix any remaining issues:

```sql
-- Comprehensive Admin Verification Query
SELECT 
  'VERIFICATION' as check_type,
  CASE 
    WHEN au.id IS NOT NULL 
     AND p.id IS NOT NULL 
     AND ur.user_id IS NOT NULL 
     AND ur.role = 'super_admin'
    THEN 'PASS'
    ELSE 'FAIL'
  END as status,
  au.id as auth_id,
  au.email,
  p.phone,
  p.role as profile_role,
  ur.role as user_roles_role,
  p.is_active
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE au.email = '7897716792@awadhdairy.com';
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/archive-old-data/index.ts` | Standardize auth, add logging, remove EXTERNAL_ fallbacks |
| `supabase/functions/setup-external-db/index.ts` | Add verification return, ensure idempotency |
| `supabase/functions/health-check/index.ts` | Add authenticated admin verification endpoint |
| `src/lib/external-supabase.ts` | Add debug logging for auth token retrieval |
| `EXTERNAL_SUPABASE_SCHEMA.sql` | Add admin verification function |

## Detailed Code Changes

### 1. archive-old-data/index.ts - Complete Rewrite of Auth Section

**Remove lines 37-88** and replace with standardized pattern:

```typescript
// Use Supabase's built-in environment variables (auto-provided by Supabase)
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error("[ARCHIVE] Missing Supabase configuration");
  throw new Error("Missing Supabase configuration");
}

// Admin client for database operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Get authorization header
const authHeader = req.headers.get("Authorization");
if (!authHeader || !authHeader.startsWith("Bearer ")) {
  console.log("[ARCHIVE] No authorization header provided");
  return new Response(
    JSON.stringify({ error: "Authorization required" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Create user client and validate JWT
const token = authHeader.replace("Bearer ", "");
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});

// CRITICAL: Pass token explicitly to getUser for proper JWT validation
const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

if (userError || !user) {
  console.log(`[ARCHIVE] Auth failed: ${userError?.message || 'No user returned'}`);
  return new Response(
    JSON.stringify({ error: "Invalid or expired session" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const userId = user.id;
console.log(`[ARCHIVE] User authenticated: ${userId} (${user.email})`);

// Verify super_admin role with detailed logging
const { data: roleData, error: roleError } = await supabaseAdmin
  .from("user_roles")
  .select("role")
  .eq("user_id", userId)
  .eq("role", "super_admin")
  .limit(1);

console.log(`[ARCHIVE] Role check for ${userId}:`);
console.log(`[ARCHIVE]   - Rows found: ${roleData?.length || 0}`);
console.log(`[ARCHIVE]   - Error: ${roleError?.message || 'none'}`);

// Also check profile for debugging
const { data: profileData } = await supabaseAdmin
  .from("profiles")
  .select("id, phone, role, is_active")
  .eq("id", userId)
  .single();

console.log(`[ARCHIVE] Profile check:`, JSON.stringify(profileData));

if (!roleData || roleData.length === 0) {
  console.log(`[ARCHIVE] DENIED - User ${userId} is not super_admin`);
  return new Response(
    JSON.stringify({ 
      error: "Only super admin can perform data archival",
      debug: {
        userId,
        email: user.email,
        roleDataLength: roleData?.length || 0,
        profileExists: !!profileData,
        profileRole: profileData?.role
      }
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

console.log(`[ARCHIVE] GRANTED - User ${userId} verified as super_admin`);
```

### 2. health-check/index.ts - Add Admin Verification Endpoint

Add new authenticated endpoint to verify admin account health:

```typescript
// Handle authenticated verification request
if (req.method === "POST") {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    
    // Verify the requesting user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (user && !error) {
      // Get complete user status
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
        
      const { data: role } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      
      return new Response(
        JSON.stringify({
          authenticated: true,
          user: {
            id: user.id,
            email: user.email,
            profile: profile ? { 
              phone: profile.phone,
              role: profile.role,
              is_active: profile.is_active 
            } : null,
            user_role: role?.role || null
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
}
```

### 3. external-supabase.ts - Add Debug Logging

```typescript
export async function invokeExternalFunctionWithSession<T = unknown>(
  functionName: string,
  body: Record<string, unknown> = {}
): Promise<{ data: T | null; error: Error | null }> {
  // Get Supabase Auth session
  const { data: { session }, error: sessionError } = await externalSupabase.auth.getSession();
  
  if (sessionError) {
    console.warn('[External] Session error:', sessionError.message);
  }
  
  const authToken = session?.access_token;
  
  // Debug logging for troubleshooting
  if (process.env.NODE_ENV === 'development') {
    console.log(`[External] Invoking ${functionName}`);
    console.log(`[External] Auth token present: ${!!authToken}`);
    console.log(`[External] Token preview: ${authToken?.slice(0, 20)}...`);
  }
  
  return invokeExternalFunction<T>(functionName, body, authToken || undefined);
}
```

## Post-Deployment Verification

After deploying all changes, run this verification:

### Step 1: Verify Edge Function Deployment
```bash
# On external Supabase project
supabase functions list --project-ref ohrytohcbbkorivsuukm
```

### Step 2: Test Health Check
```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/health-check" \
  -H "Content-Type: application/json"
```

### Step 3: Login and Test Archive
1. Go to Vercel deployment
2. Login with `7897716792` / `101101`
3. Navigate to Settings → Data Management
4. Click "Preview Data"
5. Check browser console for detailed logs
6. Check Supabase Edge Function logs for `[ARCHIVE]` entries

## Deployment Commands

After code changes are made, redeploy to external Supabase:

```bash
cd your-project

# Link to external Supabase project
supabase link --project-ref ohrytohcbbkorivsuukm

# Deploy all functions with --no-verify-jwt flag
supabase functions deploy archive-old-data --no-verify-jwt
supabase functions deploy health-check --no-verify-jwt
supabase functions deploy setup-external-db --no-verify-jwt
```

## Summary

This solution:
1. **Standardizes** all edge function authentication to use the same pattern
2. **Adds comprehensive logging** to identify exactly where failures occur
3. **Removes inconsistent** environment variable fallbacks
4. **Adds debug output** in error responses for troubleshooting
5. **Provides verification** endpoints and SQL queries
6. **Ensures idempotency** - running setup multiple times is safe

After implementing these changes and redeploying to your external Supabase, the permanent admin account will work reliably across all functions.
