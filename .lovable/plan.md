
# Comprehensive Bug Fix Plan

## Issues to Address

| # | Issue | Type | Severity |
|---|-------|------|----------|
| 1.3 | RLS Policy `USING (true)` on `auth_sessions` | Security | Critical |
| 2.2 | Keep BulkInvoiceGenerator format (already ok) | N/A | N/A |
| 4.3 | CORS Headers Allow All Origins | Security | Medium |
| 5.3 | Customer Credit Balance Not Auto-Updated | Data Integrity | High |
| 6.1 | No Session Cleanup Mechanism | Infrastructure | Medium |
| 7.x | Missing Auto-Deliver Daily Cron Trigger | Infrastructure | High |
| 8.1 | GitHub Actions Secret Mismatch | Infrastructure | Medium |
| 9.1 | N+1 Query Pattern in Invoice Generation | Performance | Medium |
| 9.2 | No Pagination for Large Data Sets | Performance | Low |
| 10.2 | No Unique Constraint on Invoice Number | Data Integrity | Already Fixed |

---

## Issue 1.3: RLS Policy `USING (true)` on auth_sessions

**Problem Found**: The `auth_sessions` table has dangerous RLS policies:
- `Users can view their own sessions` → `USING (true)` (allows ANY user to see ALL sessions)
- `Users can delete their own sessions` → `USING (true)` (allows ANY user to delete ALL sessions)

**Impact**: Any authenticated user can view or delete any other user's session, enabling session hijacking or denial of service.

**Solution**: Fix RLS policies to properly restrict access to own sessions only.

**Database Migration**:
```sql
-- Drop existing broken policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON auth_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON auth_sessions;

-- Create proper policies
CREATE POLICY "Users can view their own sessions"
ON auth_sessions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
ON auth_sessions FOR DELETE
USING (user_id = auth.uid());

-- Super admin can view all sessions for monitoring
CREATE POLICY "Admins can view all sessions"
ON auth_sessions FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::user_role));
```

---

## Issue 4.3: CORS Headers Allow All Origins

**Problem Found**: All 13 edge functions use `'Access-Control-Allow-Origin': '*'` which allows any website to call the API.

**Impact**: Cross-site request forgery (CSRF) attacks possible. Malicious websites could make authenticated requests.

**Solution**: Implement origin validation with a whitelist in all edge functions.

**Edge Function Pattern** (to be added to all functions):
```typescript
const ALLOWED_ORIGINS = [
  'https://awadhdairyfinal.vercel.app',
  'https://awadh-dairy.vercel.app',
  'https://id-preview--fe319f03-610b-496f-b31c-17c1dc16ca01.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o)) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, ...',
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

**Files to Modify** (13 edge functions):
1. `supabase/functions/archive-old-data/index.ts`
2. `supabase/functions/auto-deliver-daily/index.ts`
3. `supabase/functions/change-pin/index.ts`
4. `supabase/functions/create-user/index.ts`
5. `supabase/functions/customer-auth/index.ts` (already has partial validation)
6. `supabase/functions/delete-user/index.ts`
7. `supabase/functions/health-check/index.ts`
8. `supabase/functions/reset-user-pin/index.ts`
9. `supabase/functions/send-telegram/index.ts`
10. `supabase/functions/setup-external-db/index.ts`
11. `supabase/functions/telegram-daily-summary/index.ts`
12. `supabase/functions/telegram-event-notify/index.ts`
13. `supabase/functions/update-user-status/index.ts`

---

## Issue 5.3: Customer Credit Balance Not Auto-Updated

**Problem Found**: When invoices are created or payments recorded, the `customers.credit_balance` field is never updated. It's only displayed from ledger calculations.

**Impact**: Dashboard stats show stale credit balances. Customer portal displays incorrect balances.

**Solution**: Create a database trigger to automatically update `customers.credit_balance` whenever `customer_ledger` entries are added.

**Database Migration**:
```sql
-- Function to recalculate customer credit balance from ledger
CREATE OR REPLACE FUNCTION public.update_customer_balance_from_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _total_debit NUMERIC;
  _total_credit NUMERIC;
  _balance NUMERIC;
BEGIN
  -- Calculate totals from ledger
  SELECT 
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO _total_debit, _total_credit
  FROM customer_ledger
  WHERE customer_id = COALESCE(NEW.customer_id, OLD.customer_id);
  
  _balance := _total_debit - _total_credit;
  
  -- Update customer credit_balance
  UPDATE customers
  SET credit_balance = _balance,
      updated_at = NOW()
  WHERE id = COALESCE(NEW.customer_id, OLD.customer_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger on customer_ledger
CREATE TRIGGER trg_update_customer_balance
AFTER INSERT OR UPDATE OR DELETE ON customer_ledger
FOR EACH ROW
EXECUTE FUNCTION update_customer_balance_from_ledger();
```

---

## Issue 6.1: No Session Cleanup Mechanism

**Problem Found**: The `cleanup_expired_sessions` function exists in the database schema but is never called. Expired sessions accumulate indefinitely.

**Impact**: Database bloat, security risk (stale sessions), performance degradation.

**Solution**: Create a GitHub Action to periodically call the cleanup function via edge function.

**Files to Create**:
1. `.github/workflows/session-cleanup.yml` - Weekly cleanup trigger
2. Add session cleanup to `archive-old-data` edge function

**GitHub Workflow**:
```yaml
name: Session Cleanup
on:
  schedule:
    - cron: '0 3 * * 0'  # Every Sunday at 3 AM UTC
  workflow_dispatch:
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup Expired Sessions
        env:
          SUPABASE_URL: ${{ secrets.EXTERNAL_SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.EXTERNAL_SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          curl -X POST "$SUPABASE_URL/rest/v1/rpc/cleanup_expired_sessions" \
            -H "apikey: $SUPABASE_SERVICE_KEY" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_KEY"
```

---

## Issue 7.x: Missing Auto-Deliver Daily Cron Trigger

**Problem Found**: The `auto-deliver-daily` edge function exists but has no scheduled trigger. The GitHub workflow file doesn't exist.

**Solution**: Create GitHub Action to trigger daily delivery processing at 10 AM IST (4:30 AM UTC).

**File to Create**: `.github/workflows/auto-deliver-daily.yml`
```yaml
name: Auto Deliver Daily
on:
  schedule:
    - cron: '30 4 * * *'  # 4:30 AM UTC = 10:00 AM IST
  workflow_dispatch:
jobs:
  auto-deliver:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Auto Delivery
        env:
          SUPABASE_URL: ${{ secrets.EXTERNAL_SUPABASE_URL }}
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "${SUPABASE_URL}/functions/v1/auto-deliver-daily" \
            -H "Content-Type: application/json")
          http_code=$(echo "$response" | tail -1)
          if [ "$http_code" -lt 300 ]; then
            echo "Auto-delivery completed"
          else
            echo "Auto-delivery failed: $http_code"
            exit 1
          fi
```

---



## Issue 9.1: N+1 Query Pattern in Invoice Generation

**Problem Found**: In `useAutoInvoiceGenerator.ts` (lines 200-242), each customer triggers:
1. `calculateCustomerInvoice()` → 2-3 queries per customer
2. `generateInvoiceNumber()` → 1 query
3. Invoice insert → 1 query

For 100 customers = 400+ queries.

**Solution**: Batch operations:
1. Fetch all delivery data for all customers in one query
2. Generate invoice numbers in batch
3. Use bulk insert for invoices

**File to Modify**: `src/hooks/useAutoInvoiceGenerator.ts`

```typescript
// Before: N+1 pattern
for (const customer of customers || []) {
  const invoiceData = await calculateCustomerInvoice(customer.id, ...);
  const invoiceNumber = await generateInvoiceNumber();
  await supabase.from("invoices").insert({...});
}

// After: Batch pattern
const { data: allDeliveries } = await supabase
  .from("deliveries")
  .select(`customer_id, delivery_items(...)`)
  .in("customer_id", customerIds)
  .eq("status", "delivered")
  .gte("delivery_date", periodStart)
  .lte("delivery_date", periodEnd);

// Group by customer in memory
const customerDeliveries = groupBy(allDeliveries, 'customer_id');

// Prepare all invoices
const invoicesToInsert = customersToInvoice.map((customer, index) => ({
  invoice_number: `INV-${yyyymm}-${String(baseCount + index + 1).padStart(4, '0')}`,
  customer_id: customer.id,
  ...
}));

// Bulk insert
await supabase.from("invoices").insert(invoicesToInsert);
```

---

## Issue 9.2: No Pagination for Large Data Sets

**Status**: Already implemented! The `DataTable` component has built-in pagination with `itemsPerPage` prop (default 10).

**Finding**: DataTable already has:
- Client-side pagination (lines 66-70)
- Page navigation UI (lines 156-216)
- `itemsPerPage` prop for customization

**Minor Enhancement**: Some pages use high limits like `.limit(200)`. Consider adding server-side pagination for tables that may grow large (audit logs, notifications).

**No immediate action required** - existing pagination is functional.

---

## Issue 10.2: No Unique Constraint on Invoice Number

**Status**: Already fixed! Database query confirmed:
```
invoices_invoice_number_key: UNIQUE (invoice_number)
```

The unique constraint exists. No action required.

---

## Implementation Summary

### Database Migrations Required
1. Fix `auth_sessions` RLS policies (Critical)
2. Create `update_customer_balance_from_ledger` trigger (High)

### Edge Functions to Modify
All 13 functions need CORS origin validation (13 files)

### GitHub Actions to Create/Modify
1. Create `.github/workflows/auto-deliver-daily.yml`
2. Create `.github/workflows/session-cleanup.yml`
3. Fix `.github/workflows/telegram-daily-summary.yml` secret names
4. Update `.github/workflows/keep-alive.yml` to use secrets

### Hooks to Optimize
1. `src/hooks/useAutoInvoiceGenerator.ts` - Batch query pattern

---

## Implementation Order

| Priority | Issue | Risk Level | Effort |
|----------|-------|------------|--------|
| 1 | 1.3 RLS Fix | Critical Security | Low |
| 2 | 5.3 Balance Trigger | High Data Integrity | Low |
| 3 | 8.1 Secret Names | Medium - Breaks Telegram | Low |
| 4 | 7.x Auto-Deliver Cron | High - Deliveries not running | Low |
| 5 | 6.1 Session Cleanup | Medium | Low |
| 6 | 4.3 CORS Hardening | Medium Security | High (13 files) |
| 7 | 9.1 N+1 Optimization | Medium Performance | Medium |

---

## Post-Implementation Testing

1. Verify RLS: Try accessing other user's sessions (should fail)
2. Verify balance trigger: Create invoice, check `customers.credit_balance` updated
3. Verify Telegram: Manually trigger workflow, confirm message sent
4. Verify auto-delivery: Run workflow, check deliveries created
5. Verify CORS: Test API from unauthorized origin (should be blocked)
6. Verify N+1 fix: Generate bulk invoices, check query count in logs
