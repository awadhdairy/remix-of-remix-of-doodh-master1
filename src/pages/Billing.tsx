import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { useTelegramNotify } from "@/hooks/useTelegramNotify";
import { invalidateBillingRelated } from "@/lib/query-invalidation";
import { useUserRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { DataFilters, DateRange, SortOrder, getDateFilterValue } from "@/components/common/DataFilters";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Receipt, IndianRupee, Loader2, Edit3, AlertTriangle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { InvoicePDFGenerator } from "@/components/billing/InvoicePDFGenerator";
import { EditInvoiceDialog } from "@/components/billing/EditInvoiceDialog";
import { SmartInvoiceCreator } from "@/components/billing/SmartInvoiceCreator";
import { 
  getEffectivePaymentStatus, 
  getInvoiceBalance, 
  isInvoiceOverdue,
  calculateOutstandingBalance,
  calculateOverdueBalance,
  countOverdueInvoices
} from "@/lib/invoice-helpers";
interface Customer {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  base_price: number;
  unit: string;
  tax_percentage: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  paid_amount: number;
  payment_status: string;
  due_date: string | null;
  created_at: string;
  customer?: Customer;
  notes?: string | null;
}

interface InvoiceWithCustomer extends Invoice {
  customer: Customer;
}

const sortOptions = [
  { value: "created_at", label: "Date Created" },
  { value: "final_amount", label: "Amount" },
  { value: "billing_period_start", label: "Billing Period" },
];

export default function BillingPage() {
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithCustomer | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithCustomer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceWithCustomer | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Filter & Sort state
  const [dateRange, setDateRange] = useState<DateRange>("90");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  
  const { toast } = useToast();
  const { notifyPaymentReceived, notifyLargeTransaction } = useTelegramNotify();
  const { role } = useUserRole();
  const queryClient = useQueryClient();
  const canDelete = role === "super_admin" || role === "manager";

  useEffect(() => {
    fetchData();
  }, [dateRange, sortBy, sortOrder]);

  const fetchData = async () => {
    setLoading(true);
    const startDate = getDateFilterValue(dateRange);
    
    try {
      let invoiceQuery = supabase
        .from("invoices")
        .select(`
          *,
          customer:customer_id (id, name)
        `)
        .order(sortBy, { ascending: sortOrder === "asc" });
      
      if (startDate) {
        invoiceQuery = invoiceQuery.gte("created_at", startDate);
      }
      
      const [customerRes, invoiceRes, productRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        invoiceQuery,
        supabase
          .from("products")
          .select("id, name, base_price, unit, tax_percentage")
          .eq("is_active", true)
          .order("name")
      ]);

      setCustomers(customerRes.data || []);
      setProducts(productRes.data || []);

      if (invoiceRes.error) {
        toast({
          title: "Error fetching invoices",
          description: invoiceRes.error.message,
          variant: "destructive",
        });
      } else {
        setInvoices((invoiceRes.data as InvoiceWithCustomer[]) || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    const invoiceRemaining = Number(selectedInvoice.final_amount) - Number(selectedInvoice.paid_amount);
    const cappedAmount = Math.min(amount, invoiceRemaining);
    const excessAmount = amount - cappedAmount;
    
    const newPaidAmount = Number(selectedInvoice.paid_amount) + cappedAmount;
    const remaining = Number(selectedInvoice.final_amount) - newPaidAmount;
    
    let newStatus: "paid" | "partial" | "pending" = "partial";
    if (remaining <= 0) newStatus = "paid";
    else if (newPaidAmount === 0) newStatus = "pending";

    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({ 
        paid_amount: newPaidAmount,
        payment_status: newStatus,
        ...(newStatus === "paid" ? { payment_date: format(new Date(), "yyyy-MM-dd") } : {})
      })
      .eq("id", selectedInvoice.id);

    const { error: paymentError } = await supabase.from("payments").insert({
      invoice_id: selectedInvoice.id,
      customer_id: selectedInvoice.customer_id,
      amount: amount,
      payment_mode: paymentMode,
      payment_date: format(new Date(), "yyyy-MM-dd"),
    });

    // Atomic ledger entry with running balance (prevents race conditions)
    await supabase.rpc("insert_ledger_with_balance", {
      _customer_id: selectedInvoice.customer_id,
      _transaction_date: format(new Date(), "yyyy-MM-dd"),
      _transaction_type: "payment",
      _description: `Payment for ${selectedInvoice.invoice_number}`,
      _debit_amount: 0,
      _credit_amount: amount,
      _reference_id: selectedInvoice.id,
    });


    if (invoiceError || paymentError) {
      toast({
        title: "Error recording payment",
        description: invoiceError?.message || paymentError?.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment recorded",
        description: `₹${amount.toLocaleString("en-IN")} payment recorded`,
      });
      
      // Send Telegram notification
      notifyPaymentReceived({
        amount: amount,
        customer_name: selectedInvoice.customer?.name || "Customer",
        payment_mode: paymentMode,
        reference: selectedInvoice.invoice_number,
      });
      
      // Notify for large transactions (₹10,000+)
      if (amount >= 10000) {
        notifyLargeTransaction({
          amount: amount,
          customer_name: selectedInvoice.customer?.name || "Customer",
        payment_mode: paymentMode,
        reference: selectedInvoice.invoice_number,
      });
      }
      
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPaymentMode("cash");
      setSelectedInvoice(null);
      invalidateBillingRelated(queryClient);
      fetchData();
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deletingInvoice) return;
    setDeleting(true);

    try {
      // 1. Delete associated invoice ledger entries (by reference_id for new, description for legacy)
      await supabase
        .from("customer_ledger")
        .delete()
        .eq("reference_id", deletingInvoice.id)
        .eq("transaction_type", "invoice");

      await supabase
        .from("customer_ledger")
        .delete()
        .eq("customer_id", deletingInvoice.customer_id)
        .eq("transaction_type", "invoice")
        .ilike("description", `%${deletingInvoice.invoice_number}%`);

      // 2. Delete associated payments
      await supabase
        .from("payments")
        .delete()
        .eq("invoice_id", deletingInvoice.id);

      // 3. Delete payment ledger entries (by reference_id)
      await supabase
        .from("customer_ledger")
        .delete()
        .eq("reference_id", deletingInvoice.id);

      // 4. Delete the invoice
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", deletingInvoice.id);

      if (error) throw error;

      // Recalculate running balances after deleting ledger entries
      await supabase.rpc("recalculate_ledger_balances", {
        _customer_id: deletingInvoice.customer_id,
      });

      toast({
        title: "Invoice deleted",
        description: `Invoice ${deletingInvoice.invoice_number} and associated records removed`,
      });

      setDeleteDialogOpen(false);
      setDeletingInvoice(null);
      invalidateBillingRelated(queryClient);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error deleting invoice",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Use computed effective status for filtering (includes date-based overdue detection)
  const filteredInvoices = statusFilter === "all" 
    ? invoices 
    : invoices.filter(i => getEffectivePaymentStatus(i) === statusFilter);

  // Stats using correct calculations:
  // - Outstanding: All unpaid invoices (pending + partial + overdue) showing REMAINING balance
  // - Overdue: Date-based detection (due_date < today and not paid) showing REMAINING balance
  const overdueCount = countOverdueInvoices(invoices);
  const stats = {
    total: invoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
    collected: invoices.reduce((sum, i) => sum + Number(i.paid_amount || 0), 0), // Invoice-level payments (capped at invoice amount)
    outstanding: calculateOutstandingBalance(invoices),
    overdue: calculateOverdueBalance(invoices),
    overdueCount,
  };

  const columns = [
    {
      key: "invoice_number",
      header: "Invoice #",
      render: (item: InvoiceWithCustomer) => (
        <span className="font-mono font-medium text-primary">{item.invoice_number}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (item: InvoiceWithCustomer) => (
        <span className="font-medium">{item.customer?.name}</span>
      ),
    },
    {
      key: "period",
      header: "Billing Period",
      render: (item: InvoiceWithCustomer) => (
        <span className="text-sm">
          {format(new Date(item.billing_period_start), "dd MMM")} - {format(new Date(item.billing_period_end), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "final_amount",
      header: "Amount",
      render: (item: InvoiceWithCustomer) => (
        <span className="font-semibold">₹{Number(item.final_amount).toLocaleString("en-IN")}</span>
      ),
    },
    {
      key: "paid_amount",
      header: "Paid",
      render: (item: InvoiceWithCustomer) => (
        <span className="text-success">₹{Number(item.paid_amount).toLocaleString("en-IN")}</span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      render: (item: InvoiceWithCustomer) => {
        const balance = Number(item.final_amount) - Number(item.paid_amount);
        return (
          <span className={balance > 0 ? "text-destructive font-medium" : ""}>
            ₹{balance.toLocaleString("en-IN")}
          </span>
        );
      },
    },
    {
      key: "payment_status",
      header: "Status",
      render: (item: InvoiceWithCustomer) => (
        <StatusBadge status={getEffectivePaymentStatus(item)} />
      ),
    },
    {
      key: "download",
      header: "Invoice",
      render: (item: InvoiceWithCustomer) => (
        <InvoicePDFGenerator invoice={item} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: InvoiceWithCustomer) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setEditingInvoice(item);
              setEditDialogOpen(true);
            }}
            title={item.payment_status === "paid" ? "View invoice" : "Edit invoice"}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              setSelectedInvoice(item);
              setPaymentAmount("");
              setPaymentMode("cash");
              setPaymentDialogOpen(true);
            }}
            disabled={item.payment_status === "paid"}
          >
            <IndianRupee className="h-3 w-3" /> Pay
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => {
                setDeletingInvoice(item);
                setDeleteDialogOpen(true);
              }}
              title="Delete invoice"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Invoices"
        description="Manage invoices and payments"
        icon={Receipt}
        action={{
          label: "Create Invoice",
          onClick: () => setDialogOpen(true),
        }}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">₹{stats.total.toLocaleString("en-IN")}</div>
            <p className="text-sm text-muted-foreground">Total Billed</p>
          </CardContent>
        </Card>
        <Card className="border-success/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">₹{stats.collected.toLocaleString("en-IN")}</div>
            <p className="text-sm text-muted-foreground">Invoice Payments</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">₹{stats.outstanding.toLocaleString("en-IN")}</div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-destructive">₹{stats.overdue.toLocaleString("en-IN")}</div>
              {stats.overdueCount > 0 && (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Overdue {stats.overdueCount > 0 && `(${stats.overdueCount} invoices)`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Filters */}
      <DataFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        sortBy={sortBy}
        sortOptions={sortOptions}
        onSortChange={setSortBy}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

      {/* Status Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="partial">Partial</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        data={filteredInvoices}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by invoice number, customer..."
        emptyMessage="No invoices found. Create your first invoice."
      />

      {/* Smart Invoice Creator Dialog */}
      <SmartInvoiceCreator
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onComplete={fetchData}
        customers={customers}
        products={products}
      />

      {/* Edit Invoice Dialog */}
      <EditInvoiceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onComplete={fetchData}
        invoice={editingInvoice}
        products={products}
      />

      {/* Payment Dialog */}
      <ResponsiveDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <ResponsiveDialogContent className="max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Record Payment</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Invoice: {selectedInvoice?.invoice_number}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Invoice Total:</span>
                  <span>₹{Number(selectedInvoice.final_amount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm text-success">
                  <span>Already Paid:</span>
                  <span>₹{Number(selectedInvoice.paid_amount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Balance Due:</span>
                  <span className="text-destructive">
                    ₹{(Number(selectedInvoice.final_amount) - Number(selectedInvoice.paid_amount)).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Amount (₹)</Label>
                <Input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                  max={Number(selectedInvoice.final_amount) - Number(selectedInvoice.paid_amount)}
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}>
              Record Payment
            </Button>
          </div>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Delete Invoice Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Invoice"
        description={`Are you sure you want to delete invoice ${deletingInvoice?.invoice_number}? This will also remove associated ledger entries and payment records. This action cannot be undone.`}
        confirmText={deleting ? "Deleting..." : "Delete Invoice"}
        onConfirm={handleDeleteInvoice}
        variant="destructive"
      />
    </div>
  );
}
