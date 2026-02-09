import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";

// Tables that can be archived with their date columns
const ARCHIVABLE_TABLES = [
  { table: "delivery_items", dateColumn: null, fkColumn: "delivery_id", parentTable: "deliveries" },
  { table: "deliveries", dateColumn: "delivery_date", category: "safe" },
  { table: "activity_logs", dateColumn: "created_at", category: "audit" },
  { table: "attendance", dateColumn: "attendance_date", category: "safe" },
  { table: "bottle_transactions", dateColumn: "transaction_date", category: "safe" },
  { table: "breeding_records", dateColumn: "record_date", category: "safe" },
  { table: "cattle_health", dateColumn: "record_date", category: "safe" },
  { table: "feed_consumption", dateColumn: "consumption_date", category: "safe" },
  { table: "maintenance_records", dateColumn: "maintenance_date", category: "safe" },
  { table: "milk_procurement", dateColumn: "procurement_date", category: "safe" },
  { table: "milk_production", dateColumn: "production_date", category: "safe" },
  { table: "notification_logs", dateColumn: "created_at", category: "audit" },
  { table: "invoices", dateColumn: "created_at", category: "financial", condition: "payment_status = 'paid'" },
  { table: "expenses", dateColumn: "expense_date", category: "financial" },
  { table: "payments", dateColumn: "payment_date", category: "financial" },
  { table: "payroll_records", dateColumn: "pay_period_start", category: "financial" },
  { table: "vendor_payments", dateColumn: "payment_date", category: "financial" },
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // ============================================================
    // Use Supabase's built-in environment variables
    // These are automatically provided when deployed to any Supabase project
    // ============================================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error("[ARCHIVE] Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for database operations (bypasses RLS) - connects to EXTERNAL Supabase
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[ARCHIVE] No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user client and validate JWT
    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    // CRITICAL: Pass token explicitly to getUser for proper JWT validation
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.log(`[ARCHIVE] Auth failed: ${userError?.message || 'No user returned'}`);
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`[ARCHIVE] User authenticated: ${userId} (${user.email})`);

    // Verify super_admin role with detailed logging (using admin client to bypass RLS)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1);

    console.log(`[ARCHIVE] Role check for ${userId}:`);
    console.log(`[ARCHIVE]   - Query: user_roles WHERE user_id='${userId}' AND role='super_admin'`);
    console.log(`[ARCHIVE]   - Rows found: ${roleData?.length || 0}`);
    console.log(`[ARCHIVE]   - Role data: ${JSON.stringify(roleData)}`);
    console.log(`[ARCHIVE]   - Error: ${roleError?.message || 'none'}`);

    // Also check profile for debugging
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, phone, role, is_active, full_name")
      .eq("id", userId)
      .single();

    console.log(`[ARCHIVE] Profile check for ${userId}:`);
    console.log(`[ARCHIVE]   - Profile data: ${JSON.stringify(profileData)}`);
    console.log(`[ARCHIVE]   - Profile error: ${profileError?.message || 'none'}`);

    if (!roleData || roleData.length === 0) {
      console.log(`[ARCHIVE] DENIED - User ${userId} is not super_admin`);
      console.log(`[ARCHIVE] Debug info: email=${user.email}, roleRows=${roleData?.length || 0}, hasProfile=${!!profileData}`);
      
      return new Response(
        JSON.stringify({ 
          error: "Only super admin can perform data archival",
          debug: {
            userId,
            email: user.email,
            roleDataLength: roleData?.length || 0,
            roleError: roleError?.message || null,
            profileExists: !!profileData,
            profileRole: profileData?.role || null,
            profileActive: profileData?.is_active || null
          }
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ARCHIVE] GRANTED - User ${userId} verified as super_admin`);

    // ============================================================
    // END OF AUTH PATTERN - PROCEEDING WITH BUSINESS LOGIC
    // ============================================================

    // Parse request body
    const body = await req.json();
    const { mode, retention_years, pin } = body;

    if (!mode || !["preview", "export", "execute"].includes(mode)) {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Use 'preview', 'export', or 'execute'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (retention_years === undefined || ![0, 1, 2, 3, 5].includes(retention_years)) {
      return new Response(
        JSON.stringify({ error: "Invalid retention_years. Use 0, 1, 2, 3, or 5" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate cutoff date
    const isFactoryReset = retention_years === 0;
    let cutoffDateStr: string;

    if (isFactoryReset) {
      // Set to tomorrow to include today's records (delete everything)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      cutoffDateStr = tomorrow.toISOString().split("T")[0];
      console.log(`[ARCHIVE] FACTORY RESET - Deleting ALL records (cutoff: ${cutoffDateStr})`);
    } else {
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - retention_years);
      cutoffDateStr = cutoffDate.toISOString().split("T")[0];
      console.log(`[ARCHIVE] Mode: ${mode}, Retention: ${retention_years} years, Cutoff: ${cutoffDateStr}`);
    }

    // PREVIEW MODE - Count records
    if (mode === "preview") {
      const counts: Record<string, number> = {};

      for (const tableConfig of ARCHIVABLE_TABLES) {
        if (!tableConfig.dateColumn) continue; // Skip FK-only tables
        
        try {
          let query = supabaseAdmin
            .from(tableConfig.table)
            .select("id", { count: "exact", head: true })
            .lt(tableConfig.dateColumn, cutoffDateStr);

          // Add extra condition for invoices (only paid)
          if (tableConfig.table === "invoices") {
            query = query.eq("payment_status", "paid");
          }

          const { count, error } = await query;
          
          if (error) {
            console.log(`[ARCHIVE] Error counting ${tableConfig.table}: ${error.message}`);
            counts[tableConfig.table] = 0;
          } else {
            counts[tableConfig.table] = count || 0;
          }
        } catch (e) {
          console.log(`[ARCHIVE] Exception counting ${tableConfig.table}: ${e}`);
          counts[tableConfig.table] = 0;
        }
      }

      return new Response(
        JSON.stringify({ success: true, counts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EXPORT MODE - Fetch data for backup
    if (mode === "export") {
      const exportData: Record<string, unknown[]> = {};

      for (const tableConfig of ARCHIVABLE_TABLES) {
        if (!tableConfig.dateColumn) continue;
        
        try {
          let query = supabaseAdmin
            .from(tableConfig.table)
            .select("*")
            .lt(tableConfig.dateColumn, cutoffDateStr)
            .limit(10000); // Safety limit

          if (tableConfig.table === "invoices") {
            query = query.eq("payment_status", "paid");
          }

          const { data, error } = await query;
          
          if (!error && data && data.length > 0) {
            exportData[tableConfig.table] = data;
          }
        } catch (e) {
          console.log(`[ARCHIVE] Exception exporting ${tableConfig.table}: ${e}`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, export: exportData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EXECUTE MODE - Delete records
    if (mode === "execute") {
      // Verify PIN
      if (!pin || !/^\d{6}$/.test(pin)) {
        return new Response(
          JSON.stringify({ error: "Valid 6-digit PIN required for deletion" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user's phone for PIN verification
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("id", userId)
        .single();

      if (!userProfile?.phone) {
        return new Response(
          JSON.stringify({ error: "User profile not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[ARCHIVE] Verifying PIN for phone: ${userProfile.phone.slice(0, 4)}****`);
      
      const { data: verifiedUserId, error: verifyError } = await supabaseAdmin.rpc("verify_pin", {
        _phone: userProfile.phone,
        _pin: pin,
      });

      console.log(`[ARCHIVE] verify_pin result: userId=${verifiedUserId}, error=${verifyError?.message || 'none'}`);

      if (verifyError) {
        console.error(`[ARCHIVE] PIN verification error: ${verifyError.message}`);
        if (verifyError.message.includes('locked')) {
          return new Response(
            JSON.stringify({ error: "Account temporarily locked. Try again in 15 minutes." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: `PIN verification failed: ${verifyError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!verifiedUserId || verifiedUserId !== userId) {
        return new Response(
          JSON.stringify({ error: "Incorrect PIN" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[ARCHIVE] PIN verified for user ${userId}, proceeding with deletion`);

      const deleted: Record<string, number> = {};
      const errors: string[] = [];
      let totalDeleted = 0;

      // Step 1: Get delivery IDs to delete (for FK cascade)
      const { data: deliveryIds } = await supabaseAdmin
        .from("deliveries")
        .select("id")
        .lt("delivery_date", cutoffDateStr);

      const idsToDelete = deliveryIds?.map((d) => d.id) || [];

      // Step 2: Delete delivery_items first (FK constraint)
      if (idsToDelete.length > 0) {
        try {
          // Delete in batches to avoid timeout
          const batchSize = 100;
          
          for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            const { error } = await supabaseAdmin
              .from("delivery_items")
              .delete()
              .in("delivery_id", batch);
            
            if (error) {
              errors.push(`delivery_items: ${error.message}`);
            }
          }
          
          deleted["delivery_items"] = idsToDelete.length * 2; // Estimate since we deleted them
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          errors.push(`delivery_items: ${errorMessage}`);
        }
      }

      // Step 3: Delete from all tables with date columns
      for (const tableConfig of ARCHIVABLE_TABLES) {
        if (!tableConfig.dateColumn) continue;
        
        try {
          // First count records to delete
          let countQuery = supabaseAdmin
            .from(tableConfig.table)
            .select("id", { count: "exact", head: true })
            .lt(tableConfig.dateColumn, cutoffDateStr);

          if (tableConfig.table === "invoices") {
            countQuery = countQuery.eq("payment_status", "paid");
          }

          const { count: beforeCount, error: countError } = await countQuery;
          
          if (countError) {
            errors.push(`${tableConfig.table}: ${countError.message}`);
            deleted[tableConfig.table] = 0;
            continue;
          }

          // Then delete
          let deleteQuery = supabaseAdmin
            .from(tableConfig.table)
            .delete()
            .lt(tableConfig.dateColumn, cutoffDateStr);

          if (tableConfig.table === "invoices") {
            deleteQuery = deleteQuery.eq("payment_status", "paid");
          }

          const { error: deleteError } = await deleteQuery;

          if (deleteError) {
            errors.push(`${tableConfig.table}: ${deleteError.message}`);
            deleted[tableConfig.table] = 0;
          } else {
            deleted[tableConfig.table] = beforeCount || 0;
            totalDeleted += beforeCount || 0;
          }
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.log(`[ARCHIVE] Exception deleting ${tableConfig.table}: ${errorMessage}`);
          errors.push(`${tableConfig.table}: ${errorMessage}`);
          deleted[tableConfig.table] = 0;
        }
      }

      // Log the action
      try {
        await supabaseAdmin.from("activity_logs").insert({
          user_id: userId,
          action: isFactoryReset ? "factory_reset" : "data_archived",
          entity_type: "system",
          entity_id: isFactoryReset ? "factory_reset" : "archive",
          details: {
            retention_years,
            is_factory_reset: isFactoryReset,
            cutoff_date: cutoffDateStr,
            deleted,
            total_deleted: totalDeleted,
            errors: errors.length > 0 ? errors : undefined,
          },
        });
      } catch (logError) {
        console.log(`[ARCHIVE] Failed to log action: ${logError}`);
      }

      console.log(`[ARCHIVE] Complete. Total deleted: ${totalDeleted}`);

      return new Response(
        JSON.stringify({
          success: true,
          deleted,
          errors,
          totalDeleted,
          cutoffDate: cutoffDateStr,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[ARCHIVE] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
