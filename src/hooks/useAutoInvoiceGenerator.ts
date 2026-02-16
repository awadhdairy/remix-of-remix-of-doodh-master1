import { useCallback } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { format, endOfMonth, addDays } from "date-fns";

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
 * 
 * Issue 9.1 Fix: Batch operations to eliminate N+1 query pattern
 * 
 * Algorithm:
 * 1. Aggregate delivered items for each customer in billing period (batch fetch)
 * 2. Calculate totals with customer-specific pricing
 * 3. Generate invoice numbers in sequence
 * 4. Bulk insert invoices
 */
export function useAutoInvoiceGenerator() {
  /**
   * Generate invoice number with format: INV-YYYYMM-XXXX
   * Uses a base count and increments for each invoice in the batch
   */
  const generateInvoiceNumbers = useCallback(async (count: number): Promise<string[]> => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const prefix = `INV-${year}${month}`;

    // Get count of existing invoices with same prefix
    const { count: existingCount } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .like("invoice_number", `${prefix}%`);

    const baseSequence = (existingCount || 0) + 1;
    
    // Generate all invoice numbers at once
    return Array.from({ length: count }, (_, i) => 
      `${prefix}-${String(baseSequence + i).padStart(4, "0")}`
    );
  }, []);

  /**
   * Calculate customer invoice data from deliveries (single customer)
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
   * 
   * Optimized with batch operations:
   * 1. Single query to fetch all deliveries with items
   * 2. Single query to get existing invoices
   * 3. Process in memory
   * 4. Bulk insert invoices
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

    try {
      // BATCH FETCH 1: Get current UPI handle from dairy settings
      const { data: dairySettings } = await supabase
        .from("dairy_settings")
        .select("upi_handle")
        .limit(1)
        .single();
      
      const currentUpiHandle = dairySettings?.upi_handle || null;

      // BATCH FETCH 2: Get all active customers
      const { data: customers, error: custError } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true);

      if (custError) {
        result.errors.push(`Failed to fetch customers: ${custError.message}`);
        return result;
      }

      if (!customers || customers.length === 0) {
        return result;
      }

      const customerIds = customers.map(c => c.id);
      const customerMap = new Map(customers.map(c => [c.id, c.name]));

      // BATCH FETCH 3: Get all existing invoices for this period in one query
      const { data: existingInvoices } = await supabase
        .from("invoices")
        .select("customer_id")
        .eq("billing_period_start", periodStart)
        .eq("billing_period_end", periodEnd);

      const existingCustomerIds = new Set(existingInvoices?.map(i => i.customer_id) || []);

      // Filter customers who need invoices
      const customersToInvoice = customerIds.filter(id => !existingCustomerIds.has(id));
      
      if (customersToInvoice.length === 0) {
        result.skipped = customers.length;
        return result;
      }

      // BATCH FETCH 4: Get ALL deliveries with items for ALL customers in one query
      const { data: allDeliveries, error: deliveryError } = await supabase
        .from("deliveries")
        .select(`
          id,
          customer_id,
          delivery_date,
          status,
          delivery_items (
            product_id,
            quantity,
            unit_price,
            total_amount
          )
        `)
        .in("customer_id", customersToInvoice)
        .eq("status", "delivered")
        .gte("delivery_date", periodStart)
        .lte("delivery_date", periodEnd)
        .limit(10000);

      if (deliveryError) {
        result.errors.push(`Failed to fetch deliveries: ${deliveryError.message}`);
        return result;
      }

      // Group deliveries by customer in memory
      const deliveriesByCustomer = new Map<string, typeof allDeliveries>();
      (allDeliveries || []).forEach(delivery => {
        const existing = deliveriesByCustomer.get(delivery.customer_id) || [];
        existing.push(delivery);
        deliveriesByCustomer.set(delivery.customer_id, existing);
      });

      // Calculate invoice data for each customer (in memory - no queries)
      const invoiceDataList: Array<{
        customer_id: string;
        customer_name: string;
        total_amount: number;
      }> = [];

      for (const customerId of customersToInvoice) {
        const customerDeliveries = deliveriesByCustomer.get(customerId);
        
        if (!customerDeliveries || customerDeliveries.length === 0) {
          result.skipped++;
          continue;
        }

        // Calculate total from delivery items
        let totalAmount = 0;
        customerDeliveries.forEach(delivery => {
          (delivery.delivery_items || []).forEach((item: DeliveryItem) => {
            totalAmount += item.total_amount;
          });
        });

        if (totalAmount === 0) {
          result.skipped++;
          continue;
        }

        invoiceDataList.push({
          customer_id: customerId,
          customer_name: customerMap.get(customerId) || "Unknown",
          total_amount: totalAmount,
        });
      }

      if (invoiceDataList.length === 0) {
        return result;
      }

      // BATCH: Generate all invoice numbers at once
      const invoiceNumbers = await generateInvoiceNumbers(invoiceDataList.length);

      // BATCH INSERT: Prepare all invoices for bulk insert
      const invoicesToInsert = invoiceDataList.map((data, index) => ({
        invoice_number: invoiceNumbers[index],
        customer_id: data.customer_id,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        total_amount: data.total_amount,
        tax_amount: 0,
        discount_amount: 0,
        final_amount: data.total_amount,
        paid_amount: 0,
        payment_status: "pending" as const,
        due_date: dueDate,
        upi_handle: currentUpiHandle,
      }));

      // Single bulk insert for all invoices
      const { data: insertedInvoices, error: insertError } = await supabase
        .from("invoices")
        .insert(invoicesToInsert)
        .select("id, customer_id, invoice_number, final_amount");

      if (insertError) {
        result.errors.push(`Failed to insert invoices: ${insertError.message}`);
        return result;
      }

      // Create ledger entries for each invoice (prevents orphan invoices)
      for (const inv of insertedInvoices || []) {
        const { error: ledgerError } = await supabase.rpc("insert_ledger_with_balance", {
          _customer_id: inv.customer_id,
          _transaction_date: format(new Date(), "yyyy-MM-dd"),
          _transaction_type: "invoice",
          _description: `Invoice ${inv.invoice_number} generated`,
          _debit_amount: inv.final_amount,
          _credit_amount: 0,
          _reference_id: inv.id,
        });
        if (ledgerError) {
          result.errors.push(`Ledger entry failed for ${inv.invoice_number}: ${ledgerError.message}`);
        }
      }

      // Update result
      result.generated = invoiceDataList.length;
      result.total_amount = invoiceDataList.reduce((sum, d) => sum + d.total_amount, 0);
      result.invoices = invoiceDataList.map((data, index) => ({
        customer_name: data.customer_name,
        amount: data.total_amount,
        invoice_number: invoiceNumbers[index],
      }));

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Unexpected error: ${errorMessage}`);
      return result;
    }
  }, [generateInvoiceNumbers]);

  return {
    generateMonthlyInvoices,
    calculateCustomerInvoice,
    generateInvoiceNumber: async () => {
      const numbers = await generateInvoiceNumbers(1);
      return numbers[0];
    },
  };
}
