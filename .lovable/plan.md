

# Comprehensive Fix: Invoice Preview + Dashboard Data Sync

## Problem 1: Invoice Preview Not Opening

The `InvoicePDFGenerator` component renders a `Dialog` containing an `iframe` with a PDF data URI. The component is rendered **inside a DataTable cell**, which can cause z-index and overflow issues preventing the dialog from appearing properly. The fix is to ensure the Dialog renders via a portal at the document root level and that the iframe gets proper dimensions.

## Problem 2: Dashboard Data Not Syncing

The dashboard query cache invalidation utility (`src/lib/query-invalidation.ts`) was planned in a previous session but **was never actually created**. No page (Production, Deliveries, Billing, Customers, Expenses, Procurement) invalidates any dashboard query keys after mutations. Combined with a 5-minute `staleTime` and `refetchOnWindowFocus: false`, the dashboard shows stale data until manually refreshed.

---

## Implementation

### Step 1: Fix Invoice Preview Dialog

**File: `src/components/billing/InvoicePDFGenerator.tsx`**

- Move the Dialog outside the component's inline render position by ensuring it uses React Portal (Radix Dialog does this by default, but the containing DataTable cell may have `overflow: hidden`)
- Add explicit `min-h-0` and `flex` layout to the DialogContent so the iframe fills the available space
- Ensure `pdfDataUrl` is set before opening the dialog (race condition guard)

### Step 2: Create Query Invalidation Utility (Missing File)

**New File: `src/lib/query-invalidation.ts`**

Create the centralized invalidation utility with helpers for each data domain:
- `invalidateProductionRelated` -- dashboard-data, weekly-production-chart, recent-activities, production-insights, month-comparison-chart, procurement-vs-production-chart
- `invalidateDeliveryRelated` -- dashboard-data, delivery-performance-chart, recent-activities
- `invalidateBillingRelated` -- dashboard-data, revenue-growth-chart, recent-activities, month-comparison-chart
- `invalidateCustomerRelated` -- dashboard-data, customer-growth-chart, recent-activities
- `invalidateCattleRelated` -- cattle, dashboard-data, cattle-composition-chart
- `invalidateExpenseRelated` -- expenses, expense-breakdown-chart, month-comparison-chart, dashboard-data
- `invalidateProcurementRelated` -- dashboard-data, procurement-vs-production-chart, recent-activities

### Step 3: Integrate Invalidation into All Pages

Add `useQueryClient` + invalidation calls after every successful mutation:

| File | After Event | Invalidation Function |
|------|-------------|----------------------|
| `src/pages/Production.tsx` | Save production (line 203) | `invalidateProductionRelated` |
| `src/pages/Deliveries.tsx` | Create/update delivery (lines 165, 189) | `invalidateDeliveryRelated` |
| `src/pages/Billing.tsx` | Record payment (line 224), delete invoice (line 289) | `invalidateBillingRelated` |
| `src/pages/Customers.tsx` | Create/update/delete customer | `invalidateCustomerRelated` |
| `src/pages/Expenses.tsx` | Create/update/delete expense | `invalidateExpenseRelated` |
| `src/pages/MilkProcurement.tsx` | Save procurement | `invalidateProcurementRelated` |
| `src/hooks/useCattleData.ts` | Create/update/delete cattle | `invalidateCattleRelated` |
| `src/hooks/useHealthData.ts` | Create health record | `invalidateExpenseRelated` (health creates expenses) |
| `src/hooks/useInventoryData.ts` | Stock update | `invalidateExpenseRelated` |
| `src/hooks/useEquipmentData.ts` | Add equipment/maintenance | `invalidateExpenseRelated` |

### Step 4: Optimize Dashboard Cache Settings

**File: `src/hooks/useDashboardData.ts`**

- Reduce `staleTime` from 5 minutes to 1 minute
- Enable `refetchOnWindowFocus: true`

**File: `src/hooks/useDashboardCharts.ts`**

- Reduce `staleTime` from 5 minutes to 2 minutes for all chart hooks
- Enable `refetchOnWindowFocus: true`

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/billing/InvoicePDFGenerator.tsx` | Fix dialog layout for iframe preview |
| `src/lib/query-invalidation.ts` | **NEW** - Centralized cache invalidation utility |
| `src/hooks/useDashboardData.ts` | Reduce staleTime, enable refetchOnWindowFocus |
| `src/hooks/useDashboardCharts.ts` | Reduce staleTime, enable refetchOnWindowFocus |
| `src/pages/Production.tsx` | Add query invalidation after save |
| `src/pages/Deliveries.tsx` | Add query invalidation after create/update |
| `src/pages/Billing.tsx` | Add query invalidation after payment/delete |
| `src/pages/Customers.tsx` | Add query invalidation after CRUD |
| `src/pages/Expenses.tsx` | Add query invalidation after CRUD |
| `src/pages/MilkProcurement.tsx` | Add query invalidation after save |
| `src/hooks/useCattleData.ts` | Add dashboard invalidation to mutations |
| `src/hooks/useHealthData.ts` | Add dashboard invalidation to mutations |
| `src/hooks/useInventoryData.ts` | Add dashboard invalidation to mutations |
| `src/hooks/useEquipmentData.ts` | Add dashboard invalidation to mutations |

---

## Safety Guarantees

- No existing functionality removed -- only adding invalidation calls after existing success handlers
- No automation or integration affected -- Telegram notifications remain intact
- No UI changes except fixing the invoice preview dialog dimensions
- All existing query keys preserved; only adding invalidation triggers
- Existing hooks and components remain unchanged in their core logic

