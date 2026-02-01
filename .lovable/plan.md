
# Deploying Edge Functions to External Supabase

## Overview

You CAN deploy the edge functions from this project to your external Supabase instance. This would make everything work exactly as designed, with full `auth.admin` API access for user management.

---

## What's Required

### 1. One-Time Setup (Your Computer)

| Step | Action |
|------|--------|
| 1 | Install **Supabase CLI** on your computer |
| 2 | Login to CLI with your Supabase account |
| 3 | Link to your external project (`htsfxnuttobkdquxwvjj`) |
| 4 | Set the required secrets |
| 5 | Deploy all 9 edge functions |

### 2. Required Secrets to Configure

These secrets must be set in your external Supabase project:

```text
EXTERNAL_SUPABASE_URL = https://htsfxnuttobkdquxwvjj.supabase.co
EXTERNAL_SUPABASE_ANON_KEY = (your anon key - already known)
EXTERNAL_SUPABASE_SERVICE_ROLE_KEY = (you said you can provide this)
```

### 3. Functions to Deploy

| Function | Purpose |
|----------|---------|
| `create-user` | Create new staff users with auth.admin.createUser |
| `delete-user` | Delete users from auth.users + cleanup orphaned users |
| `reset-user-pin` | Admin resets another user's PIN |
| `change-pin` | User changes their own PIN |
| `update-user-status` | Activate/deactivate users |
| `customer-auth` | Customer login/register/change-pin |
| `auto-deliver-daily` | Automatic daily delivery processing |
| `health-check` | System health verification |
| `setup-external-db` | Database initialization (one-time use) |

---

## Deployment Commands

After installing Supabase CLI, run these commands:

```bash
# 1. Login to Supabase
npx supabase login

# 2. Link to your external project
npx supabase link --project-ref htsfxnuttobkdquxwvjj

# 3. Set required secrets
npx supabase secrets set EXTERNAL_SUPABASE_URL=https://htsfxnuttobkdquxwvjj.supabase.co
npx supabase secrets set EXTERNAL_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
npx supabase secrets set EXTERNAL_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 4. Deploy all functions
npx supabase functions deploy create-user
npx supabase functions deploy delete-user
npx supabase functions deploy reset-user-pin
npx supabase functions deploy change-pin
npx supabase functions deploy update-user-status
npx supabase functions deploy customer-auth
npx supabase functions deploy auto-deliver-daily
npx supabase functions deploy health-check
```

---

## Pros of Keeping Edge Functions

| Benefit | Explanation |
|---------|-------------|
| **Native Supabase Auth** | Users exist in `auth.users` table - visible in Supabase dashboard |
| **No code changes** | Frontend works as-is with `supabase.functions.invoke()` |
| **Admin API access** | Full `auth.admin` capabilities (createUser, deleteUser, updateUser) |
| **Password sync** | Both `profiles.pin_hash` AND `auth.users.password` stay synchronized |
| **Existing features** | All current functionality preserved without modification |

---

## Cons / Considerations

| Consideration | Impact |
|---------------|--------|
| **Manual deployment** | Every code change to edge functions requires re-running CLI commands |
| **CLI dependency** | Must install Supabase CLI locally (Node.js required) |
| **Secret management** | Must manually set secrets in external Supabase |
| **Cold starts** | Edge functions have ~500ms cold start on first call after idle |
| **Free tier limits** | 500,000 invocations/month on free tier (usually plenty) |
| **Maintenance** | Two places to manage (Lovable for frontend, CLI for functions) |

---

## Frontend Code Change Required

Currently, `supabase.functions.invoke()` calls go to external Supabase, but the URL configuration needs verification.

Looking at `src/lib/external-supabase.ts`:

```typescript
// Current: Client is configured for external Supabase
export const externalSupabase = createClient<Database>(EXTERNAL_URL, EXTERNAL_ANON_KEY, {...});
```

**Good news**: The code already points to external Supabase! Once you deploy edge functions there, the existing `supabase.functions.invoke()` calls will work automatically.

---

## Auto-Delivery Scheduling

The `auto-deliver-daily` function needs a trigger to run daily. Options:

### Option A: Supabase Cron (pg_cron extension)

Add to your database:
```sql
-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily at 10:00 AM IST (4:30 AM UTC)
SELECT cron.schedule(
  'auto-deliver-daily',
  '30 4 * * *',
  $$SELECT net.http_post(
    url := 'https://htsfxnuttobkdquxwvjj.supabase.co/functions/v1/auto-deliver-daily',
    headers := '{"Authorization": "Bearer your_service_role_key"}'::jsonb
  )$$
);
```

### Option B: External Cron (Free)

Use GitHub Actions, cron-job.org, or similar free service to call the edge function daily.

---

## Step-by-Step Instructions for You

### Prerequisites
1. Install Node.js if not already installed
2. Have your Supabase account credentials ready
3. Have the `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY` ready

### Deployment Steps

**Step 1: Install Supabase CLI**
```bash
npm install -g supabase
```

**Step 2: Login**
```bash
supabase login
```
This opens a browser to authenticate.

**Step 3: Link Project**
```bash
cd /path/to/your/project
supabase link --project-ref htsfxnuttobkdquxwvjj
```

**Step 4: Set Secrets**
```bash
supabase secrets set EXTERNAL_SUPABASE_URL="https://htsfxnuttobkdquxwvjj.supabase.co"
supabase secrets set EXTERNAL_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2Z4bnV0dG9ia2RxdXh3dmpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1ODQ1ODgsImV4cCI6MjA4NTE2MDU4OH0.kM-uVIvO_bGqBeBQgoXBLlzTbTyQGVRgL6aVYMG2OcM"
supabase secrets set EXTERNAL_SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
```

**Step 5: Deploy Functions**
```bash
supabase functions deploy create-user
supabase functions deploy delete-user
supabase functions deploy reset-user-pin
supabase functions deploy change-pin
supabase functions deploy update-user-status
supabase functions deploy customer-auth
supabase functions deploy auto-deliver-daily
supabase functions deploy health-check
```

**Step 6: Verify**
- Go to your Supabase dashboard → Edge Functions
- You should see all deployed functions listed
- Test by creating a new user in the app

---

## Alternative: I Can Help You Remove Edge Functions

If the CLI deployment seems complex, I can implement the alternative approach:

1. Remove all edge function dependencies
2. Use existing SQL RPC functions (`admin_create_staff`, `staff_login`, etc.)
3. Switch to session-based authentication (already exists in your schema)
4. Zero external dependencies - pure Vercel + Supabase free tier

---

## Recommendation

| If... | Then... |
|-------|---------|
| You're comfortable with CLI and want native Supabase Auth | Deploy edge functions to external Supabase |
| You want simpler setup with zero CLI dependency | Remove edge functions and use SQL RPC |

Both approaches will result in a fully functional application. The edge function approach preserves the current architecture, while the RPC approach simplifies deployment.
