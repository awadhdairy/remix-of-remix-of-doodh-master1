import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { 
  BookOpen, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Wallet
} from "lucide-react";
import { ExportButton } from "@/components/common/ExportButton";

interface LedgerEntry {
  id: string;
  customer_id: string;
  transaction_date: string;
  transaction_type: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  created_at: string;
}

interface CustomerLedgerProps {
  customerId: string;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerLedger({
  customerId,
  customerName,
  open,
  onOpenChange,
}: CustomerLedgerProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  // Issue 4 fix: track the customer's lifetime ledger balance separately from period filter
  const [lifetimeBalance, setLifetimeBalance] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const { toast } = useToast();

  useEffect(() => {
    if (open && customerId) {
      fetchLedger();
      fetchLifetimeBalance();
    }
  }, [open, customerId]);

  // Re-fetch filtered entries when dates change
  useEffect(() => {
    if (open && customerId) {
      fetchLedger();
    }
  }, [startDate, endDate]);

  const fetchLedger = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_ledger")
      .select("*")
      .eq("customer_id", customerId)
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .order("transaction_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Error fetching ledger",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEntries(data || []);
    }
    setLoading(false);
  };

  // Fetch the customer's true lifetime balance from customers.credit_balance
  // which is kept accurate by the update_customer_balance_from_ledger DB trigger.
  const fetchLifetimeBalance = async () => {
    const { data } = await supabase
      .from("customers")
      .select("credit_balance")
      .eq("id", customerId)
      .single();
    if (data) {
      setLifetimeBalance(Number(data.credit_balance || 0));
    }
  };

  const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit_amount), 0);
  const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit_amount), 0);
  const periodNet = totalDebit - totalCredit;

  const getTypeIcon = (type: string) => {
    if (type === "payment") {
      return <ArrowDownRight className="h-4 w-4 text-success" />;
    }
    return <ArrowUpRight className="h-4 w-4 text-destructive" />;
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      delivery: "default",
      payment: "secondary",
      invoice: "outline",
      adjustment: "destructive",
    };
    return (
      <Badge variant={variants[type] || "outline"} className="capitalize">
        {type}
      </Badge>
    );
  };

  const exportColumns = [
    { key: "transaction_date", header: "Date" },
    { key: "transaction_type", header: "Type" },
    { key: "description", header: "Description" },
    { key: "debit_amount", header: "Debit (₹)" },
    { key: "credit_amount", header: "Credit (₹)" },
    { key: "running_balance", header: "Balance (₹)" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Customer Ledger - {customerName}
          </DialogTitle>
        </DialogHeader>

        {/* Lifetime Balance Banner — always shows actual outstanding regardless of filter */}
        {lifetimeBalance !== null && (
          <Card className={lifetimeBalance > 0 ? "border-destructive/40 bg-destructive/5" : "border-success/40 bg-success/5"}>
            <CardContent className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className={`h-5 w-5 ${lifetimeBalance > 0 ? "text-destructive" : "text-success"}`} />
                <div>
                  <p className="text-sm font-medium">Current Outstanding Balance</p>
                  <p className="text-xs text-muted-foreground">Lifetime ledger balance — regardless of date filter</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xl font-bold ${lifetimeBalance > 0 ? "text-destructive" : "text-success"}`}>
                  ₹{Math.abs(lifetimeBalance).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lifetimeBalance > 0 ? "Amount Due" : lifetimeBalance < 0 ? "Credit Balance" : "Settled"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date Filter */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={fetchLedger}>
                <Filter className="mr-2 h-4 w-4" />
                Apply Filter
              </Button>
              <ExportButton
                data={entries}
                columns={exportColumns}
                filename={`ledger-${customerName}`}
                title={`Customer Ledger - ${customerName}`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Period Summary Cards — clearly labelled as period-filtered */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">
                ₹{totalDebit.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Period Debit</p>
              <p className="text-xs text-muted-foreground">Charges in selected range</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-success">
                ₹{totalCredit.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Period Credit</p>
              <p className="text-xs text-muted-foreground">Payments in selected range</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${periodNet > 0 ? "text-destructive" : "text-success"}`}>
                ₹{Math.abs(periodNet).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                {periodNet > 0 ? "Period Net Charge" : "Period Net Credit"}
              </p>
              <p className="text-xs text-muted-foreground">For selected range only</p>
            </CardContent>
          </Card>
        </div>

        {/* Ledger Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No transactions found for the selected period
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="min-w-[200px]">Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(parseISO(entry.transaction_date), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTypeIcon(entry.transaction_type)}
                            {getTypeBadge(entry.transaction_type)}
                          </div>
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">
                          {Number(entry.debit_amount) > 0
                            ? `₹${Number(entry.debit_amount).toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-success">
                          {Number(entry.credit_amount) > 0
                            ? `₹${Number(entry.credit_amount).toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{Number(entry.running_balance).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
