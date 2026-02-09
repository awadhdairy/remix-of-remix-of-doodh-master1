
# Telegram Notification System - Comprehensive Fix Plan

## Summary

The Telegram notification system is **completely non-functional** because the `useTelegramNotify` hook is **never called** from any page in the application. The hook exists and is well-designed, but no pages actually import or use it to trigger notifications when events occur.

---

## Root Cause Analysis

### Issue 1: Hook Never Used in Application (CRITICAL)

**Finding**: Searched the entire `src/pages` directory for any usage of:
- `notifyPaymentReceived`
- `notifyProductionRecorded`
- `notifyDeliveryCompleted`
- `notifyHealthAlert`
- `useTelegramNotify`

**Result**: **0 matches found**

The `useTelegramNotify` hook is defined in `src/hooks/useTelegramNotify.ts` but is never imported or called from any page or component.

| Page | Event That Should Trigger Notification | Current Integration |
|------|----------------------------------------|---------------------|
| `Billing.tsx` | Payment recorded (line 168-216) | None |
| `Production.tsx` | Milk production saved (line 189-208) | None |
| `MilkProcurement.tsx` | Procurement recorded (line 416-427) | None |
| `Deliveries.tsx` | Delivery status changed (line 171-189) | None |
| `Health.tsx` | Health record created (via `useHealthData`) | None |
| `Inventory.tsx` | Low stock threshold reached | None |

### Issue 2: No Telegram Configs in Database

**Finding**: Query `SELECT * FROM telegram_config WHERE is_active = true` returned **empty array** `[]`

Even if the hook was used, there are no active Telegram chat configurations in the database to send notifications to.

### Issue 3: No Edge Function Logs

**Finding**: No logs found for either `telegram-event-notify` or `send-telegram` edge functions.

This confirms no notification attempts are being made from the application.

### Issue 4: External Supabase Database Not Synced

The edge functions check `telegram_config` table but query the **Lovable Cloud database** instead of the external Supabase project (`iupmzocmmjxpeabkmzri`).

---

## Implementation Plan

### Part 1: Integrate Notifications into Billing Page

**File**: `src/pages/Billing.tsx`

After successful payment recording (line 207-216), add notification call:

```typescript
import { useTelegramNotify } from "@/hooks/useTelegramNotify";

// Inside component:
const { notifyPaymentReceived, notifyLargeTransaction } = useTelegramNotify();

// In handleRecordPayment success block (after line 207):
toast({ title: "Payment recorded", ... });

// Add notification
notifyPaymentReceived({
  amount: amount,
  customer_name: selectedInvoice.customer?.name || "Customer",
  payment_mode: "cash",
  reference: selectedInvoice.invoice_number,
});

// Also check for large transaction
if (amount >= 10000) {
  notifyLargeTransaction({
    amount: amount,
    customer_name: selectedInvoice.customer?.name || "Customer",
    payment_mode: "cash",
    reference: selectedInvoice.invoice_number,
  });
}
```

### Part 2: Integrate Notifications into Production Page

**File**: `src/pages/Production.tsx`

After successful production save (line 201-208), add notification:

```typescript
import { useTelegramNotify } from "@/hooks/useTelegramNotify";

// Inside component:
const { notifyProductionRecorded } = useTelegramNotify();

// In handleSave success block (after line 201):
toast({ title: "Production saved", ... });

// Add notification
const totalQuantity = records.reduce((sum, r) => sum + r.quantity_liters, 0);
notifyProductionRecorded({
  session: session,
  quantity: totalQuantity,
  cattle_count: records.length,
});
```

### Part 3: Integrate Notifications into Procurement Page

**File**: `src/pages/MilkProcurement.tsx`

After successful procurement save (line 421-427), add notification:

```typescript
import { useTelegramNotify } from "@/hooks/useTelegramNotify";

// Inside component:
const { notifyProcurementRecorded } = useTelegramNotify();

// In handleSaveProcurement success block (line 421):
notifyProcurementRecorded({
  vendor_name: vendor?.name || "Unknown",
  quantity: quantity,
  rate: rate || 0,
  total_amount: totalAmount || 0,
});
```

### Part 4: Integrate Notifications into Deliveries Page

**File**: `src/pages/Deliveries.tsx`

After delivery status updates, add notification:

```typescript
import { useTelegramNotify } from "@/hooks/useTelegramNotify";

// Inside component:
const { notifyDeliveryCompleted } = useTelegramNotify();

// After bulk delivery updates or status changes:
notifyDeliveryCompleted({
  route_name: "Default Route",
  completed_count: stats.delivered,
  total_count: stats.total,
  pending_count: stats.pending,
});
```

### Part 5: Integrate Health Alert Notifications

**File**: `src/hooks/useHealthData.ts`

In the `createMutation.onSuccess` handler, add health alert notification:

```typescript
import { useTelegramNotify } from "@/hooks/useTelegramNotify";

// Note: Since hooks can't call other hooks inside mutation callbacks,
// we need to pass the notify function as a parameter or restructure
```

Alternative approach - add notification call in `Health.tsx`:

```typescript
import { useTelegramNotify } from "@/hooks/useTelegramNotify";

const { notifyHealthAlert } = useTelegramNotify();

const handleSave = () => {
  if (!formData.cattle_id || !formData.title) return;
  
  const selectedCattle = cattle.find(c => c.id === formData.cattle_id);
  
  createRecord({ formData, cattleList: cattle }, {
    onSuccess: () => {
      setDialogOpen(false);
      setFormData(emptyFormData);
      
      // Send health alert notification
      if (formData.record_type === "disease" || formData.record_type === "treatment") {
        notifyHealthAlert({
          tag_number: selectedCattle?.tag_number || "Unknown",
          name: selectedCattle?.name || undefined,
          title: formData.title,
          description: formData.description || undefined,
        });
      }
    },
  });
};
```

### Part 6: Integrate Low Inventory Alerts

**File**: `src/hooks/useInventoryData.ts`

After stock update, check if below minimum level:

```typescript
// In updateStockMutation.onSuccess:
if (type === "consume") {
  const newStock = item.current_stock - quantity;
  if (newStock <= item.min_stock_level) {
    // Need to call notification here
    // Since this is a hook, we need to restructure
  }
}
```

Better approach - check in `Inventory.tsx` page after stock update.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Billing.tsx` | Import hook, add `notifyPaymentReceived` call after payment |
| `src/pages/Production.tsx` | Import hook, add `notifyProductionRecorded` call after save |
| `src/pages/MilkProcurement.tsx` | Import hook, add `notifyProcurementRecorded` call after save |
| `src/pages/Deliveries.tsx` | Import hook, add `notifyDeliveryCompleted` on bulk updates |
| `src/pages/Health.tsx` | Import hook, add `notifyHealthAlert` for disease/treatment records |
| `src/pages/Inventory.tsx` | Import hook, add `notifyLowInventory` when stock below minimum |

---

## Additional Required Setup

### User Action: Configure Telegram Chat

Before notifications will work, you must:

1. Go to **Settings > Telegram** tab
2. Add a new Chat ID (get from @userinfobot on Telegram)
3. Toggle "Active" ON
4. Enable desired notification types (Payments, Production, etc.)
5. Click "Test" to verify connection

### Verify Edge Function Deployment

Ensure the `telegram-event-notify` and `send-telegram` functions are deployed to your **external Supabase project** with the correct `TELEGRAM_BOT_TOKEN` secret:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN="8463987198:AAEu_uzBzDpQKfT_BMEBCAXtE1POCrJjveQ" --project-ref iupmzocmmjxpeabkmzri
supabase functions deploy telegram-event-notify send-telegram --project-ref iupmzocmmjxpeabkmzri
```

---

## Testing Checklist

After implementation:

1. Add a Telegram config in Settings (Chat ID from @userinfobot)
2. Enable "Payment Received" notification
3. Record a payment in Billing page
4. Verify Telegram message received
5. Check `notification_logs` table for delivery status

---

## Technical Summary

| Issue | Status | Impact |
|-------|--------|--------|
| Hook never imported/used | Root cause | No notifications sent |
| No telegram_config rows | Configuration | No recipients defined |
| No edge function logs | Symptom | Confirms no API calls made |
| Edge functions point to external DB | OK | Correctly configured |
| CORS whitelist includes production | Fixed | API calls will work |
