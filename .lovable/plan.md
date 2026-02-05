
# Fix Dropdown Menus Not Working in Dialogs

## Problem Summary

The Role dropdowns in both Employee Management and User Management dialogs are not opening/working properly because:

1. **Radix Dialog's modal behavior blocks pointer events** on portaled Select elements
2. **z-index conflict** - SelectContent uses `z-50` but Dialog content wrapper uses `z-[60]`, causing the dropdown to render behind the dialog
3. **`overflow-hidden` on ResponsiveDialogContent** can clip portaled content

## Root Cause Details

When a Radix Dialog is open in modal mode (default), it creates a "dismissable layer" that:
- Traps focus within the dialog
- Blocks pointer events on elements outside the dialog content
- **Includes portaled elements like Select dropdowns**

Even though Select uses `SelectPrimitive.Portal` to render at the body level, the Dialog's event handlers treat it as "outside" the dialog and block interaction.

## Solution

### Fix 1: Increase SelectContent z-index (Primary Fix)

**File: `src/components/ui/select.tsx`**

Change the z-index on SelectContent from `z-50` to `z-[200]` to ensure it renders above all Dialog layers:

| Line | Change |
|------|--------|
| 68-69 | Change `relative z-50` to `relative z-[200]` |

### Fix 2: Add event handlers to DialogContent

**File: `src/components/ui/dialog.tsx`**

Add `onPointerDownOutside` handler to prevent Dialog from interfering with portaled elements:

| Line | Change |
|------|--------|
| 37-43 | Add `onPointerDownOutside` and `onInteractOutside` handlers to check if the event target is inside a Radix portal |

```typescript
<DialogPrimitive.Content
  ref={ref}
  onPointerDownOutside={(e) => {
    const target = e.target as HTMLElement;
    // Don't close if clicking on portaled select/popover content
    if (target?.closest('[data-radix-popper-content-wrapper]')) {
      e.preventDefault();
    }
  }}
  onInteractOutside={(e) => {
    const target = e.target as HTMLElement;
    if (target?.closest('[data-radix-popper-content-wrapper]')) {
      e.preventDefault();
    }
  }}
  className={cn(...)}
  {...props}
>
```

### Fix 3: Remove overflow-hidden from ResponsiveDialogContent

**File: `src/components/ui/responsive-dialog.tsx`**

| Line | Change |
|------|--------|
| 65 | Remove `overflow-hidden` from className, keep `max-h-[90vh] flex flex-col` |

The `overflow-hidden` was preventing proper rendering of portaled content in some browsers.

---

## Files to Modify

| File | Change | Purpose |
|------|--------|---------|
| `src/components/ui/select.tsx` | Increase z-index to `z-[200]` | Ensure dropdown renders above Dialog |
| `src/components/ui/dialog.tsx` | Add `onPointerDownOutside` and `onInteractOutside` handlers | Prevent Dialog from blocking portaled element clicks |
| `src/components/ui/responsive-dialog.tsx` | Remove `overflow-hidden` | Prevent clipping of portaled content |

---

## Technical Details

### Why z-index alone doesn't fix it

Even with higher z-index, the Dialog's `DismissableLayer` captures pointer events. The `onPointerDownOutside` handler is needed to tell the Dialog "don't treat this click as an outside click."

### The Radix data attributes

Radix UI adds `data-radix-popper-content-wrapper` to portaled popper content (Select, Popover, etc.). We check for this attribute to determine if a click is on a Radix portaled element.

---

## Expected Result

After these fixes:
- **Employee Form Role dropdown** will show all 6 options and allow selection
- **User Management Role dropdown** will show all 6 options and allow selection
- All other Select components inside Dialogs throughout the app will work correctly
