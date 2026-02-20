

# Financial Integrity Health Check

Add a new `FinancialIntegrityChecker` component to the existing **Settings > Data Integrity** tab (super_admin only), displayed below the existing `DataIntegrityManager`. It performs three read-only diagnostic checks and displays results as green/red cards.

---

## Diagnostic Checks

### Check A: Ledger vs Credit Balance Sync
For each active customer, compute `SUM(debit_amount) - SUM(credit_amount)` from `customer_ledger` and compare it against `customers.credit_balance`. Any mismatch means the `update_customer_balance_from_ledger` DB trigger has drifted or failed silently.

- **Green card**: All customers match
- **Red card**: Lists mismatched customer names with expected vs actual values

### Check B: Orphaned Invoices
Count invoices that have a non-null `id` but NO corresponding `customer_ledger` entry where `reference_id = invoice.id` AND `transaction_type = 'invoice'`. These are invoices that were created but never debited to the ledger.

- **Green card**: 0 orphaned invoices
- **Red card**: Shows count of orphaned invoices

### Check C: Orphaned Ledger Entries
Count `customer_ledger` entries where `transaction_type = 'invoice'` and `reference_id IS NOT NULL` but no matching `invoices.id` exists. These are ledger debits for invoices that were deleted without cleaning up the ledger (should not happen with the current deletion flow, but a safety check).

- **Green card**: 0 orphaned ledger entries
- **Red card**: Shows count of orphaned entries

---

## Implementation

### New File: `src/components/settings/FinancialIntegrityChecker.tsx`
- A single Card component with a "Run Financial Health Check" button
- On click, runs 3 parallel Supabase queries:
  1. Fetch all active customers with their `credit_balance`, then for each, query `customer_ledger` to compute `SUM(debit) - SUM(credit)`. Compare.
  2. Fetch all invoice IDs, then query `customer_ledger` for entries with `transaction_type = 'invoice'` and matching `reference_id`. Compute the set difference.
  3. Fetch all ledger entries with `transaction_type = 'invoice'` and `reference_id IS NOT NULL`, then check if each `reference_id` exists in `invoices`.
- Display 3 diagnostic cards (green `CheckCircle` / red `AlertTriangle`) with counts and details
- Read-only — no data modification

### Modified File: `src/pages/Settings.tsx`
- Import and render `FinancialIntegrityChecker` below `DataIntegrityManager` in the `data-integrity` tab:
```
<TabsContent value="data-integrity">
  <div className="space-y-6">
    <DataIntegrityManager />
    <FinancialIntegrityChecker />
  </div>
</TabsContent>
```

---

## Technical Details

- Uses `externalSupabase` client (same as all other components)
- Paginated fetching for ledger data (handles >1000 rows using range-based pagination)
- No new DB tables, migrations, or edge functions required
- Guarded by `isSuperAdmin` check (inherited from the tab visibility)
- Follows the exact same UI pattern as the existing `DataIntegrityManager` (Card, Alert, Badge, green/red states)

