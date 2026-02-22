

# Post-Implementation Comprehensive Audit — Fresh Analysis

After reading every relevant file from scratch, here are all issues found, categorized by severity.

---

## Verified Correct (No Issues)

These areas have been confirmed fully correct after the recent fixes:

- All 6 payment entry points use `insert_ledger_with_balance` RPC (atomic)
- SmartInvoiceCreator, BulkInvoiceGenerator, useAutoInvoiceGenerator all use `reference_id` in ledger entries
- Invoice deletion cleans up ledger by `reference_id` + description fallback, then recalculates
- EditInvoiceDialog finds ledger by `reference_id` first, then description fallback
- QuickAddOnOrderDialog does NOT create ledger entries (invoice-centric model correct)
- `auto-deliver-daily` edge function does NOT create ledger entries (correct)
- Revenue Growth Chart uses `billing_period_start`, `payments` table, `Math.max(0,...)` guard
- AccountantDashboard uses `billing_period_start`, `credit_balance` for pending, separate COUNT for overdue
- Reports.tsx uses `billing_period_start`, `payments` table, `Math.max(0,...)` guards
- Customers.tsx `totalDue` and `totalAdvance` now correctly derived from `credit_balance`
- Customers.tsx "Advance" column now uses `Math.max(0, -Number(item.credit_balance))`
- CustomerDetailDialog financial cards correctly show conditional Due/Credit based on `credit_balance` sign
- Billing.tsx stat cards now labeled "In selected period"
- Reports.tsx Net Profit labeled "Cash basis: Collections - Expenses"
- Expenses.tsx "This Month" stat shows partial warning when date range is narrower
- Edge function schedule parser uses `indexOf` + `substring` (not broken regex)
- Frontend `useAutoDeliveryScheduler` schedule parser also uses `indexOf` + `substring`
- Edge function supports `delivery_days` named-key format from the UI
- BulkInvoiceGenerator uses overlap-based duplicate detection

---

## Issues Found

### Issue 1: New Customer Save Writes Schedule to Notes TWICE (LOW-MEDIUM -- Data Corruption)

**Location:** `src/pages/Customers.tsx`, lines 314-334 (first write) and lines 465-479 (second write)

**Problem:** When creating a NEW customer:

1. Lines 314-323 build `scheduleMetadata` with `delivery_days`, `auto_deliver`, AND `product_schedules`, then set it into `payload.notes` as `notesWithSchedule`. The customer is inserted with this complete schedule at line 405.

2. Lines 465-479 then do a SECOND `.update()` that overwrites `notes` with a NEW `scheduleMetadata` object that contains only `delivery_days` and `auto_deliver` -- it OMITS `product_schedules`.

The second write at line 467-470 creates a simpler object:
```typescript
const scheduleMetadata = {
  delivery_days: subscriptionData.delivery_days,
  auto_deliver: subscriptionData.auto_deliver,
  // product_schedules is MISSING here
};
```

This means for NEW customers, the `product_schedules` per-product frequency/day configuration is immediately lost after creation. The edge function and frontend scheduler will not see per-product schedules for new customers.

For EXISTING customers (update path), this second write does NOT execute, so editing a customer preserves `product_schedules` correctly.

**Fix:** Remove the second `.update()` block at lines 465-479 entirely. The initial insert at line 405 already contains the complete schedule with `product_schedules`. The second write is a leftover from before the schedule was consolidated into the payload.

---

### Issue 2: Alternate-Day Algorithm Mismatch Between Frontend and Edge Function (MEDIUM -- Inconsistent Behavior)

**Location:** 
- `src/hooks/useAutoDeliveryScheduler.ts` lines 93-96 (reference-point algorithm)
- `supabase/functions/auto-deliver-daily/index.ts` line 277 (`dayOfMonth % 2`)

**Problem:** The frontend hook uses the standardized reference-point algorithm:
```typescript
const refDate = new Date(2024, 0, 1);
const daysSinceRef = Math.floor((targetDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
return daysSinceRef % 2 === 0;
```

The edge function uses a completely different algorithm:
```typescript
return dayOfMonth % 2 === 1;
```

These produce DIFFERENT results. For example, on Feb 28 (day of month 28, even), the edge function says NO delivery. But `daysSinceRef` for Feb 28, 2026 from Jan 1, 2024 = 789 days, 789 % 2 = 1, so the frontend also says NO. But on March 1 (day 1, odd), the edge function says YES, while `daysSinceRef` = 790, 790 % 2 = 0, frontend says YES. They happen to agree here, but the fundamental issue is that `dayOfMonth % 2` resets every month-boundary, causing consecutive deliveries on the 31st and 1st (both odd), while the reference-point algorithm provides truly alternating days.

Per the project memory: "The system utilizes a standardized reference-point algorithm for alternate day delivery scheduling."

**Fix:** Update the edge function's `alternate` case to use the same reference-point algorithm:
```typescript
case "alternate": {
  const refDate = new Date(2024, 0, 1);
  const daysSinceRef = Math.floor(
    (targetDateObj.getTime() - refDate.getTime()) / (86400000)
  );
  return daysSinceRef % 2 === 0;
}
```

---

### Issue 3: `useAutoInvoiceGenerator` Uses Exact Period Match for Duplicate Detection (MEDIUM -- Inconsistency)

**Location:** `src/hooks/useAutoInvoiceGenerator.ts` lines 186-192

**Problem:** While `BulkInvoiceGenerator` was fixed to use overlap-based detection (`.lte("billing_period_start", endDate).gte("billing_period_end", startDate)`), the `useAutoInvoiceGenerator` still uses exact match:
```typescript
.eq("billing_period_start", periodStart)
.eq("billing_period_end", periodEnd);
```

If a manual invoice was created for a slightly different period, the auto-generator will not detect it and will create a duplicate.

**Fix:** Update the duplicate detection query to use the same overlap logic as `BulkInvoiceGenerator`:
```typescript
.lte("billing_period_start", periodEnd)
.gte("billing_period_end", periodStart);
```

---

### Issue 4: CustomerDetailDialog Shows Redundant "Advance Credit" Card (LOW -- UI Duplication)

**Location:** `src/components/customers/CustomerDetailDialog.tsx` lines 541-553

**Problem:** When `credit_balance < 0` (customer has advance), the dialog shows:
1. A green "Credit Balance" card (line 528-539) -- correct, shows the advance amount
2. An ADDITIONAL green "Advance Credit" card (lines 541-553) showing the same value

Both cards display `Math.abs(credit_balance)` / `Math.max(0, -credit_balance)` which are identical values. The user sees the same number twice.

**Fix:** Remove the "Advance Credit" card at lines 541-553. The "Credit Balance" card already communicates the advance status.

---

### Issue 5: `parseScheduleFromNotes` May Parse Trailing Text as Part of JSON (LOW -- Potential Parse Error)

**Location:** `src/hooks/useAutoDeliveryScheduler.ts` lines 59-63 and `supabase/functions/auto-deliver-daily/index.ts` lines 253-256

**Problem:** Both parsers use `notes.substring(scheduleIdx + "Schedule:".length).trim()` which takes EVERYTHING after "Schedule:" as JSON. If the notes field contains text AFTER the JSON block (unlikely with current save logic but possible with manual edits), `JSON.parse` will fail because the string contains trailing non-JSON text.

The save logic at `Customers.tsx` line 322 stores schedule as the LAST element in notes (`...Schedule: {json}`), so this is safe with normal usage. But the `Customers.tsx` regex parser at line 242 uses `\{[\s\S]*\}` which greedily matches to the LAST `}`, which is more robust.

**Impact:** Low -- only affects manually edited notes. But adding a simple guard improves robustness.

**Fix:** In both parsers, extract only the JSON object by finding the matching closing brace, or wrap the `JSON.parse` in a try-catch with a fallback that tries to extract just the JSON portion. The current try-catch already handles failures gracefully (returns null / ignores), so this is already safe. No code change needed -- just noting it as a known limitation.

---

### Issue 6: Reports.tsx Still Fetches `advance_balance` from Customers (LOW -- Stale Field Reference)

**Location:** `src/pages/Reports.tsx` line 80

**Problem:**
```typescript
supabase.from("customers").select("is_active, credit_balance, advance_balance")
```

The `advance_balance` column is still being fetched even though the computed `totalAdvance` on line 156 correctly uses `-credit_balance`. The `advance_balance` field is fetched but never used after the fix. This is a dead fetch -- it wastes bandwidth but doesn't cause incorrect data.

**Fix:** Remove `advance_balance` from the select:
```typescript
supabase.from("customers").select("is_active, credit_balance")
```

---

## Summary Table

| # | File | Issue | Severity | Category |
|---|------|-------|----------|----------|
| 1 | `Customers.tsx` (new customer path) | Schedule saved twice; second write drops `product_schedules` | Medium | Data loss |
| 2 | `auto-deliver-daily/index.ts` | Alternate-day uses `dayOfMonth % 2` instead of reference-point algorithm | Medium | Inconsistency |
| 3 | `useAutoInvoiceGenerator.ts` | Exact period match for duplicates (not overlap-based like BulkInvoiceGenerator) | Medium | Logic gap |
| 4 | `CustomerDetailDialog.tsx` | Duplicate "Advance Credit" card shows same value as "Credit Balance" card | Low | UI clutter |
| 5 | `useAutoDeliveryScheduler.ts` + edge function | `substring` parser may include trailing text in JSON | Low | Robustness |
| 6 | `Reports.tsx` | Fetches unused `advance_balance` column | Low | Dead code |

---

## Priority Ranking

**Fix Immediately:**

1. **Issue 1** -- New customer schedule data loss. Every new customer loses their per-product delivery schedule configuration immediately after creation. The second `.update()` overwrites the complete schedule with a partial one.

2. **Issue 2** -- Alternate-day algorithm mismatch. The edge function (which runs daily via cron) uses a different algorithm than the frontend, violating the documented standard. Customers on alternate-day schedules may get deliveries on consecutive days at month boundaries.

3. **Issue 3** -- Auto-invoice generator duplicate detection. Uses exact period match while the bulk generator was already fixed to use overlap detection. Inconsistent safety net.

**Fix When Convenient:**

4. **Issue 4** -- Remove duplicate Advance Credit card
5. **Issue 6** -- Remove dead `advance_balance` fetch from Reports.tsx

**No Code Change Needed:**

6. **Issue 5** -- Already handled by try-catch; documenting as known limitation

---

## Files to Modify

1. `src/pages/Customers.tsx` -- Remove the second schedule `.update()` block for new customers (Issue 1)
2. `supabase/functions/auto-deliver-daily/index.ts` -- Fix alternate-day algorithm to use reference-point (Issue 2)
3. `src/hooks/useAutoInvoiceGenerator.ts` -- Change duplicate detection to overlap-based (Issue 3)
4. `src/components/customers/CustomerDetailDialog.tsx` -- Remove redundant Advance Credit card (Issue 4)
5. `src/pages/Reports.tsx` -- Remove `advance_balance` from select query (Issue 6)

