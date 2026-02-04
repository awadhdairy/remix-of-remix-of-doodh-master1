

# Implementation Plan: Add Date Range Filters & Sorting to High-Volume Pages

## Executive Summary

This plan adds intelligent date range filtering (30/60/90 days/All) and sorting capabilities to all pages that fetch large datasets from the backend. The implementation will reduce initial load times by limiting data fetched by default, while maintaining full data access when needed.

---

## Pages Requiring Filter/Sort Enhancement

Based on the codebase analysis, the following pages fetch large datasets and will benefit from this feature:

| Page | Table | Current Behavior | Risk Level |
|------|-------|------------------|------------|
| **Production** | `milk_production` | Hard limit of 100 rows | High - data loss |
| **Expenses** | `expenses` | Fetches ALL records | High - slow on large data |
| **Billing** | `invoices` | Fetches ALL records | Medium |
| **Health** | `cattle_health` | Fetches ALL records | Medium |
| **Milk Procurement** | `milk_procurement` | 30 days hardcoded | Low |
| **Audit Logs** | `activity_logs` | Limit 500 rows | Medium |
| **Deliveries** | `deliveries` | Date-filtered already | Low (already has date picker) |
| **Customers** | `customers` | Fetches ALL | Low (usually small) |
| **Cattle** | `cattle` | Fetches ALL | Low (usually small) |

**Priority Pages** (Large datasets, no current date filtering):
1. Production (CRITICAL - currently loses data)
2. Expenses (HIGH - can grow very large)
3. Billing (MEDIUM - invoices accumulate)
4. Health (MEDIUM - records accumulate)
5. Audit Logs (already has filters, needs sort enhancement)

---

## Design Approach

### Reusable Filter/Sort Component

Create a new reusable component `DataFilters` that can be used across all pages:

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ Last 30 Days │  │ Sort by: Date ▼ │  │ Order: Newest ▼    │ │
│  │ 60 | 90 | All│  └─────────────────┘  └─────────────────────┘ │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Filter Options
- **Last 30 Days** (default for most pages)
- **Last 60 Days**
- **Last 90 Days**
- **All Time** (with warning for large datasets)

### Sort Options (page-specific)
- Date (default: newest first)
- Amount (for financial pages)
- Name/Tag (for entity pages)
- Status (for pages with status fields)

---

## Implementation Details

### Component 1: Create DataFilters Component

**File**: `src/components/common/DataFilters.tsx`

```typescript
interface DataFiltersProps {
  dateRange: "30" | "60" | "90" | "all";
  onDateRangeChange: (range: "30" | "60" | "90" | "all") => void;
  sortBy?: string;
  sortOptions?: { value: string; label: string }[];
  onSortChange?: (field: string) => void;
  sortOrder?: "asc" | "desc";
  onSortOrderChange?: (order: "asc" | "desc") => void;
  showWarningOnAll?: boolean;
}
```

Features:
- Button group for date range selection
- Dropdown for sort field
- Toggle for sort order (asc/desc)
- Optional warning when "All" is selected
- Mobile-responsive layout

---

### Page 1: Production Page (CRITICAL)

**File**: `src/pages/Production.tsx`

**Current Issues**:
- Line 92: Hard limit of 100 records
- No date range filter
- Older production data becomes inaccessible

**Changes**:
1. Add `dateRange` state (default: "30")
2. Add `sortBy` state (options: date, quantity, cattle)
3. Replace `limit(100)` with date-based filtering
4. Add DataFilters component below PageHeader

**Updated Query Logic**:
```typescript
const startDate = dateRange === "all" 
  ? null 
  : format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");

// Query with date filter instead of hard limit
let query = supabase
  .from("milk_production")
  .select(`*, cattle:cattle_id (id, tag_number, name)`)
  .order(sortBy, { ascending: sortOrder === "asc" });

if (startDate) {
  query = query.gte("production_date", startDate);
}
```

**Sort Options**:
- `production_date` - Date (default)
- `quantity_liters` - Quantity
- `session` - Session (Morning/Evening)

---

### Page 2: Expenses Page

**File**: `src/pages/Expenses.tsx`

**Current Issues**:
- Line 85-88: Fetches ALL expenses with no limit
- Can become very slow as expenses accumulate

**Changes**:
1. Add `dateRange` state (default: "30")
2. Add `sortBy` state (options: date, amount, category)
3. Modify `fetchExpenses` to use date range filter

**Updated Query**:
```typescript
const startDate = dateRange === "all"
  ? null
  : format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");

let query = supabase
  .from("expenses")
  .select("*")
  .order(sortBy, { ascending: sortOrder === "asc" });

if (startDate) {
  query = query.gte("expense_date", startDate);
}
```

**Sort Options**:
- `expense_date` - Date (default)
- `amount` - Amount
- `category` - Category

---

### Page 3: Billing Page

**File**: `src/pages/Billing.tsx`

**Current Issues**:
- Line 88-94: Fetches ALL invoices
- No date range option

**Changes**:
1. Add `dateRange` state (default: "90" - invoices are less frequent)
2. Add `sortBy` state (options: date, amount, status)
3. Modify query to use date range

**Sort Options**:
- `created_at` - Date Created (default)
- `final_amount` - Amount
- `payment_status` - Status
- `billing_period_start` - Billing Period

---

### Page 4: Health Records Page

**File**: `src/pages/Health.tsx`

**Current Issues**:
- `useHealthData` hook fetches ALL records (line 43-47)
- No date filtering

**Changes**:
1. Modify `useHealthData` to accept date range parameter
2. Add state in Health.tsx for dateRange
3. Add DataFilters component

**Hook Modification** (`src/hooks/useHealthData.ts`):
```typescript
export function useHealthData(dateRange: "30" | "60" | "90" | "all" = "90") {
  const startDate = dateRange === "all"
    ? null
    : format(subDays(new Date(), parseInt(dateRange)), "yyyy-MM-dd");
  
  // Use startDate in query
}
```

**Sort Options**:
- `record_date` - Date (default)
- `record_type` - Type
- `cost` - Cost

---

### Page 5: Audit Logs Page

**File**: `src/pages/AuditLogs.tsx`

**Current Status**: Already has entity/action/date filters (good!)

**Enhancements**:
1. Add quick date range buttons (30/60/90 days)
2. Add sort order toggle
3. Already has limit(500) - enhance with date filtering

---

### Page 6: Milk Procurement Page

**File**: `src/pages/MilkProcurement.tsx`

**Current Status**: Line 194 has hardcoded 30-day filter

**Changes**:
1. Make the 30-day filter configurable
2. Add sortBy options

---

## Hook Modifications

### Update `useHealthData.ts`

Add optional date range parameter to the hook that accepts date filtering:

```typescript
async function fetchHealthData(startDate: string | null): Promise<HealthData> {
  let query = supabase
    .from("cattle_health")
    .select(`*, cattle:cattle_id (id, tag_number, name)`)
    .order("record_date", { ascending: false });
  
  if (startDate) {
    query = query.gte("record_date", startDate);
  }
  
  // ... rest of function
}
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/common/DataFilters.tsx` | CREATE | Reusable filter/sort component |
| `src/pages/Production.tsx` | MODIFY | Add date range & sort |
| `src/pages/Expenses.tsx` | MODIFY | Add date range & sort |
| `src/pages/Billing.tsx` | MODIFY | Add date range & sort |
| `src/pages/Health.tsx` | MODIFY | Add date range filter |
| `src/hooks/useHealthData.ts` | MODIFY | Accept date range param |
| `src/pages/MilkProcurement.tsx` | MODIFY | Make date range configurable |
| `src/pages/AuditLogs.tsx` | MODIFY | Add quick date buttons |

---

## UI/UX Design

### DataFilters Component Layout

```
Desktop:
┌────────────────────────────────────────────────────────────────┐
│ [30 Days] [60 Days] [90 Days] [All Time]    Sort: [Date ▼] [↓]│
└────────────────────────────────────────────────────────────────┘

Mobile:
┌─────────────────────────┐
│ [30] [60] [90] [All]    │
├─────────────────────────┤
│ Sort: [Date ▼]  [↓↑]    │
└─────────────────────────┘
```

### Visual Integration
- Placed below PageHeader, above data tables
- Consistent styling with existing Tabs components
- Subtle animation when filters change
- Loading indicator during data refresh

---

## Performance Considerations

1. **Default to 30 days** - Reduces initial load
2. **"All Time" warning** - Alert users about potential slow load
3. **URL state persistence** - Store filter state in URL params for bookmarking
4. **Query optimization** - Date filters push filtering to database level
5. **Memoization** - Use `useMemo` for expensive filtering operations

---

## Safety Guarantees

### What WILL NOT Change:
1. **All existing automation hooks** - Expense, ledger, delivery automation untouched
2. **Data insertion logic** - No changes to how data is created
3. **Edge functions** - All backend functions remain unchanged
4. **Database schema** - No table modifications
5. **RLS policies** - Security unchanged
6. **Invoice generation** - SmartInvoiceCreator unchanged
7. **Customer portal** - No changes to customer-facing pages

### Validation Points:
- All existing CRUD operations work identically
- Stats cards recalculate based on filtered data (where appropriate)
- Export functionality exports filtered data
- No data is deleted or modified

---

## Implementation Order

1. Create `DataFilters` component (foundation)
2. Production page (fixes critical data loss bug)
3. Expenses page (high impact)
4. Billing page (medium impact)
5. Health page + hook modification
6. MilkProcurement page
7. AuditLogs enhancement

This ensures the most critical fixes are applied first.

