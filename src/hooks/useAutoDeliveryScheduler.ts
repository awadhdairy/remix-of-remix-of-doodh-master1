import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isWeekend, isBefore, startOfDay } from "date-fns";

interface CustomerSubscription {
  customer_id: string;
  product_id: string;
  quantity: number;
  is_active: boolean;
}

interface ScheduleResult {
  scheduled: number;
  skipped: number;
  errors: string[];
}

/**
 * Auto-scheduler for deliveries based on customer subscriptions
 * Algorithm:
 * 1. Fetch all active customers with active subscriptions
 * 2. Check vacation status for target date
 * 3. Check if delivery already exists for that date
 * 4. Create deliveries only for eligible customers
 */
export function useAutoDeliveryScheduler() {
  /**
   * Schedule deliveries for a specific date based on customer subscriptions
   */
  const scheduleDeliveriesForDate = useCallback(async (
    targetDate: string
  ): Promise<ScheduleResult> => {
    const result: ScheduleResult = { scheduled: 0, skipped: 0, errors: [] };

    try {
      // 1. Fetch active customers with active subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from("customer_products")
        .select(`
          customer_id,
          product_id,
          quantity,
          is_active,
          customer:customer_id (id, is_active, route_id)
        `)
        .eq("is_active", true);

      if (subError) {
        result.errors.push(`Failed to fetch subscriptions: ${subError.message}`);
        return result;
      }

      // Group by customer to get unique customers with subscriptions
      const customerIds = [...new Set(subscriptions?.map(s => s.customer_id) || [])];

      // 2. Check which customers are on vacation
      const { data: vacations } = await supabase
        .from("customer_vacations")
        .select("customer_id")
        .eq("is_active", true)
        .lte("start_date", targetDate)
        .gte("end_date", targetDate);

      const vacationCustomerIds = new Set(vacations?.map(v => v.customer_id) || []);

      // 3. Check existing deliveries for target date
      const { data: existingDeliveries } = await supabase
        .from("deliveries")
        .select("customer_id")
        .eq("delivery_date", targetDate);

      const existingCustomerIds = new Set(existingDeliveries?.map(d => d.customer_id) || []);

      // 4. Filter eligible customers and create deliveries
      const eligibleCustomers = customerIds.filter(customerId => {
        // Skip if on vacation
        if (vacationCustomerIds.has(customerId)) {
          result.skipped++;
          return false;
        }
        // Skip if delivery already exists
        if (existingCustomerIds.has(customerId)) {
          result.skipped++;
          return false;
        }
        return true;
      });

      if (eligibleCustomers.length === 0) {
        return result;
      }

      // 5. Batch insert deliveries
      const deliveriesToCreate = eligibleCustomers.map(customerId => ({
        customer_id: customerId,
        delivery_date: targetDate,
        status: "pending" as const,
      }));

      const { error: insertError } = await supabase
        .from("deliveries")
        .insert(deliveriesToCreate);

      if (insertError) {
        result.errors.push(`Failed to create deliveries: ${insertError.message}`);
      } else {
        result.scheduled = eligibleCustomers.length;
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
    days: number
  ): Promise<ScheduleResult[]> => {
    const results: ScheduleResult[] = [];
    
    for (let i = 0; i < days; i++) {
      const targetDate = format(addDays(startDate, i), "yyyy-MM-dd");
      const result = await scheduleDeliveriesForDate(targetDate);
      results.push(result);
    }
    
    return results;
  }, [scheduleDeliveriesForDate]);

  return {
    scheduleDeliveriesForDate,
    scheduleDeliveriesForRange,
  };
}
