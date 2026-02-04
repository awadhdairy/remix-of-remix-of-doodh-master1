
# Add "0 Year" Option for Complete Data Reset

## Overview

This feature adds a "Clear All Data (Start Fresh)" option to the Data Archive Manager, allowing super admins to completely wipe transactional data and start from scratch. This is useful for:
- Fresh production start after testing
- End-of-year complete reset
- System migration/fresh start scenarios

## Safety Measures for Complete Reset

Since "0 years" means deleting ALL data including today's records, extra safety layers are required:

| Safety Layer | Standard Archive (1-5 years) | Complete Reset (0 years) |
|--------------|------------------------------|--------------------------|
| Preview Required | Yes | Yes |
| Export Backup | Optional | **Strongly Recommended** |
| PIN Confirmation | 6-digit PIN | 6-digit PIN |
| Confirmation Text | - | **Type "DELETE ALL" required** |
| Warning Level | Destructive | **Critical with red banner** |
| Dialog Styling | Standard | **Double confirmation dialog** |

## Implementation Details

### 1. Frontend: DataArchiveManager.tsx

**Changes:**
- Add "0" to retention period dropdown with special label "Clear All (Reset)"
- Add state for typed confirmation: `confirmText: string`
- Conditional UI: Show extra confirmation field when `retentionYears === "0"`
- Update cutoff date display: "ALL records will be deleted" instead of date
- Add critical warning banner for reset mode
- Validate both PIN AND "DELETE ALL" text for 0-year mode

**UI Flow for 0-Year Option:**
```
1. Select "Clear All (Reset)" from dropdown
2. Critical warning banner appears
3. Click "Preview Data" - shows ALL record counts
4. Click "Export Backup" (strongly recommended)
5. Click "Delete All Records" (destructive button)
6. Confirmation dialog appears with:
   - Extra warning about complete data loss
   - Type "DELETE ALL" input field
   - PIN entry field
7. Both validations must pass to proceed
```

### 2. Backend: archive-old-data Edge Function

**Changes:**
- Accept `0` as valid `retention_years` value
- When `retention_years === 0`:
  - Set `cutoffDateStr` to tomorrow's date (deletes everything including today)
  - Or use a far-future date to match all records
  - Add special handling for financial records warning in logs
- Enhanced audit logging for complete reset operations

### 3. Files to Modify

| File | Changes |
|------|---------|
| `src/components/settings/DataArchiveManager.tsx` | Add 0-year option, extra confirmation UI, validation |
| `supabase/functions/archive-old-data/index.ts` | Accept 0 as valid, handle complete deletion logic |

## Detailed Code Changes

### DataArchiveManager.tsx Changes

1. **Add "Clear All" option to Select dropdown:**
```typescript
<SelectContent>
  <SelectItem value="0" className="text-destructive">
    Clear All (Factory Reset)
  </SelectItem>
  <SelectItem value="1">1 Year</SelectItem>
  <SelectItem value="2">2 Years</SelectItem>
  <SelectItem value="3">3 Years</SelectItem>
  <SelectItem value="5">5 Years</SelectItem>
</SelectContent>
```

2. **Add confirmText state:**
```typescript
const [confirmText, setConfirmText] = useState("");
```

3. **Update cutoff date display for 0 years:**
```typescript
const isFactoryReset = retentionYears === "0";
// Show "ALL records" message instead of date for reset mode
```

4. **Add extra critical warning for reset mode:**
```typescript
{isFactoryReset && (
  <Alert variant="destructive" className="border-2 border-destructive">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>COMPLETE DATA RESET</AlertTitle>
    <AlertDescription>
      This will delete ALL transactional data including today's records. 
      Only master data (customers, cattle, products, users) will be preserved.
      THIS CANNOT BE UNDONE.
    </AlertDescription>
  </Alert>
)}
```

5. **Add "DELETE ALL" confirmation in dialog:**
```typescript
{isFactoryReset && (
  <div className="space-y-2">
    <Label>Type "DELETE ALL" to confirm complete reset</Label>
    <Input
      value={confirmText}
      onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
      placeholder="DELETE ALL"
    />
  </div>
)}
```

6. **Update validation in handleArchive:**
```typescript
if (isFactoryReset && confirmText !== "DELETE ALL") {
  toast({
    title: "Confirmation Required",
    description: 'Please type "DELETE ALL" to confirm complete reset',
    variant: "destructive",
  });
  return;
}
```

### archive-old-data Edge Function Changes

1. **Accept 0 as valid retention_years:**
```typescript
if (retention_years === undefined || ![0, 1, 2, 3, 5].includes(retention_years)) {
  return new Response(
    JSON.stringify({ error: "Invalid retention_years. Use 0, 1, 2, 3, or 5" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

2. **Handle 0-year cutoff (delete everything):**
```typescript
let cutoffDateStr: string;
const isFactoryReset = retention_years === 0;

if (isFactoryReset) {
  // Set to tomorrow to include today's records
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  cutoffDateStr = tomorrow.toISOString().split("T")[0];
  console.log(`[ARCHIVE] FACTORY RESET - Deleting ALL records`);
} else {
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retention_years);
  cutoffDateStr = cutoffDate.toISOString().split("T")[0];
}
```

3. **Enhanced logging for factory reset:**
```typescript
await supabase.from("activity_logs").insert({
  user_id: userId,
  action: isFactoryReset ? "factory_reset" : "data_archived",
  entity_type: "system",
  entity_id: isFactoryReset ? "factory_reset" : "archive",
  details: {
    retention_years,
    is_factory_reset: isFactoryReset,
    cutoff_date: cutoffDateStr,
    deleted,
    total_deleted: totalDeleted,
    errors: errors.length > 0 ? errors : undefined,
  },
});
```

## What Data Gets Preserved (Master Data)

Even with factory reset, these tables are NOT deleted:
- `profiles` - User accounts
- `customers` - Customer master data
- `cattle` - Cattle records
- `products` - Product catalog
- `routes` - Delivery routes
- `price_rules` - Pricing configuration
- `user_roles` - Role assignments
- `auth_sessions` - Active sessions
- `inventory_items` - Inventory catalog

## What Data Gets Deleted (Transactional Data)

| Table | Description |
|-------|-------------|
| activity_logs | All audit logs |
| attendance | Employee attendance |
| bottle_transactions | Bottle tracking |
| breeding_records | Breeding history |
| cattle_health | Health records |
| deliveries + delivery_items | All delivery records |
| expenses | All expenses |
| feed_consumption | Feed records |
| invoices (paid only) | Paid invoices |
| maintenance_records | Equipment maintenance |
| milk_procurement | Procurement records |
| milk_production | Production records |
| notification_logs | Notification history |
| payments | Payment records |
| payroll_records | Payroll history |
| vendor_payments | Vendor payment history |

## User Experience Flow

```
Admin → Settings → Data Management
         ↓
    Select "Clear All (Factory Reset)"
         ↓
    ⚠️ Critical Warning Banner Appears
         ↓
    Click "Preview Data" 
         ↓
    See ALL records that will be deleted
         ↓
    Click "Export Backup" (recommended)
         ↓
    Click "Delete All Records"
         ↓
    Confirmation Dialog:
    ┌─────────────────────────────────┐
    │ ⚠️ FACTORY RESET                 │
    │                                 │
    │ This will permanently delete    │
    │ ALL 45,678 transactional        │
    │ records from the system.        │
    │                                 │
    │ Type "DELETE ALL" to confirm:   │
    │ ┌─────────────────────────────┐ │
    │ │ DELETE ALL                  │ │
    │ └─────────────────────────────┘ │
    │                                 │
    │ Enter your 6-digit PIN:         │
    │ ┌─────────────────────────────┐ │
    │ │ ● ● ● ● ● ●                 │ │
    │ └─────────────────────────────┘ │
    │                                 │
    │ [Cancel]  [🗑️ Reset Everything] │
    └─────────────────────────────────┘
         ↓
    System performs complete reset
         ↓
    Success: "Factory reset complete. Deleted X records."
```

## Testing Checklist

After implementation:
1. "Clear All" option appears in dropdown (styled as destructive)
2. Selecting it shows critical warning banner
3. Preview shows ALL record counts (not filtered by date)
4. Export creates backup of all data
5. Confirmation dialog requires both "DELETE ALL" and PIN
6. Wrong confirmation text is rejected
7. Wrong PIN is rejected
8. Successful reset deletes all transactional data
9. Master data (customers, cattle, products) is preserved
10. Activity log records the factory reset action
