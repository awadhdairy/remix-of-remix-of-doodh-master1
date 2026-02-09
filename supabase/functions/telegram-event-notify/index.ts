import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";

type EventType = 
  | "health_alert"
  | "low_inventory"
  | "payment_received"
  | "large_transaction"
  | "production_recorded"
  | "procurement_recorded"
  | "delivery_completed";

interface EventData {
  event_type: EventType;
  data: Record<string, any>;
}

function formatEventMessage(event_type: EventType, data: Record<string, any>): string {
  switch (event_type) {
    case "health_alert":
      return `🏥 <b>HEALTH ALERT</b>
Cattle ${data.tag_number || "Unknown"} (${data.name || "No name"})
<b>Issue:</b> ${data.title || "Health concern"}
${data.description ? `<i>${data.description}</i>` : ""}
<b>Action Required:</b> Immediate attention needed`;

    case "low_inventory":
      return `📉 <b>LOW STOCK ALERT</b>
<b>${data.item_name}</b>
Current: ${data.current_stock} ${data.unit}
Minimum: ${data.min_level} ${data.unit}
<i>Please restock soon!</i>`;

    case "payment_received":
      return `💳 <b>PAYMENT RECEIVED</b>
Amount: ₹${Number(data.amount).toLocaleString("en-IN")}
From: ${data.customer_name || "Customer"}
Mode: ${data.payment_mode || "Cash"}
${data.reference ? `Ref: ${data.reference}` : ""}`;

    case "large_transaction":
      return `🔔 <b>LARGE PAYMENT ALERT</b>
Amount: ₹${Number(data.amount).toLocaleString("en-IN")}
From: ${data.customer_name || "Customer"}
Mode: ${data.payment_mode || "Cash"}
${data.reference ? `Ref: ${data.reference}` : ""}
<i>This payment exceeds your notification threshold</i>`;

    case "production_recorded":
      return `🥛 <b>PRODUCTION RECORDED</b>
Session: ${data.session || "Unknown"}
Quantity: ${data.quantity}L
${data.cattle_count ? `From ${data.cattle_count} cattle` : ""}`;

    case "procurement_recorded":
      return `📦 <b>PROCUREMENT RECORDED</b>
Vendor: ${data.vendor_name || "Unknown"}
Quantity: ${data.quantity}L @ ₹${data.rate}/L
Total: ₹${Number(data.total_amount).toLocaleString("en-IN")}`;

    case "delivery_completed":
      return `🚚 <b>DELIVERY UPDATE</b>
Route: ${data.route_name || "Default"}
Completed: ${data.completed_count}/${data.total_count}
${data.pending_count > 0 ? `⚠️ ${data.pending_count} still pending` : "✅ All delivered!"}`;

    default:
      return `📢 <b>NOTIFICATION</b>
${JSON.stringify(data, null, 2)}`;
  }
}

function getNotifyColumn(event_type: EventType): string {
  switch (event_type) {
    case "health_alert":
      return "notify_health_alerts";
    case "low_inventory":
      return "notify_inventory_alerts";
    case "payment_received":
    case "large_transaction":
      return "notify_payments";
    case "production_recorded":
      return "notify_production";
    case "procurement_recorded":
      return "notify_procurement";
    case "delivery_completed":
      return "notify_deliveries";
    default:
      return "is_active";
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Database configuration missing");
    }

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event_type, data }: EventData = await req.json();

    if (!event_type || !data) {
      throw new Error("event_type and data are required");
    }

    console.log(`[EVENT-NOTIFY] Processing event: ${event_type}`);

    // Get notify column for this event type
    const notifyColumn = getNotifyColumn(event_type);

    // Get active telegram configs that want this notification type
    const { data: configs } = await supabase
      .from("telegram_config")
      .select("*")
      .eq("is_active", true)
      .eq(notifyColumn, true);

    if (!configs || configs.length === 0) {
      console.log(`[EVENT-NOTIFY] No configs for event type: ${event_type}`);
      return new Response(
        JSON.stringify({ success: true, message: "No configs to notify", sent_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For large_transaction, check threshold
    if (event_type === "large_transaction") {
      const amount = Number(data.amount);
      // Filter configs by threshold
      const filteredConfigs = configs.filter(c => {
        const threshold = Number(c.large_payment_threshold) || 10000;
        return amount >= threshold;
      });
      
      if (filteredConfigs.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "Amount below threshold", sent_count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Format message
    const message = formatEventMessage(event_type, data);

    // Send to all applicable chats
    const results = [];
    for (const config of configs) {
      try {
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: config.chat_id,
              text: message,
              parse_mode: "HTML",
            }),
          }
        );

        const result = await telegramResponse.json();

        // Log to notification_logs
        await supabase.from("notification_logs").insert({
          channel: "telegram",
          recipient_type: event_type,
          recipient_id: config.id,
          recipient_contact: config.chat_id,
          body: message,
          status: result.ok ? "sent" : "failed",
          sent_at: result.ok ? new Date().toISOString() : null,
          error_message: result.ok ? null : result.description,
        });

        results.push({
          chat_id: config.chat_id,
          success: result.ok,
        });
      } catch (err) {
        results.push({
          chat_id: config.chat_id,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`[EVENT-NOTIFY] Sent ${event_type} to ${results.filter(r => r.success).length}/${configs.length} chats`);

    return new Response(
      JSON.stringify({
        success: true,
        event_type,
        sent_count: results.filter(r => r.success).length,
        total_count: configs.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[EVENT-NOTIFY] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
