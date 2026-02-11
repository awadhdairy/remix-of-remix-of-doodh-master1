

# Cattle Detail Popup - Comprehensive View on Tag Click

## Overview

Create a new `CattleDetailDialog` component that opens when clicking a cattle's tag number in the DataTable. It will display all comprehensive information about the cattle in organized, tabbed sections -- fetching health records, breeding records, and milk production data in real time.

## What Will Be Built

A mobile-responsive popup (Dialog on desktop, Drawer on mobile) with the following tabbed sections:

### Tab 1: Overview
- Tag number, name, breed, type (cow/buffalo)
- Status, lactation status badges
- Date of birth, calculated age
- Weight
- Parents (sire/dam) with tag numbers (from existing cattle data)
- Notes

### Tab 2: Health Records
- Fetched from `cattle_health` table filtered by `cattle_id`
- Shows: date, type (vaccination/checkup/disease/treatment), title, vet name, cost, next due date
- Sorted by date descending, limited to recent 20 records

### Tab 3: Breeding Records
- Fetched from `breeding_records` table filtered by `cattle_id`
- Shows: date, type (heat detection/AI/pregnancy check/calving), bull name, pregnancy confirmed, expected/actual calving date, calf details
- Sorted by date descending

### Tab 4: Milk Production
- Fetched from `milk_production` table filtered by `cattle_id` (last 30 days)
- Shows daily morning/evening quantities with trends
- Reuses the existing `useMilkHistory` hook's `fetchCattleHistory` logic

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/cattle/CattleDetailDialog.tsx` | **NEW** | The comprehensive detail popup component |
| `src/pages/Cattle.tsx` | **MODIFY** | Add click handler on tag number column, add state + render for the new dialog |

## Technical Details

### New Component: `CattleDetailDialog.tsx`

- Props: `open`, `onOpenChange`, `cattle: Cattle` (the full cattle object from parent), `allCattle: Cattle[]` (for resolving parent names)
- Uses `ResponsiveDialog` for mobile support
- Internal state fetches health, breeding, and milk data on open via `useEffect`
- Uses `Tabs` component for section switching
- All data fetched directly from `externalSupabase` (consistent with existing patterns)
- Skeleton loading states while data loads

### Cattle.tsx Changes

- Add state: `detailDialogOpen`, `detailCattle`
- Add handler: `handleOpenDetail(cattle)` that sets both states
- Modify tag_number column render to wrap in a clickable button/link
- Render `<CattleDetailDialog>` at the bottom of the component

### Data Queries Inside Dialog

```typescript
// Health records for this cattle
const { data: healthRecords } = await supabase
  .from("cattle_health")
  .select("*")
  .eq("cattle_id", cattleId)
  .order("record_date", { ascending: false })
  .limit(20);

// Breeding records for this cattle
const { data: breedingRecords } = await supabase
  .from("breeding_records")
  .select("*")
  .eq("cattle_id", cattleId)
  .order("record_date", { ascending: false })
  .limit(20);

// Milk production (last 30 days)
const { data: milkRecords } = await supabase
  .from("milk_production")
  .select("production_date, session, quantity_liters, fat_percentage, snf_percentage")
  .eq("cattle_id", cattleId)
  .gte("production_date", thirtyDaysAgo)
  .order("production_date", { ascending: false });
```

## Safety Guarantees

- No existing functionality modified -- the tag number column just gains an `onClick`, all existing action buttons (edit, delete, pedigree, milk history) remain unchanged
- No hooks or automations affected
- No database changes required
- Telegram notifications untouched
- All existing dialogs (add/edit, delete confirm, pedigree, milk history) remain fully functional

