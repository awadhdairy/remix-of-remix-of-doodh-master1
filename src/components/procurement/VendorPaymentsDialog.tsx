import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useExpenseAutomation } from "@/hooks/useExpenseAutomation";
import { format } from "date-fns";
import {
  IndianRupee,
  Plus,
  Wallet,
  History,
  Loader2,
  CreditCard,
  Banknote,
  Building2,
} from "lucide-react";

interface VendorPayment {
  id: string;
  vendor_id: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

interface VendorPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: {
    id: string;
    name: string;
    current_balance?: number;
  } | null;
  onPaymentSuccess: () => void;
}

interface PaymentFormData {
  payment_date: string;
  amount: string;
  payment_mode: string;
  reference_number: string;
  notes: string;
}

const emptyPaymentForm: PaymentFormData = {
  payment_date: format(new Date(), "yyyy-MM-dd"),
  amount: "",
  payment_mode: "cash",
  reference_number: "",
  notes: "",
};

const paymentModes = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
  { value: "upi", label: "UPI", icon: CreditCard },
  { value: "cheque", label: "Cheque", icon: CreditCard },
];

export function VendorPaymentsDialog({
  open,
  onOpenChange,
  vendor,
  onPaymentSuccess,
}: VendorPaymentsDialogProps) {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormData>(emptyPaymentForm);
  const [vendorBalance, setVendorBalance] = useState<number>(0);
  const { toast } = useToast();
  const { logVendorPaymentExpense } = useExpenseAutomation();

  useEffect(() => {
    if (open && vendor) {
      fetchPayments();
      fetchVendorBalance();
    }
  }, [open, vendor]);

  const fetchVendorBalance = async () => {
    if (!vendor) return;
    
    const { data, error } = await supabase
      .from("milk_vendors")
      .select("current_balance")
      .eq("id", vendor.id)
      .single();

    if (!error && data) {
      setVendorBalance(Number(data.current_balance) || 0);
    }
  };

  const fetchPayments = async () => {
    if (!vendor) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("vendor_payments")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("payment_date", { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: "Error fetching payments",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPayments(data || []);
    }
    setLoading(false);
  };

  const handleSavePayment = async () => {
    if (!vendor || !paymentForm.amount) {
      toast({
        title: "Validation Error",
        description: "Amount is required",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("vendor_payments")
      .insert({
        vendor_id: vendor.id,
        payment_date: paymentForm.payment_date,
        amount,
        payment_mode: paymentForm.payment_mode,
        reference_number: paymentForm.reference_number || null,
        notes: paymentForm.notes || null,
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Auto-log expense for vendor payment
      if (data) {
        const modeLabel = paymentModes.find(m => m.value === paymentForm.payment_mode)?.label || paymentForm.payment_mode;
        await logVendorPaymentExpense(
          vendor.name,
          amount,
          paymentForm.payment_date,
          data.id,
          modeLabel,
          paymentForm.reference_number || undefined
        );
      }
      
      toast({
        title: "Payment recorded & expense logged",
        description: `₹${amount.toLocaleString()} paid to ${vendor.name} - auto-tracked in expenses`,
      });
      setPaymentForm(emptyPaymentForm);
      setShowAddForm(false);
      fetchPayments();
      fetchVendorBalance();
      onPaymentSuccess();
    }
    setSaving(false);
  };

  const getPaymentModeIcon = (mode: string) => {
    const found = paymentModes.find((m) => m.value === mode);
    return found ? found.icon : Banknote;
  };

  const getPaymentModeLabel = (mode: string) => {
    const found = paymentModes.find((m) => m.value === mode);
    return found ? found.label : mode;
  };

  if (!vendor) return null;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payments - {vendor.name}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Manage payments and view payment history for this vendor
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {/* Balance Card */}
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className={`text-2xl font-bold ${vendorBalance > 0 ? "text-destructive" : "text-green-600"}`}>
                  ₹{Math.abs(vendorBalance).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {vendorBalance > 0 ? "Amount owed to vendor" : vendorBalance < 0 ? "Advance paid" : "All settled"}
                </p>
              </div>
              <Button onClick={() => setShowAddForm(!showAddForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Payment Form */}
        {showAddForm && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">New Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_date">Payment Date</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, payment_date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={paymentForm.amount}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, amount: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_mode">Payment Mode</Label>
                  <Select
                    value={paymentForm.payment_mode}
                    onValueChange={(value) =>
                      setPaymentForm({ ...paymentForm, payment_mode: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentModes.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          <div className="flex items-center gap-2">
                            <mode.icon className="h-4 w-4" />
                            {mode.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference_number">Reference Number</Label>
                  <Input
                    id="reference_number"
                    placeholder="Transaction/Cheque #"
                    value={paymentForm.reference_number}
                    onChange={(e) =>
                      setPaymentForm({ ...paymentForm, reference_number: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Optional notes"
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                  }
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSavePayment} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <IndianRupee className="h-4 w-4 mr-2" />
                      Save Payment
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment History */}
        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            Payment History
          </h4>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments recorded yet
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => {
                const PaymentIcon = getPaymentModeIcon(payment.payment_mode);
                return (
                  <Card key={payment.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                          <PaymentIcon className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            ₹{payment.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.payment_date), "dd MMM yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-xs">
                          {getPaymentModeLabel(payment.payment_mode)}
                        </Badge>
                        {payment.reference_number && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ref: {payment.reference_number}
                          </p>
                        )}
                      </div>
                    </div>
                    {payment.notes && (
                      <p className="text-xs text-muted-foreground mt-2 pl-11">
                        {payment.notes}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
