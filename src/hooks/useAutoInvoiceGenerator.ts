import { useCallback } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { format, endOfMonth, addDays } from "date-fns";
import { getProductPrice } from "@/lib/supabase-helpers";

interface DeliveryItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

interface CustomerInvoiceData {
  customer_id: string;
  customer_name: string;
  total_amount: number;
  items: DeliveryItem[];
  delivery_count: number;
}

interface InvoiceGenerationResult {
  generated: number;
  skipped: number;
  total_amount: number;
  errors: string[];
  invoices: Array<{
    customer_name: string;
    amount: number;
    invoice_number: string;
  }>;
}

/**
 * Auto-generates invoices from delivery data
 * Algorithm:
 * 1. Aggregate delivered items for each customer in billing period
 * 2. Calculate totals with customer-specific pricing
 * 3. Apply any applicable discounts
 * 4. Generate invoice with unique number
 */
export function useAutoInvoiceGenerator() {
  /**
   * Generate invoice number with format: INV-YYYYMM-XXX
   */
  const generateInvoiceNumber = useCallback(async (): Promise<string> => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const prefix = `INV-${year}${month}`;

    // Get count of existing invoices with same prefix
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .like("invoice_number", `${prefix}%`);

    const sequence = String((count || 0) + 1).padStart(3, "0");
    return `${prefix}-${sequence}`;
  }, []);

  /**
   * Calculate customer invoice data from deliveries
   */
  const calculateCustomerInvoice = useCallback(async (
    customerId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<CustomerInvoiceData | null> => {
    // Fetch delivered items for the customer in the period
    const { data: deliveries, error } = await supabase
      .from("deliveries")
      .select(`
        id,
        delivery_date,
        status,
        delivery_items (
          product_id,
          quantity,
          unit_price,
          total_amount
        )
      `)
      .eq("customer_id", customerId)
      .eq("status", "delivered")
      .gte("delivery_date", periodStart)
      .lte("delivery_date", periodEnd);

    if (error || !deliveries || deliveries.length === 0) {
      return null;
    }

    // Get customer name
    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .single();

    // Aggregate items
    const itemsMap = new Map<string, DeliveryItem>();
    let totalAmount = 0;

    deliveries.forEach(delivery => {
      (delivery.delivery_items || []).forEach((item: DeliveryItem) => {
        const existing = itemsMap.get(item.product_id);
        if (existing) {
          existing.quantity += item.quantity;
          existing.total_amount += item.total_amount;
        } else {
          itemsMap.set(item.product_id, { ...item });
        }
        totalAmount += item.total_amount;
      });
    });

    // If no items, calculate from subscription prices
    if (itemsMap.size === 0 && deliveries.length > 0) {
      const { data: subscriptions } = await supabase
        .from("customer_products")
        .select(`
          product_id,
          quantity,
          custom_price,
          product:product_id (base_price)
        `)
        .eq("customer_id", customerId)
        .eq("is_active", true);

      subscriptions?.forEach(sub => {
        const price = sub.custom_price || getProductPrice(sub.product);
        const itemTotal = price * sub.quantity * deliveries.length;
        itemsMap.set(sub.product_id, {
          product_id: sub.product_id,
          quantity: sub.quantity * deliveries.length,
          unit_price: price,
          total_amount: itemTotal,
        });
        totalAmount += itemTotal;
      });
    }

    return {
      customer_id: customerId,
      customer_name: customer?.name || "Unknown",
      total_amount: totalAmount,
      items: Array.from(itemsMap.values()),
      delivery_count: deliveries.length,
    };
  }, []);

  /**
   * Generate invoices for all customers for a billing period
   */
  const generateMonthlyInvoices = useCallback(async (
    year: number,
    month: number
  ): Promise<InvoiceGenerationResult> => {
    const periodStart = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
    const periodEnd = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");
    const dueDate = format(addDays(new Date(year, month, 0), 15), "yyyy-MM-dd");

    const result: InvoiceGenerationResult = {
      generated: 0,
      skipped: 0,
      total_amount: 0,
      errors: [],
      invoices: [],
    };

    // Fetch current UPI handle from dairy settings
    const { data: dairySettings } = await supabase
      .from("dairy_settings")
      .select("upi_handle")
      .limit(1)
      .single();
    
    const currentUpiHandle = dairySettings?.upi_handle || null;

    try {
      // Get all active customers
      const { data: customers, error: custError } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true);

      if (custError) {
        result.errors.push(`Failed to fetch customers: ${custError.message}`);
        return result;
      }

      // Check for existing invoices in this period
      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("customer_id")
        .eq("billing_period_start", periodStart)
        .eq("billing_period_end", periodEnd);

      const existingCustomerIds = new Set(existingInvoices?.map(i => i.customer_id) || []);

      for (const customer of customers || []) {
        // Skip if invoice already exists
        if (existingCustomerIds.has(customer.id)) {
          result.skipped++;
          continue;
        }

        const invoiceData = await calculateCustomerInvoice(customer.id, periodStart, periodEnd);
        
        if (!invoiceData || invoiceData.total_amount === 0) {
          result.skipped++;
          continue;
        }

        const invoiceNumber = await generateInvoiceNumber();

        const { error: insertError } = await supabase.from("invoices").insert({
          invoice_number: invoiceNumber,
          customer_id: customer.id,
          billing_period_start: periodStart,
          billing_period_end: periodEnd,
          total_amount: invoiceData.total_amount,
          tax_amount: 0,
          discount_amount: 0,
          final_amount: invoiceData.total_amount,
          paid_amount: 0,
          payment_status: "pending",
          due_date: dueDate,
          upi_handle: currentUpiHandle,
        });

        if (insertError) {
          result.errors.push(`Failed to create invoice for ${customer.name}: ${insertError.message}`);
        } else {
          result.generated++;
          result.total_amount += invoiceData.total_amount;
          result.invoices.push({
            customer_name: customer.name,
            amount: invoiceData.total_amount,
            invoice_number: invoiceNumber,
          });
        }
      }

      return result;
    } catch (error: any) {
      result.errors.push(`Unexpected error: ${error.message}`);
      return result;
    }
  }, [calculateCustomerInvoice, generateInvoiceNumber]);

  return {
    generateMonthlyInvoices,
    calculateCustomerInvoice,
    generateInvoiceNumber,
  };
}
