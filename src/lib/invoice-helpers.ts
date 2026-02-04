/**
 * Invoice calculation helpers for consistent billing logic across the app.
 * Provides computed "effective status" based on due_date rather than relying
 * on the payment_status field which may not be updated for overdue detection.
 */

export interface InvoiceBase {
  payment_status: string;
  due_date: string | null;
  final_amount: number;
  paid_amount: number | null;
}

/**
 * Get the effective payment status considering due date.
 * Returns "overdue" if past due date and not fully paid, even if the
 * database status field hasn't been updated.
 * 
 * @param invoice - Invoice with payment_status, due_date, final_amount, paid_amount
 * @returns Effective status: "paid" | "overdue" | "pending" | "partial"
 */
export function getEffectivePaymentStatus(invoice: InvoiceBase): string {
  // If already marked as paid in DB, trust it
  if (invoice.payment_status === "paid") return "paid";
  
  // Check if overdue based on due_date
  if (invoice.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      return "overdue";
    }
  }
  
  // Otherwise return the stored status (pending or partial)
  return invoice.payment_status;
}

/**
 * Get remaining balance on invoice (final_amount - paid_amount).
 * Safely handles null/undefined paid_amount.
 * 
 * @param invoice - Invoice with final_amount and paid_amount
 * @returns Remaining balance to be paid
 */
export function getInvoiceBalance(invoice: InvoiceBase): number {
  return Number(invoice.final_amount) - Number(invoice.paid_amount || 0);
}

/**
 * Check if invoice is overdue based on due_date comparison.
 * 
 * @param invoice - Invoice to check
 * @returns true if past due date and not fully paid
 */
export function isInvoiceOverdue(invoice: InvoiceBase): boolean {
  return getEffectivePaymentStatus(invoice) === "overdue";
}

/**
 * Check if invoice is fully paid.
 * 
 * @param invoice - Invoice to check
 * @returns true if payment_status is "paid"
 */
export function isInvoicePaid(invoice: InvoiceBase): boolean {
  return invoice.payment_status === "paid";
}

/**
 * Get count of overdue invoices from a list.
 * 
 * @param invoices - Array of invoices
 * @returns Count of overdue invoices
 */
export function countOverdueInvoices(invoices: InvoiceBase[]): number {
  return invoices.filter(isInvoiceOverdue).length;
}

/**
 * Calculate total outstanding balance (all unpaid invoices).
 * 
 * @param invoices - Array of invoices
 * @returns Sum of remaining balances for all non-paid invoices
 */
export function calculateOutstandingBalance(invoices: InvoiceBase[]): number {
  return invoices
    .filter(i => i.payment_status !== "paid")
    .reduce((sum, i) => sum + getInvoiceBalance(i), 0);
}

/**
 * Calculate total overdue balance (past due_date and not paid).
 * 
 * @param invoices - Array of invoices
 * @returns Sum of remaining balances for overdue invoices
 */
export function calculateOverdueBalance(invoices: InvoiceBase[]): number {
  return invoices
    .filter(isInvoiceOverdue)
    .reduce((sum, i) => sum + getInvoiceBalance(i), 0);
}
