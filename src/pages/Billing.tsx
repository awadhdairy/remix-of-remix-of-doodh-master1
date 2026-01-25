import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Receipt, IndianRupee, Loader2, Edit3 } from "lucide-react";
import { format } from "date-fns";
import { InvoicePDFGenerator } from "@/components/billing/InvoicePDFGenerator";
import { EditInvoiceDialog } from "@/components/billing/EditInvoiceDialog";
import { SmartInvoiceCreator } from "@/components/billing/SmartInvoiceCreator";

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
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      const [customerRes, invoiceRes, productRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("invoices")
          .select(`
            *,
            customer:customer_id (id, name)
          `)
          .order("created_at", { ascending: false }),
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
    const newPaidAmount = Number(selectedInvoice.paid_amount) + amount;
    const remaining = Number(selectedInvoice.final_amount) - newPaidAmount;
    
    let newStatus: "paid" | "partial" | "pending" = "partial";
    if (remaining <= 0) newStatus = "paid";
    else if (newPaidAmount === 0) newStatus = "pending";

    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({ 
        paid_amount: newPaidAmount,
        payment_status: newStatus,
        payment_date: newStatus === "paid" ? format(new Date(), "yyyy-MM-dd") : null
      })
      .eq("id", selectedInvoice.id);

    const { error: paymentError } = await supabase.from("payments").insert({
      invoice_id: selectedInvoice.id,
      customer_id: selectedInvoice.customer_id,
      amount: amount,
      payment_mode: "cash",
      payment_date: format(new Date(), "yyyy-MM-dd"),
    });

    // Add ledger entry for payment
    await supabase.from("customer_ledger").insert({
      customer_id: selectedInvoice.customer_id,
      transaction_date: format(new Date(), "yyyy-MM-dd"),
      transaction_type: "payment",
      description: `Payment for ${selectedInvoice.invoice_number}`,
      debit_amount: 0,
      credit_amount: amount,
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
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setSelectedInvoice(null);
      fetchData();
    }
  };

  const filteredInvoices = statusFilter === "all" 
    ? invoices 
    : invoices.filter(i => i.payment_status === statusFilter);

  const stats = {
    total: invoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
    collected: invoices.reduce((sum, i) => sum + Number(i.paid_amount), 0),
    pending: invoices.filter(i => i.payment_status === "pending").reduce((sum, i) => sum + Number(i.final_amount), 0),
    overdue: invoices.filter(i => i.payment_status === "overdue").reduce((sum, i) => sum + (Number(i.final_amount) - Number(i.paid_amount)), 0),
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
      render: (item: InvoiceWithCustomer) => <StatusBadge status={item.payment_status} />,
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
              setPaymentDialogOpen(true);
            }}
            disabled={item.payment_status === "paid"}
          >
            <IndianRupee className="h-3 w-3" /> Pay
          </Button>
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
            <p className="text-sm text-muted-foreground">Collected</p>
          </CardContent>
        </Card>
        <Card className="border-warning/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">₹{stats.pending.toLocaleString("en-IN")}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">₹{stats.overdue.toLocaleString("en-IN")}</div>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
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
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Invoice: {selectedInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>

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
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}>
              Record Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
