

# Fix: Select.Item Empty Value Error

## Root Cause

**Line 315 in `src/pages/Routes.tsx`**:
```typescript
<SelectItem value="">Unassigned</SelectItem>
```

Radix UI's `<Select.Item />` component explicitly throws an error when given an empty string (`""`) as a value because empty string is reserved for "clearing the selection."

## Solution

Replace empty string values with a meaningful placeholder value like `"__none__"` or `"unassigned"`, then handle this in the form submission logic.

## Changes Required

### File: `src/pages/Routes.tsx`

**Line 315**: Change from:
```typescript
<SelectItem value="">Unassigned</SelectItem>
```

To:
```typescript
<SelectItem value="__unassigned__">Unassigned</SelectItem>
```

**Line 104**: Update the payload handling:
```typescript
// Before
assigned_staff: assignedStaff || null,

// After  
assigned_staff: assignedStaff === "__unassigned__" ? null : (assignedStaff || null),
```

## Additional Consideration

Also check for any employees that might have a null `user_id` (line 317):
```typescript
<SelectItem key={emp.id} value={emp.user_id || emp.id}>
```

If `emp.user_id` is null, it falls back to `emp.id`, which is fine. But we should ensure this is always a valid non-empty string.

## Summary

| File | Line | Change |
|------|------|--------|
| `src/pages/Routes.tsx` | 315 | Change `value=""` to `value="__unassigned__"` |
| `src/pages/Routes.tsx` | 104 | Handle special value in payload |

## Expected Result

After this fix:
1. "Create Route" dialog opens without crashing
2. Staff dropdown works correctly with "Unassigned" option
3. Routes can be created successfully

