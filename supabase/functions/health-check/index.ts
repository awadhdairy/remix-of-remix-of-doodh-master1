import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Use EXTERNAL Supabase variables
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Read-only query - just check if we can connect and read public settings
    const { data, error } = await supabase
      .from("dairy_settings_public")
      .select("dairy_name")
      .limit(1)
      .maybeSingle();

    const responseTime = Date.now() - startTime;

    if (error) {
      return new Response(
        JSON.stringify({
          status: "unhealthy",
          database: "disconnected",
          error: error.message,
          response_time_ms: responseTime,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        status: "healthy",
        database: "connected",
        dairy_name: data?.dairy_name || "Unknown",
        response_time_ms: responseTime,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const responseTime = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        status: "error",
        database: "unknown",
        error: errorMessage,
        response_time_ms: responseTime,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
