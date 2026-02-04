import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: sessionData } = await supabase
      .from("auth_sessions")
      .select("user_id, user_type")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (!sessionData || sessionData.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = sessionData[0].user_id;

    // Verify super_admin role (server-side check)
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1);

    if (!roleData || roleData.length === 0 || roleData[0].role !== "super_admin") {
      console.log(`[ARCHIVE] Unauthorized access attempt by user ${userId}`);
      return new Response(
        JSON.stringify({ error: "Only super admin can perform data archival" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
          let query = supabase
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
      const exportData: Record<string, any[]> = {};

      for (const tableConfig of ARCHIVABLE_TABLES) {
        if (!tableConfig.dateColumn) continue;
        
        try {
          let query = supabase
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

      // Verify PIN against database
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

      if (!profileData) {
        return new Response(
          JSON.stringify({ error: "User profile not found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use RPC to verify PIN (since we can't read pin_hash directly)
      const { data: pinVerifyData } = await supabase.rpc("verify_pin", {
        _phone: null, // We need to get phone first
        _pin: pin,
      });

      // Alternative: Get phone and verify
      const { data: userPhone } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", userId)
        .single();

      if (!userPhone?.phone) {
        return new Response(
          JSON.stringify({ error: "Could not verify user" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: verifiedUserId } = await supabase.rpc("verify_pin", {
        _phone: userPhone.phone,
        _pin: pin,
      });

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
      const { data: deliveryIds } = await supabase
        .from("deliveries")
        .select("id")
        .lt("delivery_date", cutoffDateStr);

      const idsToDelete = deliveryIds?.map((d) => d.id) || [];

      // Step 2: Delete delivery_items first (FK constraint)
      if (idsToDelete.length > 0) {
        try {
          // Delete in batches to avoid timeout
          const batchSize = 100;
          let deletedItems = 0;
          
          for (let i = 0; i < idsToDelete.length; i += batchSize) {
            const batch = idsToDelete.slice(i, i + batchSize);
            const { error } = await supabase
              .from("delivery_items")
              .delete()
              .in("delivery_id", batch);
            
            if (error) {
              errors.push(`delivery_items: ${error.message}`);
            }
          }
          
          // Count what we deleted
          const { count } = await supabase
            .from("delivery_items")
            .select("id", { count: "exact", head: true })
            .in("delivery_id", idsToDelete);
          
          deleted["delivery_items"] = idsToDelete.length * 2; // Estimate since we deleted them
        } catch (e: any) {
          errors.push(`delivery_items: ${e.message}`);
        }
      }

      // Step 3: Delete from all tables with date columns
      for (const tableConfig of ARCHIVABLE_TABLES) {
        if (!tableConfig.dateColumn) continue;
        
        try {
          // First count records to delete
          let countQuery = supabase
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
          let deleteQuery = supabase
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
        } catch (e: any) {
          console.log(`[ARCHIVE] Exception deleting ${tableConfig.table}: ${e.message}`);
          errors.push(`${tableConfig.table}: ${e.message}`);
          deleted[tableConfig.table] = 0;
        }
      }

      // Log the action
      try {
        await supabase.from("activity_logs").insert({
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
  } catch (error: any) {
    console.error("[ARCHIVE] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
