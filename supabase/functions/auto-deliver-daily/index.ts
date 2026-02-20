import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPrelight } from "../_shared/cors.ts";

interface AutoDeliverResult {
  date: string;
  scheduled: number;
  delivered: number;
  skipped: number;
  errors: string[];
}

/**
 * Auto-Deliver Daily Edge Function
 * 
 * Supports 3 modes:
 * - "full" (default): Schedule new deliveries + mark pending as delivered
 * - "schedule_only": Only create pending deliveries, don't auto-mark delivered
 * - "auto_deliver_pending": Only mark existing pending deliveries as delivered
 * 
 * Runs daily at 10:00 AM IST (4:30 AM UTC) via GitHub Actions cron.
 * Can also be triggered manually from the dashboard.
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Parse mode from request body
  let mode = "full";
  try {
    const body = await req.json();
    mode = body?.mode || "full";
  } catch {
    // No body or invalid JSON — default to "full"
  }

  // Get target date (today in IST timezone)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const targetDate = istDate.toISOString().split("T")[0];

  console.log(`[AUTO-DELIVER] Starting mode="${mode}" for date: ${targetDate}`);

  const result: AutoDeliverResult = {
    date: targetDate,
    scheduled: 0,
    delivered: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Step 1: Fetch active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("customer_products")
      .select(`
        customer_id,
        product_id,
        quantity,
        custom_price,
        is_active,
        products (id, base_price, name)
      `)
      .eq("is_active", true);

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    const customerIds = [...new Set(subscriptions?.map((s: any) => s.customer_id) || [])];
    console.log(`[AUTO-DELIVER] Found ${customerIds.length} customers with subscriptions`);

    if (customerIds.length === 0) {
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Fetch customer details
    const { data: customers, error: custError } = await supabase
      .from("customers")
      .select("id, name, subscription_type, notes, is_active")
      .in("id", customerIds)
      .eq("is_active", true);

    if (custError) {
      throw new Error(`Failed to fetch customers: ${custError.message}`);
    }

    const customerMap = new Map(customers?.map((c: any) => [c.id, c]) || []);

    // Step 3: Check vacations
    const { data: vacations } = await supabase
      .from("customer_vacations")
      .select("customer_id")
      .eq("is_active", true)
      .lte("start_date", targetDate)
      .gte("end_date", targetDate);

    const vacationCustomerIds = new Set(vacations?.map((v: any) => v.customer_id) || []);
    console.log(`[AUTO-DELIVER] ${vacationCustomerIds.size} customers on vacation`);

    // Step 4: Check existing deliveries
    const { data: existingDeliveries } = await supabase
      .from("deliveries")
      .select("id, customer_id, status")
      .eq("delivery_date", targetDate);

    const existingDeliveryMap = new Map<string, { id: string; status: string }>();
    existingDeliveries?.forEach((d: any) => {
      existingDeliveryMap.set(d.customer_id, { id: d.id, status: d.status });
    });

    // Step 5: Process each customer
    for (const customerId of customerIds) {
      const customer = customerMap.get(customerId);
      if (!customer) {
        result.skipped++;
        continue;
      }

      // Skip if on vacation
      if (vacationCustomerIds.has(customerId)) {
        console.log(`[AUTO-DELIVER] Skipping ${customer.name}: on vacation`);
        result.skipped++;
        continue;
      }

      // Check delivery frequency
      if (!shouldDeliverToday(customer, targetDate)) {
        result.skipped++;
        continue;
      }

      const existingDelivery = existingDeliveryMap.get(customerId);
      const customerSubs = subscriptions?.filter((s: any) => s.customer_id === customerId) || [];

      if (mode === "auto_deliver_pending") {
        // ONLY mark existing pending deliveries as delivered
        if (existingDelivery && existingDelivery.status === "pending") {
          await markAsDelivered(supabase, existingDelivery.id, customerId, customerSubs);
          result.delivered++;
          console.log(`[AUTO-DELIVER] Marked pending delivery as delivered for ${customer.name}`);
        } else {
          result.skipped++;
        }
        continue;
      }

      if (existingDelivery) {
        if (mode === "schedule_only") {
          // Already has a delivery, skip
          result.skipped++;
          continue;
        }
        // mode === "full": mark pending as delivered
        if (existingDelivery.status === "pending") {
          await markAsDelivered(supabase, existingDelivery.id, customerId, customerSubs);
          result.delivered++;
          console.log(`[AUTO-DELIVER] Marked delivery as delivered for ${customer.name}`);
        } else {
          result.skipped++;
        }
      } else {
        // No delivery exists — create one
        try {
          const deliveryStatus = mode === "schedule_only" ? "pending" : "delivered";
          const { data: newDelivery, error: createError } = await supabase
            .from("deliveries")
            .insert({
              customer_id: customerId,
              delivery_date: targetDate,
              status: deliveryStatus,
              delivery_time: deliveryStatus === "delivered" ? new Date().toISOString() : null,
              notes: deliveryStatus === "delivered" ? "[AUTO] Scheduled delivery" : "[AUTO] Scheduled (pending)",
            })
            .select("id")
            .single();

          if (createError) {
            result.errors.push(`Failed to create delivery for ${customer.name}: ${createError.message}`);
            continue;
          }

          // Create delivery items
          if (customerSubs.length > 0) {
            const items = customerSubs.map((sub: any) => {
              const product = sub.products as any;
              const unitPrice = sub.custom_price ?? product?.base_price ?? 0;
              return {
                delivery_id: newDelivery.id,
                product_id: sub.product_id,
                quantity: sub.quantity,
                unit_price: unitPrice,
                total_amount: unitPrice * sub.quantity,
              };
            });

            await supabase.from("delivery_items").insert(items);
          }

          result.scheduled++;
          if (deliveryStatus === "delivered") {
            result.delivered++;
          }
          console.log(`[AUTO-DELIVER] Created (${deliveryStatus}) for ${customer.name}`);
        } catch (err: any) {
          result.errors.push(`Error creating delivery for ${customer.name}: ${err.message}`);
        }
      }
    }

    console.log(`[AUTO-DELIVER] Complete: scheduled=${result.scheduled}, delivered=${result.delivered}, skipped=${result.skipped}`);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[AUTO-DELIVER] Error: ${error.message}`);
    result.errors.push(error.message);
    return new Response(JSON.stringify({ success: false, result }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Check if customer should receive delivery today based on frequency
 */
function shouldDeliverToday(customer: any, targetDate: string): boolean {
  const targetDateObj = new Date(targetDate);
  const dayOfWeek = targetDateObj.getDay();
  const dayOfMonth = targetDateObj.getDate();

  let schedule: any = null;
  if (customer.notes) {
    try {
      const scheduleIdx = customer.notes.indexOf("Schedule:");
      if (scheduleIdx !== -1) {
        const jsonStr = customer.notes.substring(scheduleIdx + "Schedule:".length).trim();
        schedule = JSON.parse(jsonStr);
      }
    } catch (_e) {
      // Ignore parse errors
    }
  }

  const frequency = schedule?.frequency || customer.subscription_type || "daily";

  switch (frequency) {
    case "daily":
      return true;
    case "alternate":
      return dayOfMonth % 2 === 1;
    case "weekly": {
      const deliveryDay = schedule?.day ?? 0;
      return dayOfWeek === deliveryDay;
    }
    case "custom": {
      const customDays: number[] = schedule?.days || [0, 1, 2, 3, 4, 5, 6];
      return customDays.includes(dayOfWeek);
    }
    default:
      return true;
  }
}

/**
 * Mark an existing pending delivery as delivered
 */
async function markAsDelivered(
  supabase: any,
  deliveryId: string,
  customerId: string,
  customerSubs: any[]
) {
  const { data: existingItems } = await supabase
    .from("delivery_items")
    .select("id")
    .eq("delivery_id", deliveryId);

  if (!existingItems || existingItems.length === 0) {
    if (customerSubs.length > 0) {
      const items = customerSubs.map((sub: any) => {
        const product = sub.products as any;
        const unitPrice = sub.custom_price ?? product?.base_price ?? 0;
        return {
          delivery_id: deliveryId,
          product_id: sub.product_id,
          quantity: sub.quantity,
          unit_price: unitPrice,
          total_amount: unitPrice * sub.quantity,
        };
      });

      await supabase.from("delivery_items").insert(items);
    }
  }

  await supabase
    .from("deliveries")
    .update({
      status: "delivered",
      delivery_time: new Date().toISOString(),
      notes: "[AUTO] Auto-marked delivered",
    })
    .eq("id", deliveryId);
}
