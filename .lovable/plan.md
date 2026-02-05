
# Fix: "CREATE ROUTE" Blank Screen - Complete Diagnosis & Solution

## Problem Summary

The "CREATE ROUTE" (Routes page) shows a blank screen because **you cannot authenticate**. The authentication fails because the **Lovable preview environment is still pointing to the OLD Supabase project** (`yxejlcrckdabxuvidgje`) instead of your NEW external project (`iupmzocmmjxpeabkmzri`).

---

## Root Cause Analysis

### What's Happening

```text
User tries to login
        │
        ▼
Auth request goes to: https://yxejlcrckdabxuvidgje.supabase.co  ← WRONG PROJECT!
        │
        ▼
"Invalid credentials" (user doesn't exist in old project)
        │
        ▼
User stuck on /auth page → Can't access /routes
```

### Evidence from Network Request

```text
Request: POST https://yxejlcrckdabxuvidgje.supabase.co/auth/v1/token
Status: 400
Response: {"code":"invalid_credentials","message":"Invalid login credentials"}
```

The app is calling `yxejlcrckdabxuvidgje` (Lovable Cloud) but your admin user exists in `iupmzocmmjxpeabkmzri` (your NEW project).

---

## Current State

| Component | Status | Details |
|-----------|--------|---------|
| **Code Migration** | ✅ Complete | All 50+ files use `externalSupabase` |
| **Routes.tsx** | ✅ Correct | Uses external-supabase, no bugs |
| **DataTable.tsx** | ✅ Correct | No issues found |
| **Database Schema** | ⚠️ Unknown | Needs to be applied to NEW project |
| **Edge Functions** | ⚠️ Unknown | Needs to be deployed to NEW project |
| **Admin User** | ⚠️ Unknown | Needs to be bootstrapped |
| **Environment Variables** | ❌ Wrong | Still points to old project |

---

## The Real Issue: Where to Set Environment Variables

The `.env` file in Lovable preview is **auto-generated** by Lovable Cloud and cannot be manually edited. However, I found that you have **secrets configured** that we can update:

**Current Secrets:**
- `EXTERNAL_SUPABASE_URL`
- `EXTERNAL_SUPABASE_ANON_KEY`
- `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`
- `BOOTSTRAP_ADMIN_PHONE`
- `BOOTSTRAP_ADMIN_PIN`

---

## Solution: Two-Path Approach

### Path A: Fix in Lovable Preview (For Testing)

1. **Update the `external-supabase.ts` to prioritize secrets**
   - Check for `EXTERNAL_SUPABASE_URL` secret first
   - Fall back to `VITE_SUPABASE_URL` if not set

2. **Update secrets** to point to your NEW project:
   - `EXTERNAL_SUPABASE_URL` → `https://iupmzocmmjxpeabkmzri.supabase.co`
   - `EXTERNAL_SUPABASE_ANON_KEY` → Your new anon key

### Path B: Deploy to Vercel (Production - Recommended)

Complete the migration steps that haven't been done yet:

1. **Apply Database Schema** to new Supabase project
2. **Deploy Edge Functions** to new Supabase project
3. **Bootstrap Admin User** in new project
4. **Configure Vercel** with correct environment variables
5. **Deploy to Vercel**

---

## Detailed Implementation Plan

### Step 1: Modify `src/lib/external-supabase.ts`

Update to check for secrets first, then fall back to VITE env vars:

```typescript
// Priority order:
// 1. Edge function environment (Deno.env)
// 2. EXTERNAL_SUPABASE_* secrets (for Lovable preview)
// 3. VITE_SUPABASE_* env vars (for Vercel deployment)

const EXTERNAL_URL = 
  import.meta.env.EXTERNAL_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_URL;

const EXTERNAL_ANON_KEY = 
  import.meta.env.EXTERNAL_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

### Step 2: Verify Your External Supabase Setup

Before fixing the code, confirm these have been done:

| Task | Command/Action |
|------|----------------|
| **1. Apply Schema** | Run `EXTERNAL_SUPABASE_SCHEMA.sql` in Supabase SQL Editor |
| **2. Deploy Functions** | `supabase link --project-ref iupmzocmmjxpeabkmzri` then deploy all 10 functions |
| **3. Bootstrap Admin** | `curl -X POST "https://iupmzocmmjxpeabkmzri.supabase.co/functions/v1/setup-external-db"` |

### Step 3: Code Changes Required

**File: `src/lib/external-supabase.ts`**

- Update environment variable resolution to support both Lovable secrets and Vercel env vars
- Add clear logging for debugging which URL is being used
- Ensure graceful fallback

---

## Why Routes Page Shows Blank

The Routes page itself has **no bugs**. The blank screen occurs because:

1. User is **not authenticated**
2. `DashboardLayout` checks for session
3. No valid session → Redirects to `/auth`
4. User never reaches `/routes` at all

**Proof**: The Routes page code correctly:
- Imports `externalSupabase`
- Has proper loading states
- Has proper error handling
- Has working CRUD operations

---

## Complete Migration Checklist

For your reference, here's what needs to be done for 100% independence:

| # | Task | Status | How to Complete |
|---|------|--------|-----------------|
| 1 | Create Supabase Project | ✅ Done | `iupmzocmmjxpeabkmzri` exists |
| 2 | Apply Database Schema | ❓ Check | Run `EXTERNAL_SUPABASE_SCHEMA.sql` in SQL Editor |
| 3 | Deploy Edge Functions | ❓ Check | Run `supabase functions deploy` for all 10 functions |
| 4 | Bootstrap Admin | ❓ Check | POST to `setup-external-db` function |
| 5 | Configure Supabase Auth | ❓ Check | Add Vercel URL to redirect URLs |
| 6 | Update Code | ✅ Done | All files use external-supabase |
| 7 | Configure Vercel | ❌ Pending | Set environment variables |
| 8 | Deploy to Vercel | ❌ Pending | Push and deploy |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/external-supabase.ts` | Update env var resolution to support secrets |

---

## Expected Outcome

After implementing this fix:

1. **In Lovable Preview**: Once secrets are correctly pointing to your new project, authentication will work
2. **In Vercel Production**: With correct VITE_SUPABASE_* env vars, everything works
3. **Routes Page**: Will load correctly once authenticated
4. **CREATE ROUTE**: Dialog will open and routes can be created

---

## Immediate Next Steps

1. **I will update** `src/lib/external-supabase.ts` to properly resolve environment variables
2. **You should verify** that your NEW Supabase project has:
   - Database schema applied ✓
   - Edge functions deployed ✓
   - Admin user bootstrapped ✓
3. **You should update** the secrets in Lovable to point to your NEW project (if testing in Lovable preview)
4. **You should configure** Vercel with correct environment variables and deploy (for production)
