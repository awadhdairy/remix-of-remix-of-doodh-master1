# Doodh Wallah - Free Deployment Guide (Vercel + Supabase)

This guide will help you deploy Doodh Wallah completely free on Vercel (frontend) and Supabase (backend).

## Prerequisites

- GitHub account (free)
- Vercel account (free) - https://vercel.com
- Supabase account (free) - https://supabase.com

---

## Part 1: Supabase Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in:
   - **Project name**: `doodh-wallah`
   - **Database password**: Create a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (2-3 minutes)

### Step 2: Get API Credentials

1. In your Supabase project, go to **Settings** → **API**
2. Copy these values (you'll need them for Vercel):
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
   - **Project Reference ID** (the `xxxxx` part from URL)

### Step 3: Run Database Migrations

1. Go to **SQL Editor** in Supabase dashboard
2. Copy and run each migration file from `supabase/migrations/` folder in order (by date)
3. Each file creates tables, functions, and policies

### Step 4: Deploy Edge Functions

1. Install Supabase CLI: https://supabase.com/docs/guides/cli
2. Login to CLI:
   ```bash
   supabase login
   ```
3. Link to your project:
   ```bash
   supabase link --project-ref your-project-id
   ```
4. Deploy all functions:
   ```bash
   supabase functions deploy bootstrap-admin
   supabase functions deploy create-user
   supabase functions deploy update-user-status
   supabase functions deploy reset-user-pin
   supabase functions deploy change-pin
   supabase functions deploy customer-auth
   supabase functions deploy delete-user
   ```

### Step 5: Configure Authentication

1. Go to **Authentication** → **Settings** in Supabase
2. Enable **Email Auth** (disable email confirmations for ease of use)
3. Under **Auth Providers**, keep Email enabled

---

## Part 2: Vercel Deployment

### Step 1: Push Code to GitHub

1. Create a new GitHub repository
2. Push this codebase:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/doodh-wallah.git
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com and login with GitHub
2. Click "Add New Project"
3. Import your `doodh-wallah` repository
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)

### Step 3: Add Environment Variables

In Vercel project settings → **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | Your Supabase project ID |

5. Click "Deploy"

---

## Part 3: Post-Deployment Setup

### Bootstrap Admin Account

1. Visit your deployed app (e.g., `https://your-app.vercel.app/auth`)
2. Enter admin credentials:
   - **Phone**: `7897716792`
   - **PIN**: `101101`
3. Click "Setup Admin Account"
4. Now login with same credentials

### Create Your First User

1. Login as admin
2. Go to **User Management**
3. Create users with different roles as needed

---

## Free Tier Limits

### Supabase Free Tier
- **Database**: 500MB storage
- **Auth**: 50,000 monthly active users
- **Storage**: 1GB file storage
- **Edge Functions**: 500,000 invocations/month
- **Bandwidth**: 2GB transfer

### Vercel Free Tier (Hobby)
- **Bandwidth**: 100GB/month
- **Builds**: 6000 minutes/month
- **Serverless Functions**: 100GB-hours
- **Deployments**: Unlimited

---

## Custom Domain (Optional)

### Vercel
1. Go to project **Settings** → **Domains**
2. Add your domain
3. Update DNS records as shown

### Supabase
Edge functions will work with your Vercel domain automatically.

---

## Troubleshooting

### "Invalid API key" Error
- Verify environment variables are correctly set in Vercel
- Redeploy after adding variables

### Edge Functions Not Working
- Ensure all functions are deployed via CLI
- Check function logs in Supabase dashboard

### Database Migration Errors
- Run migrations in chronological order
- Check for existing tables before re-running

---

## Updating the App

1. Make changes locally
2. Push to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
3. Vercel auto-deploys on push

---

## Backup Your Data

### Export Database
```bash
supabase db dump -f backup.sql --project-ref your-project-id
```

### Restore Database
```bash
supabase db push --project-ref your-project-id < backup.sql
```

---

## Support

For issues, create a GitHub issue in your repository.

## License

This project is open source and free to use.
