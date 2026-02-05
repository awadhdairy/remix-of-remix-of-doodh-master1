

# Fix Archive Edge Function for External Supabase Deployment

## Problem Diagnosis

The `archive-old-data` edge function was modified to use custom environment variables (`EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`) which works only in Lovable Cloud where you configured that secret. However, when deployed to your **external Supabase project**, these custom secrets don't exist.

**Key Insight**: When an edge function runs on Supabase, it automatically has access to built-in environment variables:
- `SUPABASE_URL` → Points to THAT Supabase project
- `SUPABASE_ANON_KEY` → The anon key for THAT project  
- `SUPABASE_SERVICE_ROLE_KEY` → The service role key for THAT project

Since you deployed `archive-old-data` to your external Supabase (`iupmzocmmjxpeabkmzri`), these built-in vars automatically point to your external project - no custom secrets needed!

---

## Solution: Simplify Edge Function to Use Built-in Variables

### File: `supabase/functions/archive-old-data/index.ts`

**Before (Lines 48-69):**
```typescript
const EXTERNAL_URL = "https://iupmzocmmjxpeabkmzri.supabase.co";
const EXTERNAL_ANON_KEY = "eyJhbGciOiJIUz...";

const externalServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

if (!externalServiceKey) {
  console.error("[ARCHIVE] Missing EXTERNAL_SUPABASE_SERVICE_ROLE_KEY secret");
  return new Response(
    JSON.stringify({ 
      error: "Server configuration error - missing external database credentials",
      hint: "Set EXTERNAL_SUPABASE_SERVICE_ROLE_KEY in Lovable Cloud secrets"
    }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

const supabaseUrl = EXTERNAL_URL;
const supabaseServiceKey = externalServiceKey;
const supabaseAnonKey = EXTERNAL_ANON_KEY;
```

**After:**
```typescript
// Use Supabase's built-in environment variables
// These are automatically provided when deployed to any Supabase project
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error("[ARCHIVE] Missing Supabase configuration");
  return new Response(
    JSON.stringify({ error: "Server configuration error" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## Technical Details

| Aspect | Before (Broken) | After (Fixed) |
|--------|-----------------|---------------|
| URL Source | Hardcoded external URL | `SUPABASE_URL` (auto-provided) |
| Service Key | Custom `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` secret | Built-in `SUPABASE_SERVICE_ROLE_KEY` |
| Anon Key | Hardcoded external anon key | `SUPABASE_ANON_KEY` (auto-provided) |
| Works on External Supabase? | ❌ No (missing secret) | ✅ Yes |
| Works on Lovable Cloud? | ✅ Yes (if secret set) | ✅ Yes |

---

## Deployment Steps (After Approval)

1. **Update the code** - Modify `archive-old-data/index.ts` to use built-in Supabase environment variables

2. **Re-deploy to external Supabase** - Run these commands:
   ```bash
   supabase login
   supabase link --project-ref iupmzocmmjxpeabkmzri
   supabase functions deploy archive-old-data
   ```

3. **Test the factory reset** - The function will now correctly use the external project's service role key

---

## Why This Works

When you run `supabase functions deploy archive-old-data` to your external project:

- `SUPABASE_URL` = `https://iupmzocmmjxpeabkmzri.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = Your external project's service role key
- `SUPABASE_ANON_KEY` = Your external project's anon key

These are injected by Supabase runtime automatically - no manual secret configuration needed!

---

## Consistency Check

All other edge functions already use this pattern correctly:
- ✅ `auto-deliver-daily` - Uses built-in vars
- ✅ `change-pin` - Uses built-in vars  
- ✅ `create-user` - Uses built-in vars
- ✅ `customer-auth` - Uses built-in vars
- ❌ `archive-old-data` - Uses custom vars **(needs fix)**

