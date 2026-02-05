# Awadh Dairy - Complete Deployment Guide

**100% Independent: Vercel (Frontend) + Supabase (Backend)**

No Lovable Cloud dependency. Full control of your own infrastructure.

---

## 📋 Project Credentials

| Item | Value |
|------|-------|
| **Project URL** | `https://iupmzocmmjxpeabkmzri.supabase.co` |
| **Project ID** | `iupmzocmmjxpeabkmzri` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cG16b2NtbWp4cGVhYmttenJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNjAyNjYsImV4cCI6MjA4NTgzNjI2Nn0.UH-Y9FgzjErzJ_MWvkKaZEp8gfSbB1fuoJ_JuMLPEK8` |
| **Admin Phone** | `7897716792` |
| **Admin PIN** | `101101` |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│           100% INDEPENDENT ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  VERCEL (Frontend)                                          │
│       │                                                     │
│       ├──► Database Queries ──► YOUR SUPABASE               │
│       │    (via VITE_SUPABASE_URL)    (iupmzocmmjxpeabkmzri)│
│       │                                                     │
│       └──► Edge Functions ──► YOUR SUPABASE                 │
│            /functions/v1/*                                  │
│                                                             │
│  Edge Functions use BUILT-IN env vars (auto-provided):      │
│    • SUPABASE_URL                                           │
│    • SUPABASE_ANON_KEY                                      │
│    • SUPABASE_SERVICE_ROLE_KEY                              │
│                                                             │
│  NO LOVABLE CLOUD INVOLVEMENT                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Step 1: Apply Database Schema

1. Open Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql
   ```

2. Copy the **entire contents** of `EXTERNAL_SUPABASE_SCHEMA.sql`

3. Paste into the SQL Editor and click **Run**

This creates all tables, enums, functions, triggers, and RLS policies.

---

## 🔧 Step 2: Deploy Edge Functions

Run these commands in your terminal (from project directory):

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref iupmzocmmjxpeabkmzri

# Deploy all edge functions
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

---

## 👤 Step 3: Bootstrap Admin Account

After functions are deployed, create the initial admin:

```bash
curl -X POST "https://iupmzocmmjxpeabkmzri.supabase.co/functions/v1/setup-external-db"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Database setup complete",
  "admin_id": "uuid-here",
  "admin_phone": "7897716792",
  "data_seeded": true
}
```

---

## 🔐 Step 4: Configure Supabase Authentication

Go to **Supabase Dashboard → Authentication → URL Configuration**:

1. **Site URL**: `https://YOUR-VERCEL-DOMAIN.vercel.app`

2. **Redirect URLs** (add all):
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/auth`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/customer/auth`
   - `https://YOUR-VERCEL-DOMAIN.vercel.app/customer/dashboard`
   - `http://localhost:5173/auth` (for local development)

---

## 🌐 Step 5: Deploy to Vercel

### 5.1 Environment Variables

In **Vercel Dashboard → Project Settings → Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://iupmzocmmjxpeabkmzri.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cG16b2NtbWp4cGVhYmttenJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNjAyNjYsImV4cCI6MjA4NTgzNjI2Nn0.UH-Y9FgzjErzJ_MWvkKaZEp8gfSbB1fuoJ_JuMLPEK8` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(same as ANON_KEY above)* |
| `VITE_SUPABASE_PROJECT_ID` | `iupmzocmmjxpeabkmzri` |

### 5.2 Build Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### 5.3 Deploy

Push to GitHub → Vercel auto-deploys on commit.

---

## ✅ Step 6: Verify Deployment

### Health Check
```bash
curl "https://iupmzocmmjxpeabkmzri.supabase.co/functions/v1/health-check"
```

### Admin Login Test
1. Visit: `https://YOUR-VERCEL-DOMAIN.vercel.app/auth`
2. Enter Phone: `7897716792`
3. Enter PIN: `101101`
4. Dashboard should load

---

## 📌 Edge Function URLs

Base URL: `https://iupmzocmmjxpeabkmzri.supabase.co/functions/v1/`

| Function | Endpoint |
|----------|----------|
| archive-old-data | `/functions/v1/archive-old-data` |
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

## ⏰ Optional: Daily Automation (pg_cron)

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule auto-delivery at 4:30 AM IST daily
SELECT cron.schedule(
  'auto-deliver-daily',
  '30 4 * * *',
  $$SELECT extensions.http_post(
    'https://iupmzocmmjxpeabkmzri.supabase.co/functions/v1/auto-deliver-daily',
    '{}',
    'application/json'
  )$$
);
```

---

## 🔍 Troubleshooting

### "Invalid API key" Error
- Verify Vercel environment variables are set correctly
- Redeploy after adding/updating variables

### Edge Functions Return 500
- Check logs: `supabase functions logs <function-name> --project-ref iupmzocmmjxpeabkmzri`
- Verify database schema is applied

### CORS Errors
- Add your Vercel domain to `ALLOWED_ORIGINS` in `supabase/functions/customer-auth/index.ts`
- Redeploy the function

### Login Not Working
- Ensure `setup-external-db` function was called successfully
- Check if profiles and user_roles tables have data

---

## 💾 Backup & Restore

### Export Database
```bash
supabase db dump -f backup.sql --project-ref iupmzocmmjxpeabkmzri
```

### Restore Database
```bash
supabase db push --project-ref iupmzocmmjxpeabkmzri < backup.sql
```

---

## 🔗 Quick Links

- **Supabase Dashboard**: https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri
- **SQL Editor**: https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/sql
- **Edge Functions**: https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/functions
- **Authentication Settings**: https://supabase.com/dashboard/project/iupmzocmmjxpeabkmzri/auth/url-configuration
