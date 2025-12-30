import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Download, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter
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
    }
  }, [open, customerId, startDate, endDate]);

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

  const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit_amount), 0);
  const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit_amount), 0);
  const netBalance = totalDebit - totalCredit;

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

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-destructive">
                ₹{totalDebit.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Total Debit</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-success">
                ₹{totalCredit.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Total Credit</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${netBalance > 0 ? "text-destructive" : "text-success"}`}>
                ₹{Math.abs(netBalance).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                {netBalance > 0 ? "Amount Due" : "Amount Excess"}
              </p>
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
