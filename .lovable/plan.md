
# Add Payment Button to Customers Page + Payment Status Visibility

## What Will Be Built

A "Record Payment" button in the Customers page (both in the table actions and in the CustomerDetailDialog) that allows recording payments directly against a customer -- either against a specific unpaid invoice or as a general/advance payment. The customer's payment status will be clearly visible throughout.

## Changes Overview

### 1. Customers Page Table - Add Payment Button in Actions Column
**File: `src/pages/Customers.tsx`**

- Add `IndianRupee` icon import from lucide-react
- Add state variables: `paymentDialogOpen`, `paymentAmount`, `paymentMode`, `paymentType` (invoice vs advance), `customerInvoices` (unpaid invoices for selected customer), `selectedInvoiceId`
- Add a new green "Pay" button in the actions column (between Ledger and Edit buttons)
- Clicking it opens a payment dialog for that customer
- Add a payment dialog that:
  - Fetches unpaid invoices for the selected customer
  - Shows current balance (credit_balance) prominently
  - Allows selecting an invoice OR recording as "advance/general" payment
  - Has amount input, payment mode selector (cash/upi/bank_transfer/cheque)
  - On submit: inserts into `payments` table, creates ledger entry with correct running_balance, updates invoice `paid_amount` and `payment_status` if invoice-linked, and invalidates all related queries (billing, customer, dashboard)

### 2. Customer Detail Dialog - Add Payment Button in Header
**File: `src/components/customers/CustomerDetailDialog.tsx`**

- Add a "Record Payment" button in the header area (next to "Add Order" and "Deliveries" buttons)
- Reuse the same payment recording pattern
- Add state for a payment sub-dialog within the detail dialog
- After payment, refresh the customer data (`fetchCustomerData`) so all tabs update immediately
- Add `useQueryClient` and invalidation imports to keep Billing page and Dashboard in sync

### 3. Payment Status Visibility on Customers Table
**File: `src/pages/Customers.tsx`**

- Enhance the "Due" column to show a visual indicator:
  - Red badge with amount when `credit_balance > 0` (customer owes money)
  - Green "Paid Up" badge when `credit_balance <= 0`
- The existing "Due" and "Advance" columns already show values; the payment button gives immediate actionability

### 4. Query Invalidation for Cross-Page Sync
After any payment is recorded from the Customers page:
- Invalidate `["expenses"]`, billing-related, customer-related queries
- Call `invalidateBillingRelated(queryClient)` and `invalidateCustomerRelated(queryClient)`
- Re-fetch customers list to update balance columns immediately

## Integration Points Verified
- **Payments table**: `invoice_id` is nullable -- supports general payments without an invoice
- **Customer ledger**: Payment creates a credit entry with computed running_balance
- **Database trigger**: `update_customer_balance_from_ledger` automatically recalculates `credit_balance` on customers table after ledger insert
- **Billing page**: Uses same `invoices` + `payments` tables, so invalidation keeps it consistent
- **Dashboard**: Revenue/billing charts are invalidated
- **Telegram notifications**: Payment notification will be sent (using existing `useTelegramNotify` hook)

## Technical Details

### Payment Recording Flow (same logic as Billing.tsx, adapted for customer context)
```
1. User clicks "Pay" on a customer row
2. Dialog opens, fetches unpaid invoices for that customer
3. User picks invoice (or "General Payment") + enters amount + mode
4. On submit:
   a. If invoice selected: update invoice paid_amount, compute new status
   b. Insert into payments table (invoice_id = selected or null)
   c. Fetch last ledger running_balance, compute new balance
   d. Insert ledger entry (type: "payment", credit_amount)
   e. Invalidate billing + customer + dashboard queries
   f. Re-fetch customers list
   g. Send Telegram notification
```

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Customers.tsx` | Add payment button in actions, payment dialog, payment handler, state variables |
| `src/components/customers/CustomerDetailDialog.tsx` | Add payment button in header, mini payment dialog, handler with data refresh |

### What Will NOT Change
- No database schema changes (payments table already supports this)
- No changes to Billing page logic
- No changes to ledger automation hooks
- No changes to any edge functions
- No changes to Telegram notification logic (reuse existing hooks)
