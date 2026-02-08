import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramRequest {
  chat_id: string;
  message: string;
  parse_mode?: "HTML" | "Markdown";
  log_to_db?: boolean;
  recipient_type?: string;
  recipient_id?: string;
  template_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN not configured");
    }

    const { 
      chat_id, 
      message, 
      parse_mode = "HTML",
      log_to_db = true,
      recipient_type = "telegram",
      recipient_id,
      template_id
    }: TelegramRequest = await req.json();

    if (!chat_id || !message) {
      throw new Error("chat_id and message are required");
    }

    console.log(`[TELEGRAM] Sending to chat_id: ${chat_id}`);

    // Send message to Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          text: message,
          parse_mode,
        }),
      }
    );

    const telegramResult = await telegramResponse.json();
    console.log(`[TELEGRAM] Response:`, telegramResult);

    // Log to database if requested
    if (log_to_db) {
      const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase.from("notification_logs").insert({
          channel: "telegram",
          recipient_type,
          recipient_id: recipient_id || chat_id,
          recipient_contact: chat_id,
          template_id: template_id || null,
          body: message,
          status: telegramResult.ok ? "sent" : "failed",
          sent_at: telegramResult.ok ? new Date().toISOString() : null,
          error_message: telegramResult.ok ? null : JSON.stringify(telegramResult),
        });
      }
    }

    if (!telegramResult.ok) {
      throw new Error(telegramResult.description || "Telegram API error");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: telegramResult.result?.message_id 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[TELEGRAM] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
