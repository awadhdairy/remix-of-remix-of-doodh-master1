import { externalSupabase as supabase } from "@/lib/external-supabase";
import { format } from "date-fns";
import { logger } from "@/lib/logger";

interface ExpenseEntry {
  category: string;
  title: string;
  amount: number;
  expense_date: string;
  notes?: string;
  reference_type?: string;
  reference_id?: string;
}

/**
 * Hook for automated expense tracking across the application.
 * Automatically creates expense entries when financial transactions occur.
 */
export function useExpenseAutomation() {
  /**
   * Check if an expense already exists for a reference
   * Uses LIKE pattern matching since notes may contain additional info after the reference
   */
  const checkExpenseExists = async (referenceId: string, referenceType: string): Promise<boolean> => {
    const { data } = await supabase
      .from("expenses")
      .select("id")
      .like("notes", `[AUTO] ${referenceType}:${referenceId}%`)
      .limit(1);
    
    return (data && data.length > 0);
  };

  /**
   * Create an automated expense entry
   */
  const createExpense = async (entry: ExpenseEntry): Promise<boolean> => {
    // Check for duplicates if reference provided
    if (entry.reference_id && entry.reference_type) {
      const exists = await checkExpenseExists(entry.reference_id, entry.reference_type);
      if (exists) {
        logger.debug("Expense", `Already exists for ${entry.reference_type}:${entry.reference_id}`);
        return false;
      }
    }

    const { error } = await supabase.from("expenses").insert({
      category: entry.category,
      title: entry.title,
      amount: entry.amount,
      expense_date: entry.expense_date,
      notes: entry.reference_id && entry.reference_type 
        ? `[AUTO] ${entry.reference_type}:${entry.reference_id}${entry.notes ? ` | ${entry.notes}` : ''}`
        : entry.notes || null,
    });

    if (error) {
      logger.error("Expense", "Failed to create automated expense", error);
      return false;
    }

    logger.expense("Created", { item: entry.title, amount: entry.amount });
    return true;
  };

  /**
   * Log salary payment expense when payroll is marked as paid
   */
  const logSalaryExpense = async (
    employeeName: string,
    netSalary: number,
    payPeriodStart: string,
    payPeriodEnd: string,
    payrollId: string
  ): Promise<boolean> => {
    if (netSalary <= 0) return false;

    return await createExpense({
      category: "salary",
      title: `Salary - ${employeeName}`,
      amount: netSalary,
      expense_date: format(new Date(), "yyyy-MM-dd"),
      notes: `Pay period: ${format(new Date(payPeriodStart), "dd MMM")} - ${format(new Date(payPeriodEnd), "dd MMM yyyy")}`,
      reference_type: "payroll",
      reference_id: payrollId,
    });
  };

  /**
   * Log equipment purchase expense
   */
  const logEquipmentPurchase = async (
    equipmentName: string,
    purchaseCost: number,
    purchaseDate: string,
    equipmentId: string
  ): Promise<boolean> => {
    if (purchaseCost <= 0) return false;

    return await createExpense({
      category: "misc",
      title: `Equipment Purchase - ${equipmentName}`,
      amount: purchaseCost,
      expense_date: purchaseDate || format(new Date(), "yyyy-MM-dd"),
      reference_type: "equipment",
      reference_id: equipmentId,
    });
  };

  /**
   * Log maintenance cost expense
   */
  const logMaintenanceExpense = async (
    equipmentName: string,
    maintenanceType: string,
    cost: number,
    maintenanceDate: string,
    maintenanceId: string
  ): Promise<boolean> => {
    if (cost <= 0) return false;

    return await createExpense({
      category: "maintenance",
      title: `${maintenanceType.charAt(0).toUpperCase() + maintenanceType.slice(1)} - ${equipmentName}`,
      amount: cost,
      expense_date: maintenanceDate,
      reference_type: "maintenance",
      reference_id: maintenanceId,
    });
  };

  /**
   * Log cattle health expense (vaccination, treatment, etc.)
   */
  const logHealthExpense = async (
    cattleTag: string,
    recordType: string,
    title: string,
    cost: number,
    recordDate: string,
    healthRecordId: string
  ): Promise<boolean> => {
    if (cost <= 0) return false;

    return await createExpense({
      category: "medicine",
      title: `${recordType.charAt(0).toUpperCase() + recordType.slice(1)} - ${cattleTag}: ${title}`,
      amount: cost,
      expense_date: recordDate,
      reference_type: "health",
      reference_id: healthRecordId,
    });
  };

  /**
   * Log feed/inventory purchase expense
   */
  const logFeedPurchase = async (
    itemName: string,
    quantity: number,
    unitCost: number,
    unit: string,
    purchaseDate?: string
  ): Promise<boolean> => {
    const totalCost = quantity * unitCost;
    if (totalCost <= 0) return false;

    // Generate a unique reference for this purchase using timestamp for uniqueness
    const timestamp = Date.now();
    const reference = `feed_${itemName.replace(/\s+/g, '_')}_${timestamp}`;

    logger.expense("Creating feed purchase", { item: itemName, amount: totalCost });

    return await createExpense({
      category: "feed",
      title: `Feed Purchase - ${itemName}`,
      amount: totalCost,
      expense_date: purchaseDate || format(new Date(), "yyyy-MM-dd"),
      notes: `${quantity} ${unit} @ ₹${unitCost}/${unit}`,
      reference_type: "feed_purchase",
      reference_id: reference,
    });
  };

  /**
   * Log generic expense (for miscellaneous losses, damages, etc.)
   */
  const logGenericExpense = async (
    category: string,
    title: string,
    amount: number,
    date?: string,
    notes?: string
  ): Promise<boolean> => {
    if (amount <= 0) return false;

    return await createExpense({
      category,
      title,
      amount,
      expense_date: date || format(new Date(), "yyyy-MM-dd"),
      notes,
    });
  };

  /**
   * Log bottle loss/damage expense
   */
  const logBottleLoss = async (
    bottleType: string,
    quantity: number,
    depositAmount: number,
    reason?: string
  ): Promise<boolean> => {
    const totalLoss = quantity * depositAmount;
    if (totalLoss <= 0) return false;

    return await createExpense({
      category: "misc",
      title: `Bottle Loss - ${bottleType}`,
      amount: totalLoss,
      expense_date: format(new Date(), "yyyy-MM-dd"),
      notes: reason || `${quantity} bottles lost/damaged`,
      reference_type: "bottle_loss",
      reference_id: `bottle_${bottleType}_${Date.now()}`,
    });
  };

  /**
   * Log transport/delivery expense
   */
  const logTransportExpense = async (
    description: string,
    amount: number,
    date?: string
  ): Promise<boolean> => {
    if (amount <= 0) return false;

    return await createExpense({
      category: "transport",
      title: description,
      amount,
      expense_date: date || format(new Date(), "yyyy-MM-dd"),
    });
  };

  /**
   * Log utility expense (electricity, water)
   */
  const logUtilityExpense = async (
    description: string,
    amount: number,
    date?: string
  ): Promise<boolean> => {
    if (amount <= 0) return false;

    return await createExpense({
      category: "electricity",
      title: description,
      amount,
      expense_date: date || format(new Date(), "yyyy-MM-dd"),
    });
  };

  /**
   * Log milk procurement expense when payment is marked as paid
   * @deprecated Use logVendorPaymentExpense for lump-sum vendor payments instead
   */
  const logMilkProcurementExpense = async (
    vendorName: string,
    quantity: number,
    rate: number,
    totalAmount: number,
    procurementDate: string,
    procurementId: string,
    session: string
  ): Promise<boolean> => {
    if (totalAmount <= 0) return false;

    return await createExpense({
      category: "feed",
      title: `Milk Procurement - ${vendorName}`,
      amount: totalAmount,
      expense_date: procurementDate,
      notes: `${quantity}L @ ₹${rate}/L (${session === "morning" ? "AM" : "PM"})`,
      reference_type: "milk_procurement",
      reference_id: procurementId,
    });
  };

  /**
   * Log vendor payment expense when lump-sum payment is made to a milk vendor
   */
  const logVendorPaymentExpense = async (
    vendorName: string,
    amount: number,
    paymentDate: string,
    paymentId: string,
    paymentMode: string,
    referenceNumber?: string
  ): Promise<boolean> => {
    if (amount <= 0) return false;

    return await createExpense({
      category: "feed",
      title: `Vendor Payment - ${vendorName}`,
      amount,
      expense_date: paymentDate,
      notes: `Payment via ${paymentMode}${referenceNumber ? ` (Ref: ${referenceNumber})` : ''}`,
      reference_type: "vendor_payment",
      reference_id: paymentId,
    });
  };

  return {
    createExpense,
    logSalaryExpense,
    logEquipmentPurchase,
    logMaintenanceExpense,
    logHealthExpense,
    logFeedPurchase,
    logGenericExpense,
    logBottleLoss,
    logTransportExpense,
    logUtilityExpense,
    logMilkProcurementExpense,
    logVendorPaymentExpense,
  };
}
