

# Phase 2: Complete External Supabase Migration Plan

## Current Status Assessment

### Phase 1 Status: PARTIALLY COMPLETE

| Component | Status | Details |
|-----------|--------|---------|
| External Client File | Done | `src/lib/external-supabase.ts` created |
| Edge Functions (8) | Done | All use `EXTERNAL_SUPABASE_*` variables |
| setup-external-db Function | Done | Created but NOT RUN yet |
| Auth.tsx | Done | Uses external client |
| Secrets | Done | All 5 external secrets configured |
| bootstrap-admin | Done | Deleted |

### Critical Gap: 64 Files Still Use Lovable Cloud

The search found **64 files** still importing from `@/integrations/supabase/client` which points to Lovable Cloud. This includes:

**Hooks (16 files):**
- useUserRole.ts
- useCattleData.ts
- useCustomerAuth.tsx
- useBreedingData.ts
- useHealthData.ts
- useDashboardData.ts
- useDashboardCharts.ts
- useEquipmentData.ts
- useInventoryData.ts
- useProductionAnalytics.ts
- useMilkHistory.ts
- useAutoInvoiceGenerator.ts
- useAutoAttendance.ts
- useAutoDeliveryScheduler.ts
- useBreedingAlerts.ts
- useIntegratedAlerts.ts

**Pages (20+ files):**
- Dashboard.tsx
- Cattle.tsx
- Customers.tsx
- Deliveries.tsx
- Production.tsx
- Employees.tsx
- UserManagement.tsx
- Billing.tsx
- Expenses.tsx
- Reports.tsx
- Products.tsx
- Routes.tsx
- Bottles.tsx
- Breeding.tsx
- Health.tsx
- Inventory.tsx
- Equipment.tsx
- MilkProcurement.tsx
- Notifications.tsx
- AuditLogs.tsx
- Settings.tsx
- PriceRules.tsx

**Components (25+ files):**
- All dashboard components
- All customer components
- All delivery components
- All billing components
- Mobile components
- Report components

---

## Implementation Plan

### Step 1: Run setup-external-db Edge Function

Before making code changes, execute the setup function to:
- Create permanent super admin account
- Seed all dummy data (cattle, customers, products, deliveries, etc.)

```text
Call: POST https://htsfxnuttobkdquxwvjj.supabase.co/functions/v1/setup-external-db
```

This creates:
- 1 Super Admin (using BOOTSTRAP_ADMIN_PHONE/PIN)
- 1 Dairy Settings record
- 5 Products
- 2 Routes
- 5 Cattle
- 5 Customers with subscriptions
- 3 Employees
- 3 Bottles
- 3 Feed Inventory items
- 2 Shifts
- 2 Milk Vendors
- 3 Equipment
- 70+ Milk Production records (7 days)
- 35+ Deliveries with items (7 days)
- 21+ Attendance records (7 days)

---

### Step 2: Update All Hooks (16 files)

Change import from:
```typescript
import { supabase } from "@/integrations/supabase/client";
```

To:
```typescript
import { externalSupabase as supabase } from "@/lib/external-supabase";
```

**Files to update:**
1. src/hooks/useUserRole.ts
2. src/hooks/useCattleData.ts
3. src/hooks/useCustomerAuth.tsx
4. src/hooks/useBreedingData.ts
5. src/hooks/useHealthData.ts
6. src/hooks/useDashboardData.ts
7. src/hooks/useDashboardCharts.ts
8. src/hooks/useEquipmentData.ts
9. src/hooks/useInventoryData.ts
10. src/hooks/useProductionAnalytics.ts
11. src/hooks/useMilkHistory.ts
12. src/hooks/useAutoInvoiceGenerator.ts
13. src/hooks/useAutoAttendance.ts
14. src/hooks/useAutoDeliveryScheduler.ts
15. src/hooks/useBreedingAlerts.ts
16. src/hooks/useIntegratedAlerts.ts
17. src/hooks/useCattleStatusAutomation.ts
18. src/hooks/useExpenseAutomation.ts
19. src/hooks/useLedgerAutomation.ts
20. src/hooks/useInteractions.ts

---

### Step 3: Update All Pages (22 files)

Apply same import change to all pages:

1. src/pages/Cattle.tsx
2. src/pages/Customers.tsx
3. src/pages/Deliveries.tsx
4. src/pages/Production.tsx
5. src/pages/Employees.tsx
6. src/pages/UserManagement.tsx
7. src/pages/Billing.tsx
8. src/pages/Expenses.tsx
9. src/pages/Reports.tsx
10. src/pages/Products.tsx
11. src/pages/Routes.tsx
12. src/pages/Bottles.tsx
13. src/pages/Breeding.tsx
14. src/pages/Health.tsx
15. src/pages/Inventory.tsx
16. src/pages/Equipment.tsx
17. src/pages/MilkProcurement.tsx
18. src/pages/Notifications.tsx
19. src/pages/AuditLogs.tsx
20. src/pages/Settings.tsx
21. src/pages/PriceRules.tsx
22. src/pages/Index.tsx

**Customer Portal Pages:**
23. src/pages/customer/CustomerAuth.tsx
24. src/pages/customer/CustomerDashboard.tsx
25. src/pages/customer/CustomerBilling.tsx
26. src/pages/customer/CustomerDeliveries.tsx
27. src/pages/customer/CustomerProducts.tsx
28. src/pages/customer/CustomerProfile.tsx
29. src/pages/customer/CustomerSubscription.tsx

---

### Step 4: Update All Components (28 files)

**Dashboard Components:**
1. src/components/dashboard/AdminDashboard.tsx
2. src/components/dashboard/DeliveryDashboard.tsx
3. src/components/dashboard/FarmDashboard.tsx
4. src/components/dashboard/AccountantDashboard.tsx
5. src/components/dashboard/VetDashboard.tsx
6. src/components/dashboard/AuditorDashboard.tsx
7. src/components/dashboard/AlertsCard.tsx
8. src/components/dashboard/IntegratedAlertsCard.tsx
9. src/components/dashboard/QuickActionsCard.tsx
10. src/components/dashboard/RecentActivityCard.tsx
11. src/components/dashboard/StatCard.tsx

**Customer Components:**
12. src/components/customers/CustomerDetailDialog.tsx
13. src/components/customers/CustomerLedger.tsx
14. src/components/customers/CustomerAccountApprovals.tsx
15. src/components/customers/VacationManager.tsx
16. src/components/customers/QuickAddOnOrderDialog.tsx
17. src/components/customers/CustomerSubscriptionSelector.tsx
18. src/components/customers/CustomerDeliveryCalendar.tsx

**Other Components:**
19. src/components/cattle/CattlePedigreeDialog.tsx
20. src/components/billing/SmartInvoiceCreator.tsx
21. src/components/billing/BulkInvoiceGenerator.tsx
22. src/components/billing/EditInvoiceDialog.tsx
23. src/components/billing/InvoicePDFGenerator.tsx
24. src/components/deliveries/BulkDeliveryActions.tsx
25. src/components/deliveries/DeliveryItemsEditor.tsx
26. src/components/production/MilkHistoryDialog.tsx
27. src/components/breeding/BreedingCalendar.tsx
28. src/components/breeding/BreedingAlertsPanel.tsx
29. src/components/procurement/ProcurementAnalytics.tsx
30. src/components/procurement/VendorPaymentsDialog.tsx
31. src/components/reports/DailyDataTable.tsx
32. src/components/reports/DataBackupExport.tsx
33. src/components/employees/EmployeeDetailDialog.tsx
34. src/components/mobile/MobileNavbar.tsx
35. src/components/layout/AppSidebar.tsx
36. src/components/layout/DashboardLayout.tsx

---

### Step 5: Update lib/supabase-helpers.ts

This utility file also uses the Lovable Cloud client and needs updating.

---

## Technical Implementation Details

### Import Change Pattern

Every file will have this single-line change:

```typescript
// BEFORE
import { supabase } from "@/integrations/supabase/client";

// AFTER
import { externalSupabase as supabase } from "@/lib/external-supabase";
```

Using `as supabase` alias means:
- No other code changes needed in the files
- All existing `supabase.from()`, `supabase.auth.*`, `supabase.functions.invoke()` calls work unchanged
- Minimal risk of breaking changes

---

## File Changes Summary

| Category | Files | Action |
|----------|-------|--------|
| Hooks | 20 | Update import |
| Pages | 29 | Update import |
| Components | 36 | Update import |
| Lib/Utils | 1 | Update import |
| **Total** | **86** | **Update import** |

---

## Verification Steps

After implementation:

1. **Call setup-external-db** to seed data
2. **Test Login**: Use BOOTSTRAP_ADMIN_PHONE + BOOTSTRAP_ADMIN_PIN
3. **Verify Dashboard**: Should show cattle, customer, delivery stats
4. **Test CRUD**: Add/edit cattle, customers
5. **Test Edge Functions**: Create user, reset PIN
6. **Test Customer Portal**: Customer login if applicable

---

## Zero Lovable Cloud Dependency Checklist

After completion:
- Frontend connects ONLY to htsfxnuttobkdquxwvjj.supabase.co
- All edge functions use EXTERNAL_SUPABASE_* secrets
- No imports from @/integrations/supabase/client in use
- All data stored in external Supabase
- Authentication against external Supabase Auth
- No database queries to Lovable Cloud

---

## Security Notes

- All credentials stored in external Supabase secrets
- PIN hashes use bcrypt via pgcrypto extension
- RLS policies enforced on all tables
- No sensitive data transits through Lovable Cloud
- External Supabase fully controls data access

