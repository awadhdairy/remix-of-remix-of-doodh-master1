

# Fix Role Dropdown in Employee Form and User Management

## Problem Identified

Both dropdowns are broken due to the **same root cause** in the global Select component:

| Location | File | Line | Status |
|----------|------|------|--------|
| Employee Form - Role | `EmployeeFormDialog.tsx` | 185-196 | Only shows 1 item |
| User Management - Role | `UserManagement.tsx` | 436-447 | Dropdown not working |

## Root Cause

In `src/components/ui/select.tsx` at lines 78-83:

```tsx
<SelectPrimitive.Viewport
  className={cn(
    "p-1",
    position === "popper" &&
      "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
  )}
>
```

The `h-[var(--radix-select-trigger-height)]` sets the viewport height to match the trigger button height (~40px). This is incorrect - it should NOT have a fixed height at all, letting the dropdown expand to show all items.

## Solution

### Single Fix - Update Global Select Component

**File: `src/components/ui/select.tsx`**

| Line | Before | After |
|------|--------|-------|
| 82 | `"h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"` | `"w-full min-w-[var(--radix-select-trigger-width)]"` |

Simply remove `h-[var(--radix-select-trigger-height)]` from the viewport className.

### Optional Enhancement - Make Form Scrollable

**File: `src/components/employees/EmployeeFormDialog.tsx`**

| Line | Before | After |
|------|--------|-------|
| 161 | `<div className="space-y-4 py-4">` | `<div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">` |

This ensures the form content is scrollable on smaller screens or when keyboard is open.

---

## Files to Modify

| File | Change | Impact |
|------|--------|--------|
| `src/components/ui/select.tsx` | Remove height constraint from line 82 | Fixes ALL dropdowns globally |
| `src/components/employees/EmployeeFormDialog.tsx` | Add scrollable container on line 161 | Better mobile UX |

---

## Result After Fix

**Employee Form Role Dropdown** will show all 6 options:
- Farm Worker
- Delivery Staff
- Vet Staff
- Accountant
- Manager
- Auditor

**User Management Role Dropdown** will show all 6 options:
- Manager
- Accountant
- Delivery Staff
- Farm Worker
- Vet Staff
- Auditor

---

## Technical Details

The Radix Select component uses CSS custom properties for positioning. The original code incorrectly used the trigger height for the viewport container, causing it to be constrained to ~40px (the trigger button height).

By removing this constraint, the viewport will:
1. Use its natural content height
2. Still respect the `max-h-96` (384px) set on the parent `SelectContent`
3. Show scroll buttons if content exceeds max height

This is a one-line fix that resolves dropdown issues application-wide.

