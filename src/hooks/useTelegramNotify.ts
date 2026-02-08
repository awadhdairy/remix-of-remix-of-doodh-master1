import { invokeExternalFunction } from "@/lib/external-supabase";

type EventType = 
  | "health_alert"
  | "low_inventory"
  | "payment_received"
  | "large_transaction"
  | "production_recorded"
  | "procurement_recorded"
  | "delivery_completed";

interface NotifyResult {
  success: boolean;
  sent_count?: number;
  error?: string;
}

/**
 * Hook to send Telegram notifications for various events
 * This calls the telegram-event-notify edge function
 */
export function useTelegramNotify() {
  const notify = async (
    event_type: EventType,
    data: Record<string, any>
  ): Promise<NotifyResult> => {
    try {
      const response = await invokeExternalFunction<NotifyResult>(
        "telegram-event-notify",
        { event_type, data }
      );

      if (response.error) {
        console.error("[Telegram Notify] Error:", response.error);
        return { success: false, error: response.error.message };
      }

      return response.data || { success: false, error: "No response" };
    } catch (error: any) {
      console.error("[Telegram Notify] Exception:", error);
      return { success: false, error: error.message };
    }
  };

  return {
    notifyHealthAlert: (data: {
      tag_number: string;
      name?: string;
      title: string;
      description?: string;
    }) => notify("health_alert", data),

    notifyLowInventory: (data: {
      item_name: string;
      current_stock: number;
      min_level: number;
      unit: string;
    }) => notify("low_inventory", data),

    notifyPaymentReceived: (data: {
      amount: number;
      customer_name: string;
      payment_mode: string;
      reference?: string;
    }) => notify("payment_received", data),

    notifyLargeTransaction: (data: {
      amount: number;
      customer_name: string;
      payment_mode: string;
      reference?: string;
    }) => notify("large_transaction", data),

    notifyProductionRecorded: (data: {
      session: string;
      quantity: number;
      cattle_count?: number;
    }) => notify("production_recorded", data),

    notifyProcurementRecorded: (data: {
      vendor_name: string;
      quantity: number;
      rate: number;
      total_amount: number;
    }) => notify("procurement_recorded", data),

    notifyDeliveryCompleted: (data: {
      route_name?: string;
      completed_count: number;
      total_count: number;
      pending_count: number;
    }) => notify("delivery_completed", data),

    // Generic notify for custom events
    notify,
  };
}
