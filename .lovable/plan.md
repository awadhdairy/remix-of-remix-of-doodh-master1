
# Data Archival/Cleanup Feature for Admin

## Overview

This feature adds a secure admin-only tool to clear old historical data beyond configurable retention periods (1/2/3+ years). This is essential for long-term database health and performance as transactional data grows.

## Architecture

```text
+------------------+     +----------------------+     +-----------------+
|  Settings Page   |---->|  Archive Edge Func   |---->|   Database      |
|  (Admin Tab)     |     |  (archive-old-data)  |     |   Cleanup       |
+------------------+     +----------------------+     +-----------------+
        |                          |
        v                          v
   Role Check               Super Admin
 (super_admin only)         Verification
```

## Data Tables to Archive

The following tables contain date-based data that grows indefinitely:

| Table | Date Column | Safe to Archive | Notes |
|-------|-------------|-----------------|-------|
| activity_logs | created_at | Yes | Audit trail, archive after retention |
| attendance | attendance_date | Yes | Historical records |
| bottle_transactions | transaction_date | Yes | Historical |
| breeding_records | record_date | Yes | Historical |
| cattle_health | record_date | Yes | Historical, but keep recent for care continuity |
| customer_ledger | transaction_date | Partial | Only if invoices paid (financial compliance) |
| deliveries | delivery_date | Yes | Historical |
| delivery_items | via delivery_id | Yes | Cascade with deliveries |
| expenses | expense_date | Partial | Financial records, 7 year retention recommended |
| feed_consumption | consumption_date | Yes | Historical |
| invoices | created_at | Partial | Only fully paid invoices |
| maintenance_records | maintenance_date | Yes | Historical |
| milk_procurement | procurement_date | Yes | Historical |
| milk_production | production_date | Yes | Historical |
| notification_logs | created_at | Yes | Audit trail |
| payments | payment_date | Partial | Financial records |
| payroll_records | pay_period_start | Partial | HR/financial records |
| vendor_payments | payment_date | Partial | Financial records |

## Implementation Details

### 1. New Settings Tab: "Data Management" (Admin Only)

Add a new tab in Settings.tsx that only appears for `super_admin` users with:

- Dropdown to select retention period (1 year / 2 years / 3 years / 5 years)
- Data preview showing record counts that would be deleted
- Confirmation dialog with PIN re-entry for security
- Export option before deletion (backup safety)
- Detailed activity logging of what was deleted

### 2. New Edge Function: `archive-old-data`

Secure edge function that:

- Verifies caller is `super_admin` (same pattern as delete-user)
- Accepts retention period and optional table selection
- Performs deletions in correct order (respecting foreign keys)
- Logs all actions to `activity_logs`
- Returns detailed summary of deleted records

### 3. Deletion Order (Foreign Key Aware)

```text
Step 1: Get delivery IDs older than cutoff
Step 2: Delete delivery_items (FK to deliveries)
Step 3: Delete deliveries
Step 4: Delete invoice_items (if exists) before invoices
Step 5: Delete payments (FK to invoices) - only for paid invoices
Step 6: Delete invoices - only fully paid ones
Step 7: Delete other standalone tables (attendance, logs, etc.)
```

### 4. Safety Measures

- **Super Admin only**: Role verified server-side via user_roles table
- **PIN confirmation**: Require current PIN re-entry before destructive action
- **Preview mode**: Show what will be deleted before confirming
- **Export first**: Option to download affected data as JSON/Excel backup
- **Exclude critical data**: Never delete unpaid invoices, active customers, current cattle
- **Audit logging**: Every deletion logged with details

### 5. UI Component Structure

```text
Settings.tsx
   └── TabsContent value="data-management"
       └── DataArchiveManager.tsx (new component)
           ├── RetentionPeriodSelector
           ├── AffectedDataPreview
           ├── ExportBeforeDeleteButton
           ├── ConfirmArchiveDialog (with PIN)
           └── ArchiveProgressDisplay
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/settings/DataArchiveManager.tsx` | CREATE | Main archive management component |
| `src/pages/Settings.tsx` | MODIFY | Add "Data Management" tab for super_admin |
| `supabase/functions/archive-old-data/index.ts` | CREATE | Secure edge function for data cleanup |
| `supabase/config.toml` | MODIFY | Add archive-old-data function config |

## Edge Function Logic

```text
1. Verify Authorization
   - Extract JWT from Authorization header
   - Validate user via supabase.auth.getUser(token)
   - Check user_roles for super_admin

2. Parse Request
   - retention_years: 1 | 2 | 3 | 5
   - mode: "preview" | "execute"
   - tables: string[] (optional, defaults to all archivable)

3. Calculate Cutoff Date
   - cutoff = NOW() - (retention_years * 365 days)

4. Preview Mode
   - For each table, count records older than cutoff
   - Return summary without deleting

5. Execute Mode (with transaction-like behavior)
   - Delete in FK-safe order
   - Track deleted counts per table
   - Log to activity_logs with full details
   - Return summary

6. Error Handling
   - Wrap in try/catch
   - Partial failures logged but don't stop process
   - Return detailed error info
```

## UI Flow

1. User navigates to Settings > Data Management
2. System shows current data volume by table
3. User selects retention period (e.g., "Keep last 2 years")
4. Click "Preview" to see affected record counts
5. Click "Export Backup" to download data that will be deleted
6. Click "Archive Now" button
7. Confirmation dialog appears with:
   - Summary of what will be deleted
   - Warning about irreversibility
   - PIN re-entry field
8. After PIN verification, deletion proceeds
9. Progress bar shows completion
10. Final summary with counts displayed
11. Action logged to audit trail

## Security Considerations

- Server-side role verification (never trust client)
- PIN confirmation prevents accidental/unauthorized deletions
- All actions logged with requestor identity
- Backup export available before any deletion
- Deletion cascades handled properly via FK order
- No way to delete current year's data (minimum 1 year retention)

## Testing Checklist

After implementation:

1. Non-admin users cannot see Data Management tab
2. Preview mode shows correct counts without deleting
3. Export creates valid JSON/Excel file with affected data
4. PIN verification works (wrong PIN rejected)
5. Deletion respects foreign key constraints
6. Activity log entry created with all details
7. UI shows progress during long operations
8. Unpaid invoices are never deleted
