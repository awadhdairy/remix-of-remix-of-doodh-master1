
# Complete Migration Plan: Lovable Cloud → External Supabase + Vercel

## Your New Supabase Credentials

| Item | Value |
|------|-------|
| **Project URL** | `https://iupmzocmmjxpeabkmzri.supabase.co` |
| **Project ID** | `iupmzocmmjxpeabkmzri` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cG16b2NtbWp4cGVhYmttenJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNjAyNjYsImV4cCI6MjA4NTgzNjI2Nn0.UH-Y9FgzjErzJ_MWvkKaZEp8gfSbB1fuoJ_JuMLPEK8` |
| **Service Role** | `sb_secret__Gawy8t5Fxf1l4ZHRqEHRA_kntvL5i0` |

---

## What I Will Update (Code Changes)

### 1. `src/lib/external-supabase.ts`
- Remove hardcoded fallback URLs pointing to old project
- Use only environment variables with your new credentials
- Remove excessive debug logging for production

### 2. `.env.example`
- Update with your new project credentials
- Clear documentation for Vercel setup

### 3. `DEPLOYMENT_GUIDE.md`
- Complete rewrite with your new project ID
- Step-by-step instructions for your specific setup

### 4. `supabase/functions/customer-auth/index.ts`
- Update ALLOWED_ORIGINS to include your Vercel domain

### 5. Create `VERCEL_ENV_VARS.md`
- Ready-to-copy environment variables for Vercel

---

## What You Will Do (Manual Steps)

### Step 1: Apply Database Schema

1. Go to your Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql
   ```

2. Copy the entire contents of `EXTERNAL_SUPABASE_SCHEMA.sql`

3. Paste and click "Run"

This creates all 30+ tables, enums, functions, and RLS policies.

### Step 2: Deploy Edge Functions

Run these commands in your project directory:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to YOUR project
supabase link --project-ref iupmzocmmjxpeabkmzri

# Deploy all 10 edge functions
supabase functions deploy archive-old-data --no-verify-jwt
supabase functions deploy auto-deliver-daily --no-verify-jwt
supabase functions deploy change-pin --no-verify-jwt
supabase functions deploy create-user --no-verify-jwt
supabase functions deploy customer-auth --no-verify-jwt
supabase functions deploy delete-user --no-verify-jwt
supabase functions deploy health-check --no-verify-jwt
supabase functions deploy reset-user-pin --no-verify-jwt
supabase functions deploy setup-external-db --no-verify-jwt
supabase functions deploy update-user-status --no-verify-jwt
```

### Step 3: Bootstrap Admin Account

After functions are deployed, run:

```bash
curl -X POST "https://iupmzocmmjxpeabkmzri.supabase.co/functions/v1/setup-external-db"
```

Expected response:
```json
{
  "success": true,
  "message": "Database setup complete",
  "admin_id": "uuid-here",
  "admin_phone": "7897716792",
  "data_seeded": true
}
```

### Step 4: Configure Supabase Authentication

In Supabase Dashboard > Authentication > Settings:

1. **Site URL**: `https://your-vercel-domain.vercel.app`
2. **Redirect URLs** (add all):
   - `https://your-vercel-domain.vercel.app/auth`
   - `https://your-vercel-domain.vercel.app/customer/auth`
   - `https://your-vercel-domain.vercel.app/customer/dashboard`
   - `http://localhost:5173/auth` (for local development)

### Step 5: Vercel Deployment

1. Push your code to GitHub

2. In Vercel Dashboard > Project Settings > Environment Variables, add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://iupmzocmmjxpeabkmzri.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cG16b2NtbWp4cGVhYmttenJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNjAyNjYsImV4cCI6MjA4NTgzNjI2Nn0.UH-Y9FgzjErzJ_MWvkKaZEp8gfSbB1fuoJ_JuMLPEK8` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | (same as ANON_KEY) |
| `VITE_SUPABASE_PROJECT_ID` | `iupmzocmmjxpeabkmzri` |

3. Build Settings:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. Deploy!

### Step 6: Verify Deployment

1. Health Check:
```bash
curl "https://iupmzocmmjxpeabkmzri.supabase.co/functions/v1/health-check"
```

2. Admin Login:
   - URL: `https://your-vercel-domain.vercel.app/auth`
   - Phone: `7897716792`
   - PIN: `101101`

---

## Architecture After Migration

```text
+--------------------------------------------------------------+
|              100% INDEPENDENT ARCHITECTURE                    |
+--------------------------------------------------------------+
|                                                              |
|  Vercel (Frontend)                                           |
|       |                                                      |
|       +---> Database Queries ---> YOUR Supabase              |
|       |     (iupmzocmmjxpeabkmzri)                          |
|       |                                                      |
|       +---> Edge Functions ---> YOUR Supabase                |
|             /functions/v1/*                                  |
|                                                              |
|  Supabase Edge Functions use BUILT-IN env vars:              |
|    - SUPABASE_URL (auto-provided)                           |
|    - SUPABASE_ANON_KEY (auto-provided)                      |
|    - SUPABASE_SERVICE_ROLE_KEY (auto-provided)              |
|                                                              |
|  Lovable Cloud: ZERO INVOLVEMENT                            |
|                                                              |
+--------------------------------------------------------------+
```

---

## Files Summary

| File | Action |
|------|--------|
| `src/lib/external-supabase.ts` | Update - remove hardcoded fallbacks |
| `.env.example` | Update - your new credentials |
| `DEPLOYMENT_GUIDE.md` | Rewrite - complete guide for your project |
| `supabase/functions/customer-auth/index.ts` | Update - add your Vercel domain |
| `VERCEL_ENV_VARS.md` | Create - ready-to-copy env vars |

---

## Success Criteria

After completing this migration:

1. All database operations go to `iupmzocmmjxpeabkmzri.supabase.co`
2. All Edge Functions run on your Supabase project
3. All authentication uses your Supabase Auth
4. The app works 100% on Vercel + your Supabase
5. No requests go to Lovable Cloud
6. You can fully disconnect from Lovable

---

## Default Admin Credentials

| Item | Value |
|------|-------|
| Phone | `7897716792` |
| PIN | `101101` |

These are hardcoded in the setup function and will be your initial super admin login.
