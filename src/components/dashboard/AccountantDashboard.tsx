import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { getCustomerName } from "@/lib/supabase-helpers";
import { StatCard } from "./StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  IndianRupee, 
  Receipt, 
  Wallet,
  TrendingUp,
  TrendingDown,
  Loader2,
  FileText,
  AlertCircle,
  AlertTriangle
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Link } from "react-router-dom";
import { getInvoiceBalance, countOverdueInvoices, calculateOverdueBalance } from "@/lib/invoice-helpers";

interface AccountingStats {
  monthlyRevenue: number;
  monthlyExpenses: number;
  pendingPayments: number;
  overdueInvoices: number;
  totalPaid: number;
  netProfit: number;
  vendorPayables: number; // NEW: Amounts owed to milk vendors
}

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  final_amount: number;
  due_date: string;
}

export function AccountantDashboard() {
  const [stats, setStats] = useState<AccountingStats | null>(null);
  const [overdueInvoices, setOverdueInvoices] = useState<OverdueInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccountingData();
  }, []);

  const fetchAccountingData = async () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    const [invoicesRes, expensesRes, paymentsRes, overdueRes, vendorBalanceRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("final_amount, paid_amount, payment_status")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd),
      supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd),
      supabase
        .from("payments")
        .select("amount")
        .gte("payment_date", monthStart)
        .lte("payment_date", monthEnd),
      supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          final_amount,
          paid_amount,
          due_date,
          customers (name)
        `)
        .neq("payment_status", "paid")
        .lt("due_date", todayStr)
        .order("due_date")
        .limit(5),
      // FIX: Fetch vendor payables (amounts owed to milk vendors)
      supabase
        .from("milk_vendors")
        .select("current_balance")
        .eq("is_active", true),
    ]);

    const invoices = invoicesRes.data || [];
    const expenses = expensesRes.data || [];
    const payments = paymentsRes.data || [];
    const overdue = overdueRes.data || [];
    const vendorBalances = vendorBalanceRes.data || [];

    const monthlyRevenue = invoices.reduce((sum, i) => sum + Number(i.final_amount), 0);
    const monthlyExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingPayments = invoices
      .filter(i => i.payment_status !== "paid")
      .reduce((sum, i) => sum + (Number(i.final_amount) - Number(i.paid_amount || 0)), 0);

    // FIX: Calculate vendor payables (amounts owed to milk vendors)
    const vendorPayables = vendorBalances
      .reduce((sum, v) => sum + Math.max(0, Number(v.current_balance || 0)), 0);

    // Count overdue as invoices past due date that aren't fully paid
    const overdueCount = overdue.length;

    setStats({
      monthlyRevenue,
      monthlyExpenses,
      pendingPayments,
      overdueInvoices: overdueCount,
      totalPaid,
      netProfit: monthlyRevenue - monthlyExpenses,
      vendorPayables, // NEW: Track vendor payables
    });

    setOverdueInvoices(
      overdue.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: getCustomerName(inv.customers),
        final_amount: Number(inv.final_amount) - Number(inv.paid_amount || 0), // Show remaining balance
        due_date: inv.due_date || "",
      }))
    );

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/billing">
                <Receipt className="mr-2 h-4 w-4" />
                Manage Invoices
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/expenses">
                <Wallet className="mr-2 h-4 w-4" />
                Record Expense
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/reports">
                <FileText className="mr-2 h-4 w-4" />
                View Reports
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Monthly Revenue"
          value={`₹${(stats?.monthlyRevenue || 0).toLocaleString()}`}
          subtitle="Total invoiced this month"
          icon={TrendingUp}
          variant="success"
          delay={0}
        />
        <StatCard
          title="Monthly Expenses"
          value={`₹${(stats?.monthlyExpenses || 0).toLocaleString()}`}
          subtitle="Total spent this month"
          icon={TrendingDown}
          variant="warning"
          delay={100}
        />
        <StatCard
          title="Pending Payments"
          value={`₹${(stats?.pendingPayments || 0).toLocaleString()}`}
          subtitle={`${stats?.overdueInvoices || 0} overdue invoices`}
          icon={IndianRupee}
          variant={stats?.overdueInvoices ? "warning" : "info"}
          delay={200}
        />
        <StatCard
          title="Vendor Payables"
          value={`₹${(stats?.vendorPayables || 0).toLocaleString()}`}
          subtitle="Due to milk vendors"
          icon={TrendingDown}
          variant={(stats?.vendorPayables || 0) > 0 ? "warning" : "info"}
          delay={300}
        />
      </div>
      
      {/* Net Profit Card - Full Width */}
      <Card className="bg-gradient-to-r from-primary/10 to-success/10 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Profit (This Month)</p>
              <p className={`text-2xl font-bold ${(stats?.netProfit || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
                ₹{(stats?.netProfit || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
            </div>
            <Receipt className="h-8 w-8 text-primary/50" />
          </div>
        </CardContent>
      </Card>

      {/* Overdue Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Overdue Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdueInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No overdue invoices! 🎉
            </p>
          ) : (
            <div className="space-y-3">
              {overdueInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 p-3"
                >
                  <div>
                    <p className="font-medium">{invoice.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      #{invoice.invoice_number} • Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="destructive">
                    ₹{invoice.final_amount.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
