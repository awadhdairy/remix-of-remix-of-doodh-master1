# Awadh Dairy - Deployment Guide (Vercel + External Supabase)

Complete guide to deploy Awadh Dairy on Vercel (frontend) with External Supabase (backend).

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

## Quick Start

### 1. Apply Database Schema

Run in Supabase SQL Editor: `https://supabase.com/dashboard/project/ohrytohcbbkorivsuukm/sql`

Copy the entire contents of `EXTERNAL_SUPABASE_SCHEMA.sql` and execute.

### 2. Set Edge Function Secrets

```bash
# Install & login
npm install -g supabase
supabase login
supabase link --project-ref ohrytohcbbkorivsuukm

# Set secrets
supabase secrets set EXTERNAL_SUPABASE_URL=https://ohrytohcbbkorivsuukm.supabase.co
supabase secrets set EXTERNAL_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg
supabase secrets set EXTERNAL_SUPABASE_SERVICE_ROLE_KEY=sb_secret_r02XtTsjUcW-D5-MgiYyzg_gIP6ra8b
supabase secrets set BOOTSTRAP_ADMIN_PHONE=7897716792
supabase secrets set BOOTSTRAP_ADMIN_PIN=101101
```

### 3. Deploy Edge Functions

```bash
supabase functions deploy --project-ref ohrytohcbbkorivsuukm
```

Or individually:
```bash
supabase functions deploy auto-deliver-daily --project-ref ohrytohcbbkorivsuukm
supabase functions deploy change-pin --project-ref ohrytohcbbkorivsuukm
supabase functions deploy create-user --project-ref ohrytohcbbkorivsuukm
supabase functions deploy customer-auth --project-ref ohrytohcbbkorivsuukm
supabase functions deploy delete-user --project-ref ohrytohcbbkorivsuukm
supabase functions deploy health-check --project-ref ohrytohcbbkorivsuukm
supabase functions deploy reset-user-pin --project-ref ohrytohcbbkorivsuukm
supabase functions deploy setup-external-db --project-ref ohrytohcbbkorivsuukm
supabase functions deploy update-user-status --project-ref ohrytohcbbkorivsuukm
```

### 4. Bootstrap Admin

Option A - Via Edge Function:
```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db"
```

Option B - Via SQL:
```sql
SELECT bootstrap_super_admin('7897716792', '101101');
```

### 5. Configure Authentication

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
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg` |
| `VITE_SUPABASE_PROJECT_ID` | `ohrytohcbbkorivsuukm` |

### Build Settings

- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

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

### Edge Functions Not Working
- Ensure secrets are set via `supabase secrets set`
- Check function logs: `supabase functions logs <function-name>`

### CORS Errors
- Verify `awadhdairy-remix.vercel.app` is in ALLOWED_ORIGINS in `customer-auth/index.ts`

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

## Supabase Dashboard

https://supabase.com/dashboard/project/ohrytohcbbkorivsuukm
