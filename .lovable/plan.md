
# Comprehensive Plan: Fix Billing Calculations and Overdue Detection

## Executive Summary

This plan fixes **3 critical billing calculation issues** identified in the codebase that lead to incorrect financial reporting:

1. **Pending Stat Error**: Shows full invoice amount instead of remaining balance
2. **Missing Partial Status**: Partial payments not included in outstanding totals  
3. **No Overdue Detection**: System never marks invoices as "overdue" when due date passes

---

## Issue Analysis

### Current Code Problems

| Location | Issue | Impact |
|----------|-------|--------|
| `Billing.tsx` Line 219 | Pending uses `final_amount` instead of `final_amount - paid_amount` | Overstates pending by amount already paid |
| `Billing.tsx` Line 219 | Only filters `payment_status === "pending"` | Excludes partial payments from outstanding |
| `Billing.tsx` Line 220 | Relies on `payment_status === "overdue"` | Never shows overdue (status never set) |
| `useDashboardData.ts` Line 135 | Correct calculation for pending | Good - uses `final_amount - paid_amount` |
| `AccountantDashboard.tsx` Line 92-94 | Correct calculation | Good - uses remaining balance |

### Root Cause: No Overdue Automation

The `invoices` table has a `payment_status` enum: `["paid", "partial", "pending", "overdue"]`

However, **nothing in the codebase ever sets `payment_status = "overdue"`**. The system expects:
- `SmartInvoiceCreator.tsx` creates invoices with `payment_status: "pending"`
- `Billing.tsx` changes status to `"partial"` or `"paid"` on payment
- But **no code checks due dates** and updates to `"overdue"`

---

## Solution Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        BILLING STATS FIX                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Current (Broken):                                                     │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ pending = invoices.filter(status === "pending")              │     │
│  │           .reduce(sum + final_amount)                        │     │
│  │                                                              │     │
│  │ overdue = invoices.filter(status === "overdue")              │     │
│  │           .reduce(sum + (final_amount - paid_amount))        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│  Fixed:                                                                │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ Helper: isOverdue(invoice) =>                                │     │
│  │   due_date < today && status !== "paid"                      │     │
│  │                                                              │     │
│  │ Helper: getBalance(invoice) =>                               │     │
│  │   final_amount - paid_amount                                 │     │
│  │                                                              │     │
│  │ outstanding = invoices.filter(status !== "paid")             │     │
│  │               .reduce(sum + getBalance(invoice))             │     │
│  │                                                              │     │
│  │ overdue = invoices.filter(isOverdue)                         │     │
│  │           .reduce(sum + getBalance(invoice))                 │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Part 1: Fix Billing Page Stats (src/pages/Billing.tsx)

**Current Code (Lines 216-221):**
```typescript
const stats = {
  total: invoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
  collected: invoices.reduce((sum, i) => sum + Number(i.paid_amount), 0),
  pending: invoices.filter(i => i.payment_status === "pending").reduce((sum, i) => sum + Number(i.final_amount), 0),
  overdue: invoices.filter(i => i.payment_status === "overdue").reduce((sum, i) => sum + (Number(i.final_amount) - Number(i.paid_amount)), 0),
};
```

**Fixed Code:**
```typescript
// Helper to detect overdue based on due_date
const isOverdue = (invoice: InvoiceWithCustomer) => {
  if (invoice.payment_status === "paid") return false;
  if (!invoice.due_date) return false;
  return new Date(invoice.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
};

// Helper to get remaining balance
const getBalance = (invoice: InvoiceWithCustomer) => 
  Number(invoice.final_amount) - Number(invoice.paid_amount);

const stats = {
  total: invoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
  collected: invoices.reduce((sum, i) => sum + Number(i.paid_amount), 0),
  // Outstanding: All unpaid invoices (pending + partial + overdue) - remaining balance only
  outstanding: invoices
    .filter(i => i.payment_status !== "paid")
    .reduce((sum, i) => sum + getBalance(i), 0),
  // Overdue: Based on due_date comparison, not status field
  overdue: invoices
    .filter(i => isOverdue(i))
    .reduce((sum, i) => sum + getBalance(i), 0),
};
```

**UI Card Updates:**
- Rename "Pending" card to "Outstanding" (more accurate)
- Keep "Overdue" card showing date-based overdue calculation
- Update card subtitle to show count of overdue invoices

---

### Part 2: Update Status Badge Display for Overdue

Since the `payment_status` field in the database may not reflect overdue status, we need to compute it at display time.

**Update Status Column in Billing.tsx:**
```typescript
{
  key: "payment_status",
  header: "Status",
  render: (item: InvoiceWithCustomer) => {
    // Compute effective status (check if overdue by date)
    let effectiveStatus = item.payment_status;
    if (item.payment_status !== "paid" && item.due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(item.due_date) < today) {
        effectiveStatus = "overdue";
      }
    }
    return <StatusBadge status={effectiveStatus} />;
  },
},
```

---

### Part 3: Update Status Tab Filtering

The status tabs should also use computed overdue status:

**Current (Line 212-214):**
```typescript
const filteredInvoices = statusFilter === "all" 
  ? invoices 
  : invoices.filter(i => i.payment_status === statusFilter);
```

**Fixed:**
```typescript
// Compute effective status for each invoice
const getEffectiveStatus = (invoice: InvoiceWithCustomer) => {
  if (invoice.payment_status === "paid") return "paid";
  if (invoice.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(invoice.due_date) < today) {
      return "overdue";
    }
  }
  return invoice.payment_status; // "pending" or "partial"
};

const filteredInvoices = statusFilter === "all" 
  ? invoices 
  : invoices.filter(i => getEffectiveStatus(i) === statusFilter);
```

---

### Part 4: Create Reusable Invoice Status Helper

Create a utility function for consistent status computation across the app:

**New File: src/lib/invoice-helpers.ts**
```typescript
export interface InvoiceBase {
  payment_status: string;
  due_date: string | null;
  final_amount: number;
  paid_amount: number;
}

/**
 * Get effective payment status considering due date
 * Returns "overdue" if past due date and not fully paid
 */
export function getEffectivePaymentStatus(invoice: InvoiceBase): string {
  if (invoice.payment_status === "paid") return "paid";
  
  if (invoice.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.due_date);
    if (dueDate < today) {
      return "overdue";
    }
  }
  
  return invoice.payment_status; // "pending" or "partial"
}

/**
 * Get remaining balance on invoice
 */
export function getInvoiceBalance(invoice: InvoiceBase): number {
  return Number(invoice.final_amount) - Number(invoice.paid_amount);
}

/**
 * Check if invoice is overdue
 */
export function isInvoiceOverdue(invoice: InvoiceBase): boolean {
  return getEffectivePaymentStatus(invoice) === "overdue";
}
```

---

### Part 5: Update AccountantDashboard.tsx

The AccountantDashboard already has good calculations but should also use the helper:

**Current overdue query (Lines 68-81):**
Uses `.neq("payment_status", "paid").lt("due_date", todayStr)` which is correct

**Enhancement:** Use the helper for consistency and add count:
```typescript
// Calculate overdue amount from the same data
const overdueAmount = overdue.reduce(
  (sum, inv) => sum + (Number(inv.final_amount) - Number(inv.paid_amount || 0)), 
  0
);
```

---

### Part 6: Update CustomerDetailDialog.tsx

**Current (Lines 234-235):**
```typescript
const paidInvoices = invoices.filter(i => i.payment_status === "paid").length;
const pendingInvoices = invoices.filter(i => i.payment_status === "pending" || i.payment_status === "partial").length;
```

**Fixed - Include overdue detection:**
```typescript
import { getEffectivePaymentStatus } from "@/lib/invoice-helpers";

const paidInvoices = invoices.filter(i => i.payment_status === "paid").length;
const pendingInvoices = invoices.filter(i => 
  getEffectivePaymentStatus(i) !== "paid"
).length;
const overdueInvoices = invoices.filter(i => 
  getEffectivePaymentStatus(i) === "overdue"
).length;
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/invoice-helpers.ts` | CREATE | Reusable invoice status & balance helpers |
| `src/pages/Billing.tsx` | MODIFY | Fix stats calculation, status display, filtering |
| `src/components/customers/CustomerDetailDialog.tsx` | MODIFY | Use helpers for invoice counts |
| `src/components/dashboard/AccountantDashboard.tsx` | VERIFY | Already correct, minor cleanup |

---

## Stat Card Changes Summary

### Before (Billing Page)
| Card | Calculation | Problem |
|------|-------------|---------|
| Total Billed | sum(final_amount) | Correct |
| Collected | sum(paid_amount) | Correct |
| Pending | status="pending" sum(final_amount) | Wrong: uses full amount, excludes partial |
| Overdue | status="overdue" sum(balance) | Wrong: status never set to overdue |

### After (Billing Page)
| Card | Calculation | Result |
|------|-------------|--------|
| Total Billed | sum(final_amount) | Correct |
| Collected | sum(paid_amount) | Correct |
| Outstanding | status!="paid" sum(balance) | Correct: all unpaid, remaining balance |
| Overdue | due_date<today sum(balance) | Correct: date-based detection |

---

## Safety Guarantees

### What Will NOT Change:
1. **Invoice creation logic** - SmartInvoiceCreator unchanged
2. **Payment recording logic** - handleRecordPayment unchanged  
3. **Ledger entries** - All ledger automation intact
4. **Database schema** - No table modifications
5. **RLS policies** - Security unchanged
6. **Customer portal billing** - CustomerBilling.tsx only displays, calculations are display-only

### Validation Points:
- Stats will now accurately reflect true financial position
- Overdue invoices show correctly without needing status field update
- All existing CRUD operations work identically
- Tab filtering works with computed status

---

## Testing Checklist

After implementation, verify:
1. Create new invoice -> appears in "Pending" tab with full balance
2. Record partial payment -> appears in "Partial" tab with remaining balance
3. Invoice past due date -> appears in "Overdue" tab automatically
4. Record full payment -> moves to "Paid" tab
5. Stats cards show correct totals:
   - Outstanding = Total Billed - Collected
   - Overdue subset of Outstanding based on dates
6. AccountantDashboard overdue list matches Billing page

