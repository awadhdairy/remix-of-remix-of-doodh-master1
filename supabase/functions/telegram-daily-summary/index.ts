import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Get today's date in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + istOffset);
    const today = istDate.toISOString().split("T")[0];

    console.log(`[DAILY-SUMMARY] Generating for date: ${today}`);

    // Get active telegram configs that want daily summary
    const { data: configs } = await supabase
      .from("telegram_config")
      .select("*")
      .eq("is_active", true)
      .eq("notify_daily_summary", true);

    if (!configs || configs.length === 0) {
      console.log("[DAILY-SUMMARY] No active telegram configs with daily summary enabled");
      return new Response(
        JSON.stringify({ success: true, message: "No configs to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch production data
    const { data: production } = await supabase
      .from("milk_production")
      .select("quantity_liters, session")
      .eq("production_date", today);

    const morningProduction = production?.filter(p => p.session === "morning").reduce((sum, p) => sum + Number(p.quantity_liters), 0) || 0;
    const eveningProduction = production?.filter(p => p.session === "evening").reduce((sum, p) => sum + Number(p.quantity_liters), 0) || 0;
    const totalProduction = morningProduction + eveningProduction;

    // Fetch procurement data
    const { data: procurement } = await supabase
      .from("milk_procurement")
      .select("quantity_liters, total_amount, vendor_id")
      .eq("procurement_date", today);

    const totalProcured = procurement?.reduce((sum, p) => sum + Number(p.quantity_liters), 0) || 0;
    const procurementCost = procurement?.reduce((sum, p) => sum + Number(p.total_amount || 0), 0) || 0;
    const vendorCount = new Set(procurement?.map(p => p.vendor_id).filter(Boolean)).size;

    // Fetch delivery data
    const { data: deliveries } = await supabase
      .from("deliveries")
      .select("status")
      .eq("delivery_date", today);

    const deliveredCount = deliveries?.filter(d => d.status === "delivered").length || 0;
    const pendingCount = deliveries?.filter(d => d.status === "pending").length || 0;
    const missedCount = deliveries?.filter(d => d.status === "missed").length || 0;

    // Fetch payments data
    const { data: payments } = await supabase
      .from("payments")
      .select("amount")
      .eq("payment_date", today);

    const todayRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Fetch pending invoices
    const { data: pendingInvoices } = await supabase
      .from("invoices")
      .select("final_amount, paid_amount")
      .eq("payment_status", "pending");

    const pendingAmount = pendingInvoices?.reduce((sum, inv) => sum + (Number(inv.final_amount) - Number(inv.paid_amount || 0)), 0) || 0;

    // Fetch health alerts
    const { data: healthAlerts } = await supabase
      .from("cattle_health")
      .select("title, cattle_id")
      .eq("record_date", today)
      .eq("record_type", "illness");

    // Fetch low inventory items
    const { data: lowInventory } = await supabase
      .from("feed_inventory")
      .select("name, current_stock, min_stock_level, unit")
      .lt("current_stock", supabase.rpc ? 0 : 999999); // Will filter in code

    const lowStockItems = lowInventory?.filter(item => 
      Number(item.current_stock) < Number(item.min_stock_level || 0)
    ) || [];

    // Build alerts section
    let alertsSection = "";
    const alertCount = (healthAlerts?.length || 0) + lowStockItems.length;

    if (alertCount > 0) {
      alertsSection = "\n";
      if (healthAlerts && healthAlerts.length > 0) {
        healthAlerts.forEach(alert => {
          alertsSection += `🏥 ${alert.title}\n`;
        });
      }
      if (lowStockItems.length > 0) {
        lowStockItems.forEach(item => {
          alertsSection += `📉 Low: ${item.name} (${item.current_stock} ${item.unit})\n`;
        });
      }
    }

    // Format the message
    const formattedDate = new Date(today).toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const message = `📊 <b>AWADH DAIRY - Daily Summary</b>
📅 ${formattedDate}

🥛 <b>Production:</b> ${totalProduction.toFixed(1)}L
   Morning: ${morningProduction.toFixed(1)}L | Evening: ${eveningProduction.toFixed(1)}L

📦 <b>Procurement:</b> ${totalProcured.toFixed(1)}L from ${vendorCount} vendor${vendorCount !== 1 ? 's' : ''}
   Cost: ₹${procurementCost.toLocaleString("en-IN")}

🚚 <b>Deliveries:</b> ${deliveredCount} completed
   Pending: ${pendingCount} | Missed: ${missedCount}

💰 <b>Revenue Today:</b> ₹${todayRevenue.toLocaleString("en-IN")}
   Outstanding: ₹${pendingAmount.toLocaleString("en-IN")}

⚠️ <b>Alerts:</b> ${alertCount}${alertsSection}
━━━━━━━━━━━━━━━━━━━━━
<i>Powered by Awadh Dairy System</i>`;

    // Send to all configured chats
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
          recipient_type: "daily_summary",
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
          error: result.ok ? null : result.description,
        });
      } catch (err) {
        results.push({
          chat_id: config.chat_id,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`[DAILY-SUMMARY] Sent to ${results.filter(r => r.success).length}/${configs.length} chats`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: today,
        sent_count: results.filter(r => r.success).length,
        total_count: configs.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[DAILY-SUMMARY] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
