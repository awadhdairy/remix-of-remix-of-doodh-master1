

# Procurement Payment Integration -- Comprehensive Fix

## Core Problem

The procurement dialog's "Payment Status" dropdown is **purely cosmetic**. When a user selects "Paid", it only saves a text label to `milk_procurement.payment_status` -- it does NOT:
- Create a `vendor_payments` record
- Trigger the `recalculate_vendor_balance` DB function
- Auto-log an expense
- Show in payment history, recent activities, or anywhere else

Meanwhile, the `recalculate_vendor_balance` function calculates: `balance = SUM(milk_procurement.total_amount) - SUM(vendor_payments.amount)`. So even when marked "Paid", the balance still shows the full amount as owed because no payment was recorded.

---

## What Needs to Change

### 1. Procurement Dialog: Show Vendor Due & Enable Inline Payment (MilkProcurement.tsx)

When user selects a vendor in the procurement form:
- Display the vendor's **current balance** (amount owed to them) below the vendor selector
- When "Paid" is selected as payment status, show a **Payment Mode** selector (Cash, UPI, Bank Transfer, Cheque) and optional **Reference Number** field
- On save with status "Paid": insert into `vendor_payments` with the procurement's `total_amount`, auto-log expense, invalidate queries
- On save with status "Partial": show a **Paid Amount** field so user can specify how much was paid on the spot; insert that partial amount into `vendor_payments`
- On save with status "Pending": no payment record created (vendor balance increases by the procurement amount via the DB trigger on `milk_procurement`)

### 2. Form State Changes (MilkProcurement.tsx)

Add to `ProcurementFormData`:
- `payment_mode: string` (default "cash")
- `reference_number: string` (default "")  
- `paid_amount: string` (default "", used only for partial)

Update `emptyProcurementForm` and `handleOpenProcurementDialog` accordingly.

### 3. Save Logic Enhancement (MilkProcurement.tsx -- `handleSaveProcurement`)

After successful procurement insert/update:
- If `payment_status === "paid"` and `totalAmount > 0`:
  - Insert into `vendor_payments` with `amount = totalAmount`, `payment_mode`, `reference_number`, `notes = "Payment during procurement"`
  - Call `logVendorPaymentExpense()` to auto-create expense
  - Invalidate expense + recent-activities queries
- If `payment_status === "partial"` and `paidAmount > 0`:
  - Insert into `vendor_payments` with `amount = paidAmount`
  - Same expense + invalidation flow
- If `payment_status === "pending"`: no payment action needed

### 4. Edit Procurement: Handle Status Changes

When editing an existing procurement and changing payment_status from "pending" to "paid":
- Check if a vendor_payment already exists for this procurement (by checking notes pattern or a reference)
- If not, create the payment record
- If changing from "paid" back to "pending", warn user that the payment record already exists and won't be auto-deleted (manual deletion via Payments tab)

### 5. Calculated Total + Due Display in Dialog

Show a summary card in the procurement dialog:
- **Today's Total**: calculated amount for this procurement (qty × rate)
- **Vendor Current Due**: fetched from `milk_vendors.current_balance`
- **New Due After Save**: current_balance + today's total (if pending) or current_balance (if paid)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/MilkProcurement.tsx` | Add payment fields to form, show vendor balance, create vendor_payment on paid/partial status, expense logging, query invalidation |

No new files needed. No database changes needed -- existing `vendor_payments` table and `recalculate_vendor_balance` trigger handle everything.

---

## Financial Flow After Fix

```text
Procurement Saved (Pending)
  → milk_procurement INSERT
  → DB trigger recalculates vendor balance (+total_amount)
  → Vendor balance increases (owed more)

Procurement Saved (Paid)
  → milk_procurement INSERT
  → DB trigger recalculates vendor balance (+total_amount)
  → vendor_payments INSERT (same amount)
  → DB trigger recalculates vendor balance (-payment)
  → Net effect: vendor balance unchanged
  → Expense auto-logged
  → Shows in: Payments tab, Recent Activities, Expenses page

Procurement Saved (Partial, e.g. ₹500 of ₹1000)
  → milk_procurement INSERT (+₹1000)
  → vendor_payments INSERT (₹500)
  → Net effect: vendor balance increases by ₹500
  → Expense auto-logged for ₹500
```

## No Functionality Loss
- All existing vendor dialog payment flow remains untouched
- Existing procurement records with "paid" status are not retroactively modified
- The payment_status field on procurement still serves as a visual indicator
- The DB triggers remain the authoritative source for vendor balance

