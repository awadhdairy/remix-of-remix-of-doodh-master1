

# Fix: Broken Schedule Parser in useAutoDeliveryScheduler + Edge Function delivery_days Support

## Problem Summary

There are two related issues:

1. **Frontend hook broken regex (useAutoDeliveryScheduler.ts line 59):** The `parseScheduleFromNotes` function uses the regex `{[^}]+}` which cannot parse nested JSON objects. All custom schedules silently fail and customers default to daily delivery when scheduled from the dashboard UI.

2. **Edge function ignores `delivery_days` (auto-deliver-daily/index.ts):** The edge function's `shouldDeliverToday` correctly parses the JSON (indexOf fix already applied), but only checks `schedule.frequency`, `schedule.day`, and `schedule.days`. The UI actually stores delivery configuration as `schedule.delivery_days` (with keys like `monday`, `tuesday`, etc.) and per-product schedules under `schedule.product_schedules`. The edge function never reads these fields, so customers with custom day selections are still treated as daily.

## What the UI Actually Stores

When a customer is saved, the notes field contains:
```
Schedule: {"delivery_days":{"monday":true,"tuesday":true,"wednesday":false,...},"auto_deliver":true,"product_schedules":{"<product-uuid>":{"frequency":"weekly","delivery_days":{"monday":true,...}}}}
```

Key fields:
- `delivery_days` — global day-of-week toggles (named keys: monday, tuesday, etc.)
- `auto_deliver` — boolean flag
- `product_schedules` — per-product overrides with `frequency` and `delivery_days`

## Changes

### File 1: `src/hooks/useAutoDeliveryScheduler.ts`

**Fix the broken regex** at line 59. Replace:
```typescript
const scheduleMatch = notes.match(/Schedule:\s*({[^}]+})/);
```
With the same indexOf + substring approach used in the edge function:
```typescript
const scheduleIdx = notes.indexOf("Schedule:");
if (scheduleIdx !== -1) {
  const jsonStr = notes.substring(scheduleIdx + "Schedule:".length).trim();
  return JSON.parse(jsonStr);
}
```

### File 2: `supabase/functions/auto-deliver-daily/index.ts`

**Add `delivery_days` support** to `shouldDeliverToday`. After parsing the schedule, check if `schedule.delivery_days` exists (the UI-written format with named day keys). If it does, map the current day-of-week number to the named key and return whether that day is enabled.

The updated logic priority becomes:
1. If `schedule.delivery_days` exists (UI format) -- use it directly
2. Else fall back to `schedule.frequency` / `schedule.days` / `schedule.day` (legacy format)
3. Else fall back to `customer.subscription_type`

This ensures both the UI-written schedule format and any legacy formats are handled correctly.

## Technical Details

- Day-of-week mapping: JS `getDay()` returns 0=Sunday, 1=Monday, etc.
- Named key mapping: `{0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday"}`
- The edge function will be redeployed after the change
- No database changes required
- No other files affected -- the Customers.tsx parser at line 242 already uses `[\s\S]*` (greedy, handles nested JSON correctly)
