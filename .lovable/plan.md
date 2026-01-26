

# Update GitHub Keep-Alive Workflow

## Overview

Update the `.github/workflows/keep-alive.yml` file to use the external Supabase project URL. The anon key you provided will be stored as a GitHub repository secret (not in the file itself for security).

## File Changes

### `.github/workflows/keep-alive.yml`

The file will be updated to ping your external Supabase database:

```yaml
name: Keep Alive Ping

on:
  schedule:
    - cron: '0 3 */2 * *'
  workflow_dispatch:

jobs:
  keep-alive:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Database via PostgREST
        run: |
          response=$(curl -s -w "\n%{http_code}" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            "https://rihedsukjinwqvsvufls.supabase.co/rest/v1/dairy_settings_public?select=dairy_name&limit=1")
          
          http_code=$(echo "$response" | tail -1)
          body=$(echo "$response" | head -n -1)
          
          echo "Response: $body"
          echo "HTTP Status: $http_code"
          
          if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
            echo "✅ Keep-alive ping successful at $(date -u)"
          else
            echo "❌ Keep-alive ping failed with status $http_code"
            exit 1
          fi
```

## Manual Step Required

After the file is updated, you need to update the GitHub repository secret:

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Update (or create) the secret `SUPABASE_ANON_KEY` with the value:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpaGVkc3Vramlud3F2c3Z1ZmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzOTA3MzksImV4cCI6MjA4NDk2NjczOX0._yHtz7Yu4n77UjHKm-CYmViOeSWYbyP-BMNE9bGowIg
   ```

## Summary

| Item | Value |
|------|-------|
| External Supabase URL | `https://rihedsukjinwqvsvufls.supabase.co` |
| Endpoint | `/rest/v1/dairy_settings_public?select=dairy_name&limit=1` |
| Secret Name | `SUPABASE_ANON_KEY` |
| Schedule | Every 2 days at 3 AM UTC |

