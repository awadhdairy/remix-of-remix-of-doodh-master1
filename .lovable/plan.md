

# Fix: 401 Missing Authorization Header Error

## Problem Identified

When you run:
```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db"
```

You get:
```json
{"code":401,"message":"Missing authorization header"}
```

This happens because:
1. Supabase Edge Functions **require JWT authentication by default**
2. The `setup-external-db` function is designed to be a one-time setup function that should be callable without authentication
3. The `supabase/config.toml` file is missing the `verify_jwt = false` setting for this function

---

## Solution: Two Options

### Option 1: Update config.toml (Recommended)

Update `supabase/config.toml` to disable JWT verification for the setup function:

```toml
project_id = "ohrytohcbbkorivsuukm"

[functions.setup-external-db]
verify_jwt = false

[functions.health-check]
verify_jwt = false
```

Then redeploy the functions:
```bash
supabase functions deploy setup-external-db --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
supabase functions deploy health-check --project-ref ohrytohcbbkorivsuukm --no-verify-jwt
```

After redeployment, run the curl command again:
```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db"
```

---

### Option 2: Include Authorization Header in curl

If you don't want to modify the config, you can pass the anon key as a Bearer token:

```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg" \
  -H "Content-Type: application/json"
```

This uses the anon key from your external Supabase project (found in `src/lib/external-supabase.ts`).

---

### Option 3: Use apikey Header Instead

Supabase also accepts the anon key via `apikey` header:

```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg" \
  -H "Content-Type: application/json"
```

---

## Complete config.toml Update

To properly configure all functions, the `supabase/config.toml` should be updated to:

```toml
project_id = "ohrytohcbbkorivsuukm"

[functions.auto-deliver-daily]
verify_jwt = false

[functions.change-pin]
verify_jwt = false

[functions.create-user]
verify_jwt = false

[functions.customer-auth]
verify_jwt = false

[functions.delete-user]
verify_jwt = false

[functions.health-check]
verify_jwt = false

[functions.reset-user-pin]
verify_jwt = false

[functions.setup-external-db]
verify_jwt = false

[functions.update-user-status]
verify_jwt = false
```

---

## Quick Fix: Run This Command Now

Use this command immediately (includes the authorization header):

```bash
curl -X POST "https://ohrytohcbbkorivsuukm.supabase.co/functions/v1/setup-external-db" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ocnl0b2hjYmJrb3JpdnN1dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI0ODUsImV4cCI6MjA4NTY4ODQ4NX0.IRvIKtTaxZ5MYm6Ju30cxHMQG5xCq9tWJOfSFbNAIUg" \
  -H "Content-Type: application/json"
```

---

## Expected Response

If successful, you should see:
```json
{
  "success": true,
  "message": "External database setup complete",
  "admin_id": "uuid-here",
  "admin_phone": "7897716792",
  "data_seeded": true
}
```

---

## Implementation Plan

| Step | Action | Where |
|------|--------|-------|
| 1 | Update `supabase/config.toml` with `verify_jwt = false` for all functions | Lovable |
| 2 | Push changes to GitHub | Lovable |
| 3 | Pull changes locally | Terminal |
| 4 | Redeploy functions with `--no-verify-jwt` flag | Terminal |
| 5 | Run the setup curl command | Terminal |
| 6 | Verify admin login works at `/auth` | Browser |

---

## Summary

The 401 error occurs because Supabase enforces JWT verification by default. You have two immediate options:

1. **Quick fix**: Add the `Authorization: Bearer <anon_key>` header to your curl command (command provided above)
2. **Permanent fix**: Update `config.toml` to set `verify_jwt = false` for the functions and redeploy

