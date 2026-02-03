
# Complete Migration Plan: Lovable Cloud to External Supabase

## Your Credentials (Confirmed)

| Credential | Value |
|------------|-------|
| **Project URL** | `https://ohrytohcbbkorivsuukm.supabase.co` |
| **Anon Key** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg` |
| **Service Role Key** | `sb_secret_r02XtTsjUcW-D5-MgiYyzg_gIP6ra8b` |
| **Admin Phone** | `7897716792` |
| **Admin PIN** | `101101` |
| **Vercel Domain** | `awadhdairy-remix.vercel.app` |

---

## Phase 1: Apply Database Schema

Run this in your **External Supabase SQL Editor**:
`https://supabase.com/dashboard/project/ohrytohcbbkorivsuukm/sql`

Copy the entire contents of `EXTERNAL_SUPABASE_SCHEMA.sql` and execute it.

---

## Phase 2: Set Edge Function Secrets (CLI Commands)

Open terminal and run these commands exactly:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your external project
supabase link --project-ref ohrytohcbbkorivsuukm

# Set all required secrets
supabase secrets set EXTERNAL_SUPABASE_URL=https://ohrytohcbbkorivsuukm.supabase.co

supabase secrets set EXTERNAL_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg

supabase secrets set EXTERNAL_SUPABASE_SERVICE_ROLE_KEY=sb_secret_r02XtTsjUcW-D5-MgiYyzg_gIP6ra8b

supabase secrets set BOOTSTRAP_ADMIN_PHONE=7897716792

supabase secrets set BOOTSTRAP_ADMIN_PIN=101101
```

---

## Phase 3: Deploy All 9 Edge Functions

Run these commands to deploy each function to your external Supabase:

```bash
# Deploy all edge functions
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

Or deploy all at once:
```bash
supabase functions deploy --project-ref ohrytohcbbkorivsuukm
```

---

## Phase 4: Code Changes Required

### File 1: `.env.example` (Update with your credentials)

```env
# External Supabase Configuration (Production Database)
VITE_SUPABASE_URL=https://ohrytohcbbkorivsuukm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg
VITE_SUPABASE_PROJECT_ID=ohrytohcbbkorivsuukm
```

### File 2: `supabase/functions/customer-auth/index.ts` (Add Vercel domain)

Update lines 10-16 to include your Vercel domain:

```typescript
const ALLOWED_ORIGINS = [
  'https://awadhdairy-remix.vercel.app',
  'https://awadhd.lovable.app',
  'https://id-preview--0e2105bf-7600-40c7-b696-88cb152c3e30.lovable.app',
  'https://id-preview--c9769607-a092-45ff-8257-44be40434034.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
```

### File 3: `DEPLOYMENT_GUIDE.md` (Update with your credentials)

Update the deployment guide with your specific credentials for future reference.

---

## Phase 5: Vercel Deployment

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Complete migration to external Supabase"
git push origin main
```

### Step 2: Create Vercel Project
1. Go to https://vercel.com
2. Import your GitHub repository
3. Configure:
   - **Framework**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3: Set Environment Variables in Vercel

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://ohrytohcbbkorivsuukm.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg` |
| `VITE_SUPABASE_PROJECT_ID` | `ohrytohcbbkorivsuukm` |

---

## Phase 6: Bootstrap Admin & Seed Data

### Option A: Run Setup Edge Function

```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db"
```

This will:
- Create super admin with phone `7897716792` and PIN `101101`
- Seed dummy data (products, customers, cattle, etc.)

### Option B: Bootstrap via SQL

Run in Supabase SQL Editor:
```sql
SELECT bootstrap_super_admin('7897716792', '101101');
```

---

## Phase 7: Configure Authentication

In Supabase Dashboard → Authentication → Settings:

1. **Site URL**: `https://awadhdairy-remix.vercel.app`
2. **Redirect URLs**: Add:
   - `https://awadhdairy-remix.vercel.app/auth`
   - `https://awadhdairy-remix.vercel.app/customer/auth`
   - `https://awadhdairy-remix.vercel.app/customer/dashboard`

---

## Phase 8: Setup Daily Automation (Optional)

For `auto-deliver-daily` function to run automatically:

### Option A: pg_cron in Supabase

Run in SQL Editor:
```sql
-- Enable pg_cron extension (if not enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule auto-deliver at 10:00 AM IST (4:30 AM UTC)
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

### Option B: Vercel Cron

Create/update `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ],
  "crons": [{
    "path": "/api/trigger-auto-deliver",
    "schedule": "30 4 * * *"
  }]
}
```

---

## Test Your Migration

### Test 1: Health Check
```bash
curl "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/health-check"
```
Expected: `{"status":"healthy",...}`

### Test 2: Login
1. Visit: `https://awadhdairy-remix.vercel.app/auth`
2. Enter: Phone `7897716792`, PIN `101101`
3. Click Login
4. Dashboard should load

### Test 3: Customer Auth
```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/customer-auth" \
  -H "Content-Type: application/json" \
  -d '{"action":"login","phone":"9999000001","pin":"123456"}'
```

---

## Summary of Files to Modify

| File | Action |
|------|--------|
| `.env.example` | Update with external Supabase credentials |
| `supabase/functions/customer-auth/index.ts` | Add `awadhdairy-remix.vercel.app` to ALLOWED_ORIGINS |
| `DEPLOYMENT_GUIDE.md` | Update with specific credentials and URLs |

---

## Complete Credentials Reference

```text
# Supabase Project
URL: https://ohrytohcbbkorivsuukm.supabase.co
Project ID: ohrytohcbbkorivsuukm
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg
Service Role Key: sb_secret_r02XtTsjUcW-D5-MgiYyzg_gIP6ra8b

# Admin Credentials
Phone: 7897716792
PIN: 101101

# Vercel
Domain: awadhdairy-remix.vercel.app

# Edge Function URLs
Base: https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/
- auto-deliver-daily
- change-pin
- create-user
- customer-auth
- delete-user
- health-check
- reset-user-pin
- setup-external-db
- update-user-status

# Supabase Dashboard
https://supabase.com/dashboard/project/ohrytohcbbkorivsuukm
```

---

## Post-Migration Checklist

- [ ] Schema applied to external Supabase
- [ ] All 5 secrets set via CLI
- [ ] All 9 edge functions deployed
- [ ] `.env.example` updated
- [ ] `customer-auth` ALLOWED_ORIGINS updated
- [ ] Code pushed to GitHub
- [ ] Vercel project created
- [ ] Vercel environment variables set
- [ ] Authentication settings configured
- [ ] Admin bootstrap completed
- [ ] Login tested successfully
- [ ] Daily automation configured

---

## Estimated Time: ~1-2 hours
