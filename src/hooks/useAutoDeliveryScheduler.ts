import { useCallback } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { format, addDays, getDay } from "date-fns";

interface CustomerSubscription {
  customer_id: string;
  product_id: string;
  quantity: number;
  custom_price: number | null;
  is_active: boolean;
}

interface ScheduleResult {
  scheduled: number;
  skipped: number;
  autoDelivered: number;
  errors: string[];
}

interface CustomerWithSubscription {
  id: string;
  name: string;
  subscription_type: string;
  notes: string | null;
  is_active: boolean;
}

interface DeliverySchedule {
  delivery_days: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  auto_deliver: boolean;
}

// Map day of week (0 = Sunday, 1 = Monday, etc.) to delivery_days key
const dayOfWeekMap: Record<number, keyof DeliverySchedule["delivery_days"]> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

/**
 * Parse schedule metadata from customer notes
 */
function parseScheduleFromNotes(notes: string | null): DeliverySchedule | null {
  if (!notes) return null;
  
  try {
    const scheduleIdx = notes.indexOf("Schedule:");
    if (scheduleIdx !== -1) {
      const jsonStr = notes.substring(scheduleIdx + "Schedule:".length).trim();
      return JSON.parse(jsonStr);
    }
  } catch (e) {
    console.error("Failed to parse schedule from notes:", e);
  }
  
  return null;
}

/**
 * Check if a customer should receive delivery on a given date based on subscription type
 */
function shouldDeliverOnDate(
  customer: CustomerWithSubscription,
  targetDate: Date,
  schedule: DeliverySchedule | null
): boolean {
  const dayOfWeek = getDay(targetDate);
  const dayKey = dayOfWeekMap[dayOfWeek];

  // If we have a custom schedule, use it
  if (schedule?.delivery_days) {
    return schedule.delivery_days[dayKey];
  }

  // Fallback to subscription_type logic
  switch (customer.subscription_type) {
    case "daily":
      return true;
    
    case "alternate": {
      // Calculate days since a reference point (e.g., Jan 1, 2024)
      const refDate = new Date(2024, 0, 1);
      const daysSinceRef = Math.floor((targetDate.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceRef % 2 === 0;
    }
    
    case "weekly":
      // Default to Sunday for weekly
      return dayOfWeek === 0;
    
    case "custom":
      // Custom requires schedule in notes, if not found deliver daily
      return true;
    
    default:
      return true;
  }
}

/**
 * Auto-scheduler for deliveries based on customer subscriptions
 * Algorithm:
 * 1. Fetch all active customers with active subscriptions
 * 2. Check subscription frequency and delivery days
 * 3. Check vacation status for target date
 * 4. Check if delivery already exists for that date
 * 5. Create deliveries with items for eligible customers
 * 6. Auto-mark as delivered if auto_deliver is enabled
 */
export function useAutoDeliveryScheduler() {
  /**
   * Schedule deliveries for a specific date based on customer subscriptions
   */
  const scheduleDeliveriesForDate = useCallback(async (
    targetDate: string,
    autoMarkDelivered: boolean = false
  ): Promise<ScheduleResult> => {
    const result: ScheduleResult = { scheduled: 0, skipped: 0, autoDelivered: 0, errors: [] };
    const targetDateObj = new Date(targetDate);

    try {
      // 1. Fetch active customers with active subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from("customer_products")
        .select(`
          customer_id,
          product_id,
          quantity,
          custom_price,
          is_active,
          products (id, base_price, name, unit)
        `)
        .eq("is_active", true);

      if (subError) {
        result.errors.push(`Failed to fetch subscriptions: ${subError.message}`);
        return result;
      }

      // Get unique customer IDs with subscriptions
      const customerIds = [...new Set(subscriptions?.map(s => s.customer_id) || [])];

      if (customerIds.length === 0) {
        return result;
      }

      // 2. Fetch customer details for frequency checking
      const { data: customers, error: custError } = await supabase
        .from("customers")
        .select("id, name, subscription_type, notes, is_active")
        .in("id", customerIds)
        .eq("is_active", true);

      if (custError) {
        result.errors.push(`Failed to fetch customers: ${custError.message}`);
        return result;
      }

      const customerMap = new Map(customers?.map(c => [c.id, c]) || []);

      // 3. Check which customers are on vacation
      const { data: vacations } = await supabase
        .from("customer_vacations")
        .select("customer_id")
        .eq("is_active", true)
        .lte("start_date", targetDate)
        .gte("end_date", targetDate);

      const vacationCustomerIds = new Set(vacations?.map(v => v.customer_id) || []);

      // 4. Check existing deliveries for target date
      const { data: existingDeliveries } = await supabase
        .from("deliveries")
        .select("customer_id")
        .eq("delivery_date", targetDate);

      const existingCustomerIds = new Set(existingDeliveries?.map(d => d.customer_id) || []);

      // 5. Filter eligible customers based on all criteria
      const eligibleCustomers: { customerId: string; autoDeliver: boolean }[] = [];

      customerIds.forEach(customerId => {
        const customer = customerMap.get(customerId);
        if (!customer) {
          result.skipped++;
          return;
        }

        // Skip if on vacation
        if (vacationCustomerIds.has(customerId)) {
          result.skipped++;
          return;
        }

        // Skip if delivery already exists
        if (existingCustomerIds.has(customerId)) {
          result.skipped++;
          return;
        }

        // Parse schedule from notes
        const schedule = parseScheduleFromNotes(customer.notes);

        // Check if should deliver on this date based on frequency
        if (!shouldDeliverOnDate(customer, targetDateObj, schedule)) {
          result.skipped++;
          return;
        }

        eligibleCustomers.push({
          customerId,
          autoDeliver: autoMarkDelivered || (schedule?.auto_deliver ?? false),
        });
      });

      if (eligibleCustomers.length === 0) {
        return result;
      }

      // 6. Create deliveries with items
      for (const { customerId, autoDeliver } of eligibleCustomers) {
        try {
          // Create delivery
          const deliveryStatus = autoDeliver ? "delivered" : "pending";
          const { data: delivery, error: deliveryError } = await supabase
            .from("deliveries")
            .insert({
              customer_id: customerId,
              delivery_date: targetDate,
              status: deliveryStatus,
              delivery_time: autoDeliver ? new Date().toISOString() : null,
            })
            .select("id")
            .single();

          if (deliveryError) {
            result.errors.push(`Failed to create delivery for customer: ${deliveryError.message}`);
            continue;
          }

          // Get customer's active subscriptions
          const customerSubs = subscriptions?.filter(
            s => s.customer_id === customerId && s.is_active
          ) || [];

          // Create delivery items
          if (customerSubs.length > 0 && delivery) {
            const deliveryItems = customerSubs.map(sub => {
              const product = sub.products as any;
              const unitPrice = sub.custom_price ?? product?.base_price ?? 0;
              return {
                delivery_id: delivery.id,
                product_id: sub.product_id,
                quantity: sub.quantity,
                unit_price: unitPrice,
                total_amount: unitPrice * sub.quantity,
              };
            });

            const { error: itemsError } = await supabase
              .from("delivery_items")
              .insert(deliveryItems);

            if (itemsError) {
              console.error("Failed to create delivery items:", itemsError);
            }
          }

          result.scheduled++;
          if (autoDeliver) {
            result.autoDelivered++;
          }
        } catch (err: any) {
          result.errors.push(`Error processing customer: ${err.message}`);
        }
      }

      return result;
    } catch (error: any) {
      result.errors.push(`Unexpected error: ${error.message}`);
      return result;
    }
  }, []);

  /**
   * Schedule deliveries for the next N days
   */
  const scheduleDeliveriesForRange = useCallback(async (
    startDate: Date,
    days: number,
    autoMarkDelivered: boolean = false
  ): Promise<ScheduleResult[]> => {
    const results: ScheduleResult[] = [];
    
    for (let i = 0; i < days; i++) {
      const targetDate = format(addDays(startDate, i), "yyyy-MM-dd");
      const result = await scheduleDeliveriesForDate(targetDate, autoMarkDelivered);
      results.push(result);
    }
    
    return results;
  }, [scheduleDeliveriesForDate]);

  /**
   * Run daily auto-scheduler for today
   * This should be called once per day (e.g., via cron or on dashboard load)
   */
  const runDailyAutoScheduler = useCallback(async (): Promise<ScheduleResult> => {
    const today = format(new Date(), "yyyy-MM-dd");
    return scheduleDeliveriesForDate(today, false);
  }, [scheduleDeliveriesForDate]);

  /**
   * Auto-deliver all pending deliveries for a date
   * Marks pending deliveries as delivered and creates items if missing
   */
  const autoDeliverPendingForDate = useCallback(async (
    targetDate: string
  ): Promise<{ delivered: number; errors: string[] }> => {
    const result = { delivered: 0, errors: [] as string[] };

    try {
      // Get pending deliveries for the date
      const { data: pendingDeliveries, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          customer_id,
          delivery_items (id)
        `)
        .eq("delivery_date", targetDate)
        .eq("status", "pending");

      if (error) {
        result.errors.push(`Failed to fetch pending deliveries: ${error.message}`);
        return result;
      }

      if (!pendingDeliveries || pendingDeliveries.length === 0) {
        return result;
      }

      for (const delivery of pendingDeliveries) {
        try {
          // Check if delivery items exist, if not create them
          if (!delivery.delivery_items || delivery.delivery_items.length === 0) {
            // Fetch customer subscriptions
            const { data: subs } = await supabase
              .from("customer_products")
              .select(`
                product_id,
                quantity,
                custom_price,
                products (base_price)
              `)
              .eq("customer_id", delivery.customer_id)
              .eq("is_active", true);

            if (subs && subs.length > 0) {
              const items = subs.map(sub => {
                const product = sub.products as any;
                const unitPrice = sub.custom_price ?? product?.base_price ?? 0;
                return {
                  delivery_id: delivery.id,
                  product_id: sub.product_id,
                  quantity: sub.quantity,
                  unit_price: unitPrice,
                  total_amount: unitPrice * sub.quantity,
                };
              });

              await supabase.from("delivery_items").insert(items);
            }
          }

          // Mark as delivered
          await supabase
            .from("deliveries")
            .update({
              status: "delivered",
              delivery_time: new Date().toISOString(),
            })
            .eq("id", delivery.id);

          result.delivered++;
        } catch (err: any) {
          result.errors.push(`Error auto-delivering: ${err.message}`);
        }
      }

      return result;
    } catch (error: any) {
      result.errors.push(`Unexpected error: ${error.message}`);
      return result;
    }
  }, []);

  return {
    scheduleDeliveriesForDate,
    scheduleDeliveriesForRange,
    runDailyAutoScheduler,
    autoDeliverPendingForDate,
  };
}
