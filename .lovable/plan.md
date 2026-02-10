

# Comprehensive Finance System Fix Plan

## Issues Identified

### Issue 1: Supabase 1000-Row Query Limit on Deliveries (CRITICAL)

When fetching deliveries for invoice generation, the queries have **no pagination or row limits**. For customers with many daily deliveries over a month (e.g., 30+ customers x 30 days = 900+ rows), the default Supabase 1000-row limit silently truncates results, causing **incomplete and wrongly calculated invoices**.

**Affected files:**
- `SmartInvoiceCreator.tsx` (line 125-141) - Single customer fetch, no limit
- `BulkInvoiceGenerator.tsx` (line 83-95) - All customers fetch, no limit
- `useAutoInvoiceGenerator.ts` (line 203-220) - Batch fetch, no limit
- `EditInvoiceDialog.tsx` (line 109-125) - Invoice edit fetch, no limit
- `InvoicePDFGenerator.tsx` (line 153-167) - PDF generation fetch, no limit

**Fix:** Add `.limit(10000)` or use pagination to ensure all delivery records are fetched.

### Issue 2: Amount Calculation Inconsistency in SmartInvoiceCreator

When the user edits quantity/rate on fetched items, the `amount` field uses `quantity * rate + tax` (line 277-279). But the **initially fetched items** use `total_amount` directly from delivery_items (line 201). If a user edits any field then reverts, the amounts can diverge because the fetched `total_amount` may not equal `quantity * rate` due to rounding or custom pricing.

**Fix:** Always compute `amount = quantity * rate + tax` consistently, both on initial load and on edit.

### Issue 3: BulkInvoiceGenerator Missing Running Balance (CRITICAL)

In `BulkInvoiceGenerator.tsx` (line 231-238), the ledger insert does **not include `running_balance`**, unlike `SmartInvoiceCreator.tsx` which correctly fetches the previous balance. This creates broken ledger chains with balance = 0.

**Fix:** Add running balance calculation before inserting each ledger entry in bulk generator.

### Issue 4: BulkInvoiceGenerator Invoice Number Collision Risk

Invoice numbers use format `INV-YYYYMMDD-{first4chars_of_uuid}` (line 209). If two customers have UUIDs starting with the same 4 characters, there's a collision. Also, this format differs from SmartInvoiceCreator which uses `INV-YYYYMM-{random3digits}` and from useAutoInvoiceGenerator which uses `INV-YYYYMM-{sequential4digits}`.

**Fix:** Standardize invoice number generation using the existing `useAutoInvoiceGenerator.generateInvoiceNumber()` or a consistent sequential approach.

### Issue 5: No Invoice Deletion Feature

Currently there is no way to delete an invoice. Admins need to be able to delete incorrect invoices and reverse the corresponding ledger entry.

**Fix:** Add a delete button visible only to super_admin/manager roles, which deletes the invoice, its associated ledger entry, and any payment records.

### Issue 6: Payment Mode Hardcoded to "cash"

In `handleRecordPayment` (line 174), payment_mode is hardcoded to `"cash"`. Users should be able to select UPI, bank transfer, etc.

**Fix:** Add a payment mode selector to the payment dialog.

### Issue 7: Existing Invoice Check in BulkInvoiceGenerator is Loose

The existing invoice check (line 108-112) uses `>=` and `<=` for billing periods, which can match invoices from overlapping but different periods. It should use exact equality like in `useAutoInvoiceGenerator.ts`.

**Fix:** Use `.eq("billing_period_start", startDate).eq("billing_period_end", endDate)`.

---

## Implementation Details

### Step 1: Fix Query Limits on All Delivery Fetches

Add `.limit(10000)` to all delivery queries in:
- `SmartInvoiceCreator.tsx` line 141 (after `.lte(...)`)
- `BulkInvoiceGenerator.tsx` line 95 (after `.eq("status", "delivered")`)
- `useAutoInvoiceGenerator.ts` line 220 (after `.lte(...)`)
- `EditInvoiceDialog.tsx` line 125 (after `.lte(...)`)
- `InvoicePDFGenerator.tsx` line 167 (after `.eq("status", "delivered")`)

### Step 2: Fix Amount Consistency in SmartInvoiceCreator

When building line items from fetched data (lines 190-206), compute amount as `quantity * rate` instead of using raw `total_amount`:

```typescript
items.push({
  ...
  rate: data.unit_price || product.base_price,
  amount: data.quantity * (data.unit_price || product.base_price),  // Computed, not raw
  ...
});
```

Same fix in `EditInvoiceDialog.tsx` lines 171-187.

### Step 3: Fix BulkInvoiceGenerator Ledger Entry

Add running balance calculation before each ledger insert (line 230-238):

```typescript
// Before inserting ledger entry, fetch latest balance
const { data: lastEntry } = await supabase
  .from("customer_ledger")
  .select("running_balance")
  .eq("customer_id", summary.customer_id)
  .order("transaction_date", { ascending: false })
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const previousBalance = lastEntry?.running_balance || 0;
const newBalance = previousBalance + summary.total_amount;

await supabase.from("customer_ledger").insert({
  ...existing fields...,
  running_balance: newBalance,
});
```

### Step 4: Standardize Invoice Numbering

Replace the random/UUID-based number generators in SmartInvoiceCreator (line 300-306) and BulkInvoiceGenerator (line 209) with a consistent sequential approach:

```typescript
// Shared function: INV-YYYYMM-XXXX (sequential)
async function generateNextInvoiceNumber(): Promise<string> {
  const date = new Date();
  const prefix = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .like("invoice_number", `${prefix}%`);
  
  return `${prefix}-${String((count || 0) + 1).padStart(4, "0")}`;
}
```

### Step 5: Add Invoice Delete (Admin Only)

In `Billing.tsx`, add a delete button in the actions column, gated by user role:

```typescript
import { useUserRole } from "@/hooks/useUserRole";
const { role } = useUserRole();
const canDelete = role === "super_admin" || role === "manager";
```

The delete handler will:
1. Delete associated `customer_ledger` entries (by matching `reference_id` or invoice number in description)
2. Delete associated `payments` records
3. Delete the invoice itself
4. Recalculate running balances for affected customer (via re-fetching and re-ordering)

Add a confirmation dialog before deletion.

### Step 6: Add Payment Mode Selector

In the payment dialog (lines 461-498 of Billing.tsx), add a Select component for payment mode:

```typescript
const [paymentMode, setPaymentMode] = useState("cash");

// In dialog:
<Select value={paymentMode} onValueChange={setPaymentMode}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="cash">Cash</SelectItem>
    <SelectItem value="upi">UPI</SelectItem>
    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
    <SelectItem value="cheque">Cheque</SelectItem>
  </SelectContent>
</Select>
```

Update `handleRecordPayment` to use `paymentMode` variable instead of hardcoded `"cash"`.

### Step 7: Fix BulkInvoiceGenerator Existing Invoice Check

Change lines 108-112 from:
```typescript
.gte("billing_period_start", startDate)
.lte("billing_period_end", endDate)
```
To:
```typescript
.eq("billing_period_start", startDate)
.eq("billing_period_end", endDate)
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/billing/SmartInvoiceCreator.tsx` | Add query limit, fix amount calculation, use sequential invoice numbers |
| `src/components/billing/BulkInvoiceGenerator.tsx` | Add query limit, fix ledger balance, fix invoice numbers, fix existing invoice check |
| `src/components/billing/EditInvoiceDialog.tsx` | Add query limit, fix amount calculation |
| `src/components/billing/InvoicePDFGenerator.tsx` | Add query limit |
| `src/hooks/useAutoInvoiceGenerator.ts` | Add query limit |
| `src/pages/Billing.tsx` | Add delete invoice feature (admin only), add payment mode selector |
| `src/lib/invoice-helpers.ts` | Add shared `generateNextInvoiceNumber()` utility |

---

## Security Considerations

- Invoice deletion restricted to `super_admin` and `manager` roles only (checked client-side via `useUserRole` and enforced server-side by existing RLS policies)
- RLS policies already restrict DELETE on invoices to managers/admins - no DB changes needed
- Confirmation dialog required before deletion to prevent accidental data loss

