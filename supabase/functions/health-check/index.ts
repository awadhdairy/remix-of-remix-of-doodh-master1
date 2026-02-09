import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const startTime = Date.now();

  try {
    // Use Supabase's built-in environment variables (auto-provided by Supabase)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================================
    // AUTHENTICATED ADMIN VERIFICATION (POST request)
    // ============================================================
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        
        // Create user client and validate JWT
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } }
        });
        
        // CRITICAL: Pass token explicitly to getUser for proper JWT validation
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
        
        if (user && !userError) {
          console.log(`[HEALTH] Authenticated user: ${user.id} (${user.email})`);
          
          // Get complete user status using admin client (bypasses RLS)
          const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, phone, role, is_active")
            .eq("id", user.id)
            .single();
          
          console.log(`[HEALTH] Profile lookup: ${JSON.stringify(profile)}, error: ${profileError?.message || 'none'}`);
            
          const { data: roleData, error: roleError } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          
          console.log(`[HEALTH] Role lookup: ${JSON.stringify(roleData)}, error: ${roleError?.message || 'none'}`);
          
          const responseTime = Date.now() - startTime;
          
          return new Response(
            JSON.stringify({
              status: "authenticated",
              authenticated: true,
              user: {
                id: user.id,
                email: user.email,
                profile: profile ? { 
                  full_name: profile.full_name,
                  phone: profile.phone,
                  role: profile.role,
                  is_active: profile.is_active 
                } : null,
                user_roles: roleData?.map(r => r.role) || [],
                is_super_admin: roleData?.some(r => r.role === 'super_admin') || false
              },
              response_time_ms: responseTime,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        } else {
          console.log(`[HEALTH] Auth failed: ${userError?.message || 'No user'}`);
          return new Response(
            JSON.stringify({
              status: "unauthenticated",
              authenticated: false,
              error: userError?.message || "Invalid token",
              response_time_ms: Date.now() - startTime,
              timestamp: new Date().toISOString(),
            }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    // ============================================================
    // BASIC HEALTH CHECK (GET request - no auth required)
    // ============================================================
    
    // Read-only query - just check if we can connect and read public settings
    const { data, error } = await supabase
      .from("dairy_settings_public")
      .select("dairy_name")
      .limit(1)
      .maybeSingle();

    const responseTime = Date.now() - startTime;

    if (error) {
      // Try alternative check using admin client
      const { data: settingsData, error: settingsError } = await supabaseAdmin
        .from("dairy_settings")
        .select("dairy_name")
        .limit(1)
        .maybeSingle();
      
      if (settingsError) {
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
          dairy_name: settingsData?.dairy_name || "Unknown",
          response_time_ms: responseTime,
          timestamp: new Date().toISOString(),
          note: "Public view not accessible, using admin client"
        }),
        {
          status: 200,
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
