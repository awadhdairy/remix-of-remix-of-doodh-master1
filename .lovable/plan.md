
# Comprehensive Fix: Edge Function Deployment Failures

## Problem Summary

Your edge functions fail to deploy with "Exit 1" / "function folder is empty" error when running `supabase functions deploy --project-ref ohrytohcbbkorivsuukm`.

## Root Causes Identified

### 1. Inconsistent Import Patterns
Some functions use the modern `Deno.serve()` pattern (correct), while others use the deprecated `serve()` wrapper from `https://deno.land/std@0.168.0/http/server.ts` (outdated).

| Function | Pattern Used | Status |
|----------|--------------|--------|
| `auto-deliver-daily` | `Deno.serve()` | Correct |
| `health-check` | `Deno.serve()` | Correct |
| `create-user` | `Deno.serve()` | Correct |
| `change-pin` | `serve()` wrapper | Needs Update |
| `customer-auth` | `serve()` wrapper | Needs Update |
| `delete-user` | `serve()` wrapper | Needs Update |
| `reset-user-pin` | `serve()` wrapper | Needs Update |
| `setup-external-db` | `serve()` wrapper | Needs Update |
| `update-user-status` | `serve()` wrapper | Needs Update |

### 2. config.toml Project ID Mismatch
Current `supabase/config.toml`:
```toml
project_id = "oqekytjbenurwiwhivra"  # Lovable Cloud project
```

When deploying to external project `ohrytohcbbkorivsuukm`, this mismatch can cause issues.

### 3. Outdated std Library
The `https://deno.land/std@0.168.0/http/server.ts` version is deprecated. The modern Supabase Edge Runtime uses `Deno.serve()` natively without importing the serve function.

---

## Comprehensive Solution

### Phase 1: Update All Edge Functions to Modern Deno.serve() Pattern

Convert all 6 functions that use the old `serve()` pattern to use `Deno.serve()` directly.

**Pattern Change:**
```typescript
// OLD (deprecated - causes deployment failures)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
serve(async (req) => { ... })

// NEW (correct - works with current Supabase Edge Runtime)
Deno.serve(async (req) => { ... })
```

#### Files to Update:

1. **`supabase/functions/change-pin/index.ts`**
   - Remove: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`
   - Change: `serve(async (req) => {` to `Deno.serve(async (req) => {`

2. **`supabase/functions/customer-auth/index.ts`**
   - Remove: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`
   - Change: `serve(async (req) => {` to `Deno.serve(async (req) => {`

3. **`supabase/functions/delete-user/index.ts`**
   - Remove: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`
   - Change: `serve(async (req) => {` to `Deno.serve(async (req) => {`

4. **`supabase/functions/reset-user-pin/index.ts`**
   - Remove: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`
   - Change: `serve(async (req) => {` to `Deno.serve(async (req) => {`

5. **`supabase/functions/setup-external-db/index.ts`**
   - Remove: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`
   - Change: `serve(async (req) => {` to `Deno.serve(async (req) => {`

6. **`supabase/functions/update-user-status/index.ts`**
   - Remove: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"`
   - Change: `serve(async (req) => {` to `Deno.serve(async (req) => {`

### Phase 2: Update supabase/config.toml

Update the project_id to match your external Supabase project:

```toml
project_id = "ohrytohcbbkorivsuukm"
```

### Phase 3: Updated Deployment Commands

After the code changes, run these commands in sequence:

```bash
# Step 1: Navigate to your project root
cd /path/to/your/project

# Step 2: Link to external project (only needed once)
supabase link --project-ref ohrytohcbbkorivsuukm

# Step 3: Verify secrets are set
supabase secrets list --project-ref ohrytohcbbkorivsuukm

# Step 4: Deploy all functions
supabase functions deploy --project-ref ohrytohcbbkorivsuukm
```

If batch deploy fails, deploy individually:

```bash
supabase functions deploy auto-deliver-daily --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy change-pin --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy create-user --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy customer-auth --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy delete-user --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy health-check --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy reset-user-pin --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy setup-external-db --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy update-user-status --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
```

---

## Complete File Changes

### File 1: `supabase/config.toml`
```toml
project_id = "ohrytohcbbkorivsuukm"
```

### File 2: `supabase/functions/change-pin/index.ts`
Remove the serve import and use Deno.serve directly.

### File 3: `supabase/functions/customer-auth/index.ts`
Remove the serve import and use Deno.serve directly.

### File 4: `supabase/functions/delete-user/index.ts`
Remove the serve import and use Deno.serve directly.

### File 5: `supabase/functions/reset-user-pin/index.ts`
Remove the serve import and use Deno.serve directly.

### File 6: `supabase/functions/setup-external-db/index.ts`
Remove the serve import and use Deno.serve directly.

### File 7: `supabase/functions/update-user-status/index.ts`
Remove the serve import and use Deno.serve directly.

---

## Verification Steps After Deployment

### 1. Test Health Check
```bash
curl "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/health-check"
```
Expected: `{"status":"healthy",...}`

### 2. List Deployed Functions
```bash
supabase functions list --project-ref ohrytohcbbkorivsuukm
```
Should show all 9 functions.

### 3. Check Function Logs
```bash
supabase functions logs health-check --project-ref ohrytohcbbkorivsuukm
```

---

## Troubleshooting: If Still Failing

If deployment still fails after these changes, try:

1. **Clear Supabase CLI cache:**
```bash
rm -rf ~/.supabase
supabase login
supabase link --project-ref ohrytohcbbkorivsuukm
```

2. **Update Supabase CLI:**
```bash
npm update -g supabase
# or
brew upgrade supabase
```

3. **Check for deno.lock conflicts:**
```bash
rm -f deno.lock
rm -rf node_modules/.deno
```

4. **Verify function structure:**
Each function folder must have:
```text
supabase/functions/
  function-name/
    index.ts   # Required entry point
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/config.toml` | Update project_id to external Supabase |
| `change-pin/index.ts` | Remove `serve` import, use `Deno.serve()` |
| `customer-auth/index.ts` | Remove `serve` import, use `Deno.serve()` |
| `delete-user/index.ts` | Remove `serve` import, use `Deno.serve()` |
| `reset-user-pin/index.ts` | Remove `serve` import, use `Deno.serve()` |
| `setup-external-db/index.ts` | Remove `serve` import, use `Deno.serve()` |
| `update-user-status/index.ts` | Remove `serve` import, use `Deno.serve()` |

Total: 7 files to update
