# Awadh Dairy - Deployment Guide (Vercel + External Supabase)

Complete guide to deploy Awadh Dairy on Vercel (frontend) with External Supabase (backend).

**This project is 100% independent from Lovable Cloud after deployment.**

---

## Your Project Credentials

| Credential | Value |
|------------|-------|
| **Project URL** | `https://ohrytohcbbkorivsuukm.supabase.co` |
| **Project ID** | `ohrytohcbbkorivsuukm` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg` |
| **Vercel Domain** | `awadhdairy-remix.vercel.app` |
| **Admin Phone** | `7897716792` |
| **Admin PIN** | `101101` |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                 INDEPENDENT ARCHITECTURE                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Frontend (Vercel)                                           │
│       │                                                      │
│       ├──► Direct DB queries ──► YOUR Supabase               │
│       │                              ohrytohcbbkorivsuukm    │
│       │                                                      │
│       └──► Edge function calls ──► YOUR Supabase             │
│            (via EXTERNAL_FUNCTIONS_URL)                      │
│                      │                                       │
│                      ▼                                       │
│            Functions use built-in SUPABASE_* vars            │
│            (auto-provided by Supabase - no secrets needed)   │
│                                                              │
│  Lovable = NOT INVOLVED                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Apply Database Schema

Run in Supabase SQL Editor: `https://supabase.com/dashboard/project/ohrytohcbbkorivsuukm/sql`

Copy the entire contents of `EXTERNAL_SUPABASE_SCHEMA.sql` and execute.

### 2. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login and link to YOUR project
supabase login
supabase link --project-ref ohrytohcbbkorivsuukm

# Deploy all functions (they use built-in Supabase env vars)
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

### 3. Bootstrap Admin

After deploying functions, run:

```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db"
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

### 4. Configure Authentication

In Supabase Dashboard → Authentication → Settings:

- **Site URL**: `https://awadhdairy-remix.vercel.app`
- **Redirect URLs**:
  - `https://awadhdairy-remix.vercel.app/auth`
  - `https://awadhdairy-remix.vercel.app/customer/auth`
  - `https://awadhdairy-remix.vercel.app/customer/dashboard`

---

## Vercel Deployment

### Environment Variables

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://ohrytohcbbkorivsuukm.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg` |
| `VITE_SUPABASE_PROJECT_ID` | `ohrytohcbbkorivsuukm` |

### Build Settings

- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

---

## Edge Functions - No Secrets Required!

Edge functions now use Supabase's **built-in environment variables** which are automatically available:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your project URL (auto-provided) |
| `SUPABASE_ANON_KEY` | Anonymous key (auto-provided) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-provided) |

**No manual secret configuration needed!** When you deploy functions to your Supabase project, these variables are automatically available.

---

## Daily Automation (Optional)

### Option A: pg_cron in Supabase

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'auto-deliver-daily',
  '30 4 * * *',
  $$SELECT extensions.http_post(
    'https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/auto-deliver-daily',
    '{}',
    'application/json'
  )$$
);
```

### Option B: Manual Trigger

```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/auto-deliver-daily"
```

---

## Test Your Deployment

### Health Check
```bash
curl "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/health-check"
```

### Admin Login
1. Visit: `https://awadhdairy-remix.vercel.app/auth`
2. Enter: Phone `7897716792`, PIN `101101`
3. Dashboard should load

---

## Edge Function URLs

Base URL: `https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/`

| Function | URL |
|----------|-----|
| auto-deliver-daily | `/functions/v1/auto-deliver-daily` |
| change-pin | `/functions/v1/change-pin` |
| create-user | `/functions/v1/create-user` |
| customer-auth | `/functions/v1/customer-auth` |
| delete-user | `/functions/v1/delete-user` |
| health-check | `/functions/v1/health-check` |
| reset-user-pin | `/functions/v1/reset-user-pin` |
| setup-external-db | `/functions/v1/setup-external-db` |
| update-user-status | `/functions/v1/update-user-status` |

---

## Troubleshooting

### "Invalid API key" Error
- Verify environment variables in Vercel
- Redeploy after adding variables

### Edge Functions Return 500
- Check function logs: `supabase functions logs <function-name> --project-ref ohrytohcbbkorivsuukm`
- Ensure database schema is applied

### CORS Errors
- Verify your domain is in ALLOWED_ORIGINS in `customer-auth/index.ts`

---

## Backup & Restore

### Export Database
```bash
supabase db dump -f backup.sql --project-ref ohrytohcbbkorivsuukm
```

### Restore Database
```bash
supabase db push --project-ref ohrytohcbbkorivsuukm < backup.sql
```

---

## Key Differences from Previous Setup

| Aspect | Before | After |
|--------|--------|-------|
| Edge functions | Ran on Lovable Cloud | Run on YOUR Supabase |
| Secrets | Stored in Lovable | Auto-provided by Supabase |
| Service role key | Manual secret management | Automatic via `SUPABASE_SERVICE_ROLE_KEY` |
| Deployment | Lovable deployer | `supabase functions deploy` |
| Independence | Required Lovable | 100% independent |

---

## Supabase Dashboard

https://supabase.com/dashboard/project/ohrytohcbbkorivsuukm
