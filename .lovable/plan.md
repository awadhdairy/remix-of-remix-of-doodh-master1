

# Post-Implementation Audit: Remaining Issues

After a complete review of all financial flows following the latest round of fixes, here is the final list of remaining issues.

---

## Issue 1: BulkInvoiceGenerator STILL Uses Manual Ledger Insert (HIGH -- Missed File)

**Location:** `src/components/billing/BulkInvoiceGenerator.tsx` (lines 236-258)

**Problem:** This file was completely missed during the atomic ledger migration. It still uses the old manual "fetch last balance, compute, insert" pattern:

```
const { data: lastEntry } = await supabase
  .from("customer_ledger")
  .select("running_balance")
  ...
const newBalance = previousBalance + summary.total_amount;
await supabase.from("customer_ledger").insert({
  running_balance: newBalance,
});
```

This is the exact race condition that was fixed in every other file. Additionally:
- The insert has no `reference_id`, so invoice deletion cannot reliably find this ledger entry
- If multiple invoices are generated simultaneously for different customers, balance drift is possible

**Fix:** Replace lines 236-258 with:
```typescript
await supabase.rpc("insert_ledger_with_balance", {
  _customer_id: summary.customer_id,
  _transaction_date: new Date().toISOString().split("T")[0],
  _transaction_type: "invoice",
  _description: `Invoice ${invoiceNumber} for ${format(new Date(startDate), "MMM dd")} - ${format(new Date(endDate), "MMM dd")}`,
  _debit_amount: summary.total_amount,
  _credit_amount: 0,
  _reference_id: invoiceData?.id || null,
});
```

Also update the invoice insert to use `.select("id").single()` to retrieve the invoice ID for `reference_id`.

---

## Issue 2: EditInvoiceDialog Finds Ledger by Description Match (MEDIUM -- Fragile Lookup)

**Location:** `src/components/billing/EditInvoiceDialog.tsx` (lines 349-355)

**Problem:** When updating a ledger entry after an invoice edit, the code finds it by:
```typescript
.eq("transaction_type", "invoice")
.ilike("description", `%${invoice.invoice_number}%`)
```

This is fragile because:
- If the description format changes in the future, the match breaks
- If two invoices have similar numbers (e.g., INV-202602-0001 matching INV-202602-00010), a false match could occur

Now that SmartInvoiceCreator and useAutoInvoiceGenerator both set `reference_id`, new invoices can be found by `reference_id`. But older invoices created before the fix, and BulkInvoiceGenerator invoices (Issue 1), still lack `reference_id`.

**Fix:** Use a two-step lookup: try `reference_id` first, fall back to description match:
```typescript
// Try reference_id first (reliable)
let { data: ledgerEntry } = await supabase
  .from("customer_ledger")
  .select("id, debit_amount")
  .eq("reference_id", invoice.id)
  .eq("transaction_type", "invoice")
  .single();

// Fallback to description match for older entries
if (!ledgerEntry) {
  const { data: fallback } = await supabase
    .from("customer_ledger")
    .select("id, debit_amount")
    .eq("customer_id", invoice.customer_id)
    .eq("transaction_type", "invoice")
    .ilike("description", `%${invoice.invoice_number}%`)
    .single();
  ledgerEntry = fallback;
}
```

---

## Issue 3: Invoice Deletion Also Uses Fragile Description Match (MEDIUM -- Same Pattern)

**Location:** `src/pages/Billing.tsx` (lines 257-262)

**Problem:** Same issue as Issue 2. Invoice ledger deletion uses:
```typescript
.eq("transaction_type", "invoice")
.ilike("description", `%${deletingInvoice.invoice_number}%`)
```

For newer invoices (created after the reference_id fix), this works but is unnecessarily fragile when `reference_id` is available.

**Fix:** Same two-step approach: try `reference_id` first, fall back to description:
```typescript
// Delete by reference_id first (covers new invoices)
await supabase
  .from("customer_ledger")
  .delete()
  .eq("reference_id", deletingInvoice.id)
  .eq("transaction_type", "invoice");

// Also delete by description match (covers pre-fix invoices)
await supabase
  .from("customer_ledger")
  .delete()
  .eq("customer_id", deletingInvoice.customer_id)
  .eq("transaction_type", "invoice")
  .ilike("description", `%${deletingInvoice.invoice_number}%`);
```

---

## Issue 4: Billing "Collected" Stat Label Misleads (LOW -- Cosmetic)

**Location:** `src/pages/Billing.tsx` (line 320, 463)

**Problem:** The "Collected" stat uses `invoices.paid_amount` (capped at invoice total per overpayment fix). If a customer overpays, the stat understates collections compared to the dashboard/reports which use the `payments` table.

The label "Collected" is ambiguous -- it could mean total cash received or total applied to invoices.

**Fix:** Relabel to "Invoice Payments" or add a subtitle "Applied to invoices" to distinguish from the dashboard "Collected" which includes all payments.

---

## Summary

| # | Issue | Impact | Effort | Category |
|---|-------|--------|--------|----------|
| 1 | BulkInvoiceGenerator manual ledger insert (race condition + no reference_id) | High | Low | Missed file from previous fix rounds |
| 2 | EditInvoiceDialog uses fragile description match for ledger lookup | Medium | Low | Data integrity risk |
| 3 | Invoice deletion uses fragile description match | Medium | Low | Data integrity risk |
| 4 | Billing "Collected" label ambiguity | Low | Trivial | Cosmetic |

## What Is Now Working Correctly

- QuickAddOnOrderDialog uses atomic RPC (fixed in last round)
- SmartInvoiceCreator uses atomic RPC with reference_id (fixed in last round)
- CustomerDetailDialog uses atomic RPC (fixed in last round)
- Billing.tsx payment uses atomic RPC (fixed earlier)
- Customers.tsx payment uses atomic RPC (fixed earlier)
- useLedgerAutomation.ts uses atomic RPC (fixed earlier)
- useAutoInvoiceGenerator.ts creates ledger entries with reference_id (fixed in last round)
- Revenue Growth Chart uses payments table (fixed in last round)
- Reports.tsx uses payments table with non-negative pending (fixed in last round)
- AccountantDashboard uses cash-basis profit (fixed earlier)
- Invoice edit triggers recalculate_ledger_balances (fixed earlier)
- Invoice deletion triggers recalculate_ledger_balances (fixed earlier)
- Overpayment capping on invoice paid_amount (fixed earlier)
- update_customer_balance_from_ledger DB trigger syncs customers.credit_balance
- Vendor payables tracking is accurate

## Recommended Priority

Fix Issue 1 immediately -- it is the last remaining race condition in a ledger write path. Issues 2 and 3 should follow to make ledger lookups robust. Issue 4 is optional polish.

