

# Comprehensive Telegram Notification System Implementation

## Overview

Implement a complete, automated Telegram notification system for Awadh Dairy that provides real-time alerts for production, procurement, deliveries, health alerts, inventory warnings, and daily summaries.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Awadh Dairy Telegram Notification System              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   Frontend   │────▶│  Edge Functions  │────▶│  Telegram Bot    │    │
│  │   Settings   │     │                  │     │  @BotFather      │    │
│  └──────────────┘     └──────────────────┘     └──────────────────┘    │
│         │                      │                        │               │
│         │                      │                        │               │
│         ▼                      ▼                        ▼               │
│  ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │  telegram_   │     │  Daily Summary   │     │  User's Phone    │    │
│  │  config      │     │  GitHub Action   │     │  /Group Chat     │    │
│  │  (Database)  │     │  (8 PM IST)      │     │                  │    │
│  └──────────────┘     └──────────────────┘     └──────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Components

### 1. Database Schema

**New Table: `telegram_config`**

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| chat_id | TEXT | Telegram chat ID (user or group) |
| chat_name | TEXT | Display name for reference |
| is_active | BOOLEAN | Enable/disable notifications |
| notify_production | BOOLEAN | Daily production summary |
| notify_procurement | BOOLEAN | Procurement alerts |
| notify_deliveries | BOOLEAN | Delivery status summary |
| notify_health_alerts | BOOLEAN | Cattle health alerts |
| notify_inventory_alerts | BOOLEAN | Low stock warnings |
| notify_payments | BOOLEAN | Payment received alerts |
| notify_daily_summary | BOOLEAN | 8 PM daily digest |
| created_at | TIMESTAMPTZ | Timestamp |

**RLS Policy**: Only super_admin can manage telegram config.

---

### 2. Supabase Secret

**Secret Name**: `TELEGRAM_BOT_TOKEN`
**Value**: `8463987198:AAEu_uzBzDpQKfT_BMEBCAXtE1POCrJjveQ`

This will be stored securely and accessed only by edge functions.

---

### 3. Edge Functions

#### A. `send-telegram/index.ts`
Core function to send messages to Telegram:
- Accepts `chat_id`, `message`, optional `parse_mode` (HTML/Markdown)
- Calls Telegram Bot API `sendMessage` endpoint
- Logs to `notification_logs` table with status
- Returns success/failure response

#### B. `telegram-daily-summary/index.ts`
Scheduled function for 8 PM IST daily digest:
- Fetches today's production (morning + evening totals)
- Fetches procurement received from vendors
- Fetches delivery stats (completed/pending/missed)
- Fetches revenue collected today
- Fetches active health alerts
- Fetches low inventory items
- Compiles into formatted message
- Sends to all active telegram configs with `notify_daily_summary = true`

#### C. `telegram-event-notify/index.ts`
Real-time event notification function:
- Accepts `event_type` and `event_data`
- Checks `telegram_config` for which chats want this event type
- Formats message based on event type
- Sends to all matching chat IDs

Event types:
- `health_alert`: When cattle marked sick
- `low_inventory`: When stock drops below threshold
- `payment_received`: When payment recorded (> threshold)
- `large_transaction`: For payments above configurable amount

---

### 4. GitHub Action for Daily Summary

**File**: `.github/workflows/telegram-daily-summary.yml`

- Schedule: `30 14 * * *` (2:30 PM UTC = 8:00 PM IST)
- Action: Calls `telegram-daily-summary` edge function
- Includes manual trigger option

---

### 5. Frontend Components

#### A. `TelegramSettings.tsx`
New component for Telegram configuration:
- Bot status indicator (connected/disconnected)
- Chat ID input with validation
- "Get My Chat ID" instructions
- Test connection button
- Toggle switches for each notification type:
  - Daily Production Summary
  - Procurement Alerts
  - Delivery Status
  - Health Alerts
  - Low Inventory Warnings
  - Payment Notifications
  - Daily Digest (8 PM)
- Send test message button

#### B. Update `Settings.tsx`
- Import and render `TelegramSettings` in Notifications tab
- Replace "Coming Soon" placeholder

#### C. Update `Notifications.tsx`
- Add "Telegram" as a channel option in templates
- Update channel dropdown to include Telegram
- Add Telegram badge color styling

---

### 6. Integration Points (Hooks)

#### A. Production Module
After saving milk production:
- Check if `notify_production` is enabled for any config
- Optionally send immediate alert for significant deviations

#### B. Procurement Module
After recording procurement:
- Send notification: "Received 200L from Sharma Farm @ Rs45/L"

#### C. Health Module
After marking cattle sick:
- Immediate alert: "Cattle #127 (Laxmi) marked as sick - needs attention"

#### D. Inventory Module
When stock check detects low levels:
- Alert: "Low Stock: Cattle Feed (50 kg remaining, min: 100 kg)"

#### E. Payment Module
After recording payment:
- Notification: "Payment Rs5,000 received from Customer XYZ"

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/send-telegram/index.ts` | Core Telegram API caller |
| `supabase/functions/telegram-daily-summary/index.ts` | Daily digest compiler |
| `supabase/functions/telegram-event-notify/index.ts` | Real-time event handler |
| `src/components/settings/TelegramSettings.tsx` | Configuration UI component |
| `.github/workflows/telegram-daily-summary.yml` | Scheduled daily trigger |

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/config.toml` | Add function configs with `verify_jwt = false` |
| `src/pages/Settings.tsx` | Replace notifications placeholder |
| `src/pages/Notifications.tsx` | Add Telegram channel option |

---

## Database Migration

```sql
-- Create telegram_config table
CREATE TABLE telegram_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  chat_name TEXT,
  is_active BOOLEAN DEFAULT true,
  notify_production BOOLEAN DEFAULT true,
  notify_procurement BOOLEAN DEFAULT true,
  notify_deliveries BOOLEAN DEFAULT true,
  notify_health_alerts BOOLEAN DEFAULT true,
  notify_inventory_alerts BOOLEAN DEFAULT true,
  notify_payments BOOLEAN DEFAULT true,
  notify_daily_summary BOOLEAN DEFAULT true,
  large_payment_threshold NUMERIC DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE telegram_config ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage
CREATE POLICY "Super admins can manage telegram config" 
  ON telegram_config
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Update trigger
CREATE TRIGGER update_telegram_config_updated_at
  BEFORE UPDATE ON telegram_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Notification Message Templates

### Daily Summary (8 PM)
```
📊 AWADH DAIRY - Daily Summary
📅 {date}

🥛 Production: {total}L
   Morning: {morning}L | Evening: {evening}L

📦 Procurement: {procured}L from {vendors} vendors
   Cost: Rs{cost}

🚚 Deliveries: {completed} completed
   Pending: {pending} | Missed: {missed}

💰 Revenue Today: Rs{revenue}
   Pending: Rs{pending}

⚠️ Alerts: {alerts_count}
{alerts_list}

━━━━━━━━━━━━━━━━━━━━━
Powered by Awadh Dairy System
```

### Real-time Alerts
```
🏥 HEALTH ALERT
Cattle {tag} ({name}) marked as sick
Needs immediate attention!

📉 LOW STOCK ALERT  
{item}: {current} {unit} remaining
Minimum required: {min} {unit}

💳 PAYMENT RECEIVED
Rs{amount} from {customer}
Mode: {mode} | Ref: {reference}
```

---

## Setup Instructions for User

### How to Get Your Chat ID

1. **For Personal Notifications**:
   - Search for `@userinfobot` on Telegram
   - Start chat and it will show your Chat ID

2. **For Group Notifications**:
   - Add the bot (`@awadh_dairy_bot`) to your group
   - Make it admin
   - Use `@RawDataBot` to find group chat ID

3. **Enter Chat ID** in Settings → Notifications → Telegram

---

## Verification Checklist

After implementation, verify:

- [ ] Secret `TELEGRAM_BOT_TOKEN` is stored
- [ ] `telegram_config` table exists with RLS
- [ ] `send-telegram` function deploys successfully
- [ ] Test message sends correctly
- [ ] Daily summary function works
- [ ] GitHub Action is scheduled
- [ ] All notification toggles work
- [ ] Logs appear in notification_logs table
- [ ] Error handling works (invalid chat ID, etc.)

---

## Security Considerations

1. **Bot Token**: Stored as Supabase secret, never exposed to frontend
2. **RLS**: Only super_admin can manage telegram config
3. **Rate Limiting**: Telegram has limits (30 msg/sec to different chats)
4. **Validation**: Chat ID format validated before saving
5. **Logging**: All sent messages logged for audit

---

## Cost

**FREE** - Telegram Bot API has no message limits for bots.

---

## Technical Details

### Edge Function Pattern
All edge functions will:
- Use `verify_jwt = false` (authentication handled in code)
- Include CORS headers for browser calls
- Use `SUPABASE_SERVICE_ROLE_KEY` for database access
- Log all operations to console and database
- Handle errors gracefully with proper responses

### Error Handling
- Invalid chat ID → Log error, don't crash
- Telegram API down → Retry with exponential backoff
- Database error → Return 500 with details in logs

