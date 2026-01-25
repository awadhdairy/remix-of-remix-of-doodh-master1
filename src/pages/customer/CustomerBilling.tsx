import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Receipt, CreditCard, AlertCircle, Download, Eye, Loader2, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToIndianWords } from '@/lib/numberToWords';

interface Invoice {
  id: string;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  paid_amount: number;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
  due_date: string | null;
  created_at: string;
  notes: string | null;
}

interface LedgerEntry {
  id: string;
  transaction_date: string;
  transaction_type: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
}

interface DeliveryItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  delivery_date: string;
  unit: string;
}

const statusStyles = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  partial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// Helper to load image as base64
const loadImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
};

export default function CustomerBilling() {
  const { customerId, customerData } = useCustomerAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    const fetchBillingData = async () => {
      if (!customerId) {
        setLoading(false);
        return;
      }

      try {
        const [invoiceRes, ledgerRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('*')
            .eq('customer_id', customerId)
            .order('billing_period_end', { ascending: false })
            .limit(24),
          supabase
            .from('customer_ledger')
            .select('*')
            .eq('customer_id', customerId)
            .order('transaction_date', { ascending: false })
            .limit(50)
        ]);

        if (invoiceRes.error) throw invoiceRes.error;
        if (ledgerRes.error) throw ledgerRes.error;

        setInvoices((invoiceRes.data || []).map((inv) => ({
          ...inv,
          payment_status: (inv.payment_status || 'pending') as Invoice['payment_status'],
        })));

        setLedger((ledgerRes.data || []).map((entry) => ({
          id: entry.id,
          transaction_date: entry.transaction_date,
          transaction_type: entry.transaction_type,
          description: entry.description,
          debit_amount: entry.debit_amount || 0,
          credit_amount: entry.credit_amount || 0,
          running_balance: entry.running_balance || 0,
        })));
      } catch (err) {
        console.error('Error fetching billing data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, [customerId]);

  // Fetch delivery items when viewing invoice detail
  const fetchDeliveryItems = async (invoice: Invoice) => {
    if (!customerId) return;
    setLoadingItems(true);
    
    try {
      const { data } = await supabase
        .from('deliveries')
        .select(`
          delivery_date,
          delivery_items (
            quantity,
            unit_price,
            total_amount,
            product:product_id (name, unit)
          )
        `)
        .eq('customer_id', customerId)
        .eq('status', 'delivered')
        .gte('delivery_date', invoice.billing_period_start)
        .lte('delivery_date', invoice.billing_period_end)
        .order('delivery_date', { ascending: true });

      if (data) {
        const items: DeliveryItem[] = [];
        data.forEach((delivery: any) => {
          if (delivery.delivery_items) {
            delivery.delivery_items.forEach((item: any) => {
              if (item.product) {
                items.push({
                  product_name: item.product.name,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  total_amount: item.total_amount,
                  delivery_date: delivery.delivery_date,
                  unit: item.product.unit || 'unit',
                });
              }
            });
          }
        });
        setDeliveryItems(items);
      }
    } catch (err) {
      console.error('Error fetching delivery items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const openInvoiceDetail = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailOpen(true);
    fetchDeliveryItems(invoice);
  };

  // Generate PDF for customer
  const generateCustomerPDF = async (invoice: Invoice, action: 'download' | 'preview' = 'download') => {
    setGeneratingPdf(invoice.id);
    
    try {
      // Fetch dairy settings and delivery items
      const [settingsRes, deliveriesRes] = await Promise.all([
        supabase.from('dairy_settings').select('*').limit(1).single(),
        supabase
          .from('deliveries')
          .select(`
            delivery_date,
            delivery_items (
              quantity,
              unit_price,
              total_amount,
              product:product_id (name, unit)
            )
          `)
          .eq('customer_id', customerId)
          .eq('status', 'delivered')
          .gte('delivery_date', invoice.billing_period_start)
          .lte('delivery_date', invoice.billing_period_end)
          .order('delivery_date', { ascending: true })
      ]);

      const settings = settingsRes.data || {
        dairy_name: 'Awadh Dairy',
        address: '',
        phone: '',
        email: '',
        currency: 'INR',
        invoice_prefix: 'INV',
        logo_url: null,
      };

      // Flatten delivery items
      const items: DeliveryItem[] = [];
      if (deliveriesRes.data) {
        deliveriesRes.data.forEach((delivery: any) => {
          if (delivery.delivery_items) {
            delivery.delivery_items.forEach((item: any) => {
              if (item.product) {
                items.push({
                  product_name: item.product.name,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  total_amount: item.total_amount,
                  delivery_date: delivery.delivery_date,
                  unit: item.product.unit || 'unit',
                });
              }
            });
          }
        });
      }

      // Aggregate by product
      const aggregated = items.reduce((acc, item) => {
        const key = `${item.product_name}_${item.unit_price}`;
        if (!acc[key]) {
          acc[key] = { ...item, quantity: 0, total_amount: 0 };
        }
        acc[key].quantity += item.quantity;
        acc[key].total_amount += item.total_amount;
        return acc;
      }, {} as Record<string, DeliveryItem>);

      const tableItems = Object.values(aggregated);

      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Try to add logo
      try {
        const logoBase64 = await loadImageAsBase64("/images/awadh-dairy-logo.png");
        doc.addImage(logoBase64, "PNG", 14, 10, 30, 30, undefined, "FAST");
      } catch {}

      // Header
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(settings.dairy_name, pageWidth / 2, 20, { align: "center" });

      if (settings.address) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(settings.address, pageWidth / 2, 28, { align: "center" });
      }

      // Invoice title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("TAX INVOICE", pageWidth / 2, 45, { align: "center" });

      // Invoice details
      let yPos = 55;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      doc.text(`Invoice No: ${invoice.invoice_number}`, 14, yPos);
      doc.text(`Date: ${format(new Date(invoice.created_at), 'dd/MM/yyyy')}`, pageWidth - 14, yPos, { align: "right" });
      
      yPos += 8;
      doc.text(`Period: ${format(new Date(invoice.billing_period_start), 'dd MMM')} - ${format(new Date(invoice.billing_period_end), 'dd MMM yyyy')}`, 14, yPos);
      
      if (invoice.due_date) {
        doc.text(`Due Date: ${format(new Date(invoice.due_date), 'dd/MM/yyyy')}`, pageWidth - 14, yPos, { align: "right" });
      }

      yPos += 10;
      doc.text(`Bill To: ${customerData?.name || 'Customer'}`, 14, yPos);
      if (customerData?.address) {
        yPos += 5;
        doc.setFontSize(9);
        doc.text(customerData.address, 14, yPos);
      }

      yPos += 12;

      // Items table
      if (tableItems.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [["#", "Product", "Qty", "Unit", "Rate", "Amount"]],
          body: tableItems.map((item, idx) => [
            idx + 1,
            item.product_name,
            item.quantity.toString(),
            item.unit,
            `Rs. ${item.unit_price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
            `Rs. ${item.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
          ]),
          theme: "striped",
          headStyles: { fillColor: [33, 150, 243], textColor: 255, fontStyle: "bold" },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            2: { halign: "center" },
            4: { halign: "right" },
            5: { halign: "right" },
          },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Totals
      const totalsX = pageWidth - 70;
      doc.setFontSize(10);
      doc.text("Subtotal:", totalsX, yPos);
      doc.text(`Rs. ${invoice.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, pageWidth - 14, yPos, { align: "right" });

      if (invoice.tax_amount > 0) {
        yPos += 6;
        doc.text("Tax:", totalsX, yPos);
        doc.text(`Rs. ${invoice.tax_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, pageWidth - 14, yPos, { align: "right" });
      }

      if (invoice.discount_amount > 0) {
        yPos += 6;
        doc.text("Discount:", totalsX, yPos);
        doc.text(`-Rs. ${invoice.discount_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, pageWidth - 14, yPos, { align: "right" });
      }

      yPos += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("GRAND TOTAL:", totalsX - 10, yPos);
      doc.text(`Rs. ${invoice.final_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, pageWidth - 14, yPos, { align: "right" });

      // Amount in words
      yPos += 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text(`Amount in Words: ${numberToIndianWords(invoice.final_amount)} Only`, 14, yPos);

      // Payment status
      yPos += 15;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      
      if (invoice.paid_amount > 0) {
        doc.text(`Paid: Rs. ${invoice.paid_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 14, yPos);
        const balance = invoice.final_amount - invoice.paid_amount;
        if (balance > 0) {
          yPos += 6;
          doc.setTextColor(255, 0, 0);
          doc.text(`Balance Due: Rs. ${balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 14, yPos);
          doc.setTextColor(0, 0, 0);
        }
      }

      // Footer
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("Thank you for your business!", pageWidth / 2, doc.internal.pageSize.getHeight() - 15, { align: "center" });

      // Save or preview
      const customerName = customerData?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Customer';
      const fileName = `Invoice_${invoice.invoice_number}_${customerName}.pdf`;

      if (action === 'download') {
        doc.save(fileName);
      } else {
        const dataUrl = doc.output('dataurlstring');
        window.open(dataUrl, '_blank');
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGeneratingPdf(null);
    }
  };

  // Calculate balances
  const creditBalance = customerData?.credit_balance || 0;
  const advanceBalance = customerData?.advance_balance || 0;
  const outstandingBalance = creditBalance - advanceBalance;
  const unpaidInvoices = invoices.filter(i => i.payment_status !== 'paid');

  // Group delivery items by date for detail view
  const groupedItems = deliveryItems.reduce((acc, item) => {
    const date = item.delivery_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, DeliveryItem[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Billing & Payments</h1>
        <p className="text-muted-foreground">View and download your invoices</p>
      </div>

      {/* Balance Summary */}
      <Card className={outstandingBalance > 0 ? "border-destructive" : "border-green-500"}>
        <CardHeader className="pb-2">
          <CardDescription>Current Balance</CardDescription>
          <CardTitle className={`text-3xl ${outstandingBalance > 0 ? 'text-destructive' : 'text-green-600'}`}>
            Rs. {Math.abs(outstandingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            {outstandingBalance < 0 && <span className="text-sm font-normal ml-2">(Credit Balance)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-muted-foreground">Total Due</p>
              <p className="font-semibold text-destructive">Rs. {creditBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Advance Paid</p>
              <p className="font-semibold text-green-600">Rs. {advanceBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          {unpaidInvoices.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800 dark:text-amber-300">
                {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="invoices">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="ledger">Transaction History</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4 space-y-3">
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No invoices yet</p>
                <p className="text-muted-foreground">Your invoices will appear here</p>
              </CardContent>
            </Card>
          ) : (
            invoices.map(invoice => (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => openInvoiceDetail(invoice)}
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-semibold font-mono">{invoice.invoice_number}</p>
                        <Badge className={statusStyles[invoice.payment_status]}>
                          {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(invoice.billing_period_start), 'dd MMM')} - {format(new Date(invoice.billing_period_end), 'dd MMM yyyy')}
                      </p>
                    </div>
                    <div className="text-right mr-4">
                      <p className="font-bold text-lg">Rs. {invoice.final_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      {invoice.paid_amount > 0 && invoice.payment_status !== 'paid' && (
                        <p className="text-xs text-muted-foreground">
                          Paid: Rs. {invoice.paid_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInvoiceDetail(invoice);
                        }}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateCustomerPDF(invoice, 'download');
                        }}
                        disabled={generatingPdf === invoice.id}
                        title="Download PDF"
                      >
                        {generatingPdf === invoice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {invoice.due_date && invoice.payment_status !== 'paid' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Due: {format(new Date(invoice.due_date), 'dd MMM yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="ledger" className="mt-4 space-y-3">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          ) : ledger.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No transactions yet</p>
                <p className="text-muted-foreground">Your transaction history will appear here</p>
              </CardContent>
            </Card>
          ) : (
            ledger.map(entry => (
              <Card key={entry.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.transaction_date), 'dd MMM yyyy')} • {entry.transaction_type}
                      </p>
                    </div>
                    <div className="text-right">
                      {entry.debit_amount > 0 && (
                        <p className="text-destructive font-semibold">+Rs. {entry.debit_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      )}
                      {entry.credit_amount > 0 && (
                        <p className="text-green-600 font-semibold">-Rs. {entry.credit_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Invoice Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Invoice Summary */}
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Period</span>
                    <span className="font-medium">
                      {format(new Date(selectedInvoice.billing_period_start), 'dd MMM')} - {format(new Date(selectedInvoice.billing_period_end), 'dd MMM yyyy')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={statusStyles[selectedInvoice.payment_status]}>
                      {selectedInvoice.payment_status.charAt(0).toUpperCase() + selectedInvoice.payment_status.slice(1)}
                    </Badge>
                  </div>
                  {selectedInvoice.due_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Due Date</span>
                      <span>{format(new Date(selectedInvoice.due_date), 'dd MMM yyyy')}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Delivery Items */}
                <div>
                  <h4 className="font-semibold mb-3">Delivery Details</h4>
                  {loadingItems ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : Object.keys(groupedItems).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No delivery items found</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(groupedItems).map(([date, items]) => (
                        <div key={date} className="border rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            {format(new Date(date), 'EEEE, dd MMM yyyy')}
                          </p>
                          {items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm py-1">
                              <span>{item.product_name} × {item.quantity}</span>
                              <span className="font-medium">Rs. {item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>Rs. {selectedInvoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {selectedInvoice.tax_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>Rs. {selectedInvoice.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {selectedInvoice.discount_amount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-Rs. {selectedInvoice.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Grand Total</span>
                    <span>Rs. {selectedInvoice.final_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {selectedInvoice.paid_amount > 0 && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span>Paid</span>
                        <span>Rs. {selectedInvoice.paid_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {selectedInvoice.payment_status !== 'paid' && (
                        <div className="flex justify-between text-destructive font-semibold">
                          <span>Balance Due</span>
                          <span>Rs. {(selectedInvoice.final_amount - selectedInvoice.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Download Button */}
                <Button 
                  className="w-full mt-4" 
                  onClick={() => generateCustomerPDF(selectedInvoice, 'download')}
                  disabled={generatingPdf === selectedInvoice.id}
                >
                  {generatingPdf === selectedInvoice.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download Invoice PDF
                </Button>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
