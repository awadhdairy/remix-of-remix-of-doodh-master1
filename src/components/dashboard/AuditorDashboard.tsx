import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "./StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Receipt, 
  Wallet,
  FileText,
  Loader2,
  Eye
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Link } from "react-router-dom";

interface AuditStats {
  totalInvoices: number;
  totalExpenses: number;
  totalPayments: number;
  invoiceValue: number;
  expenseValue: number;
  paymentValue: number;
}

export function AuditorDashboard() {
  const [currentMonth, setCurrentMonth] = useState<AuditStats | null>(null);
  const [lastMonth, setLastMonth] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditData();
  }, []);

  const fetchAuditData = async () => {
    const currentMonthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const currentMonthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");
    const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");
    const lastMonthEnd = format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd");

    const [
      currentInvoicesRes,
      currentExpensesRes,
      currentPaymentsRes,
      lastInvoicesRes,
      lastExpensesRes,
      lastPaymentsRes,
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, final_amount")
        .gte("created_at", currentMonthStart)
        .lte("created_at", currentMonthEnd),
      supabase
        .from("expenses")
        .select("id, amount")
        .gte("expense_date", currentMonthStart)
        .lte("expense_date", currentMonthEnd),
      supabase
        .from("payments")
        .select("id, amount")
        .gte("payment_date", currentMonthStart)
        .lte("payment_date", currentMonthEnd),
      supabase
        .from("invoices")
        .select("id, final_amount")
        .gte("created_at", lastMonthStart)
        .lte("created_at", lastMonthEnd),
      supabase
        .from("expenses")
        .select("id, amount")
        .gte("expense_date", lastMonthStart)
        .lte("expense_date", lastMonthEnd),
      supabase
        .from("payments")
        .select("id, amount")
        .gte("payment_date", lastMonthStart)
        .lte("payment_date", lastMonthEnd),
    ]);

    const currentInvoices = currentInvoicesRes.data || [];
    const currentExpenses = currentExpensesRes.data || [];
    const currentPayments = currentPaymentsRes.data || [];
    const lastInvoices = lastInvoicesRes.data || [];
    const lastExpenses = lastExpensesRes.data || [];
    const lastPayments = lastPaymentsRes.data || [];

    setCurrentMonth({
      totalInvoices: currentInvoices.length,
      totalExpenses: currentExpenses.length,
      totalPayments: currentPayments.length,
      invoiceValue: currentInvoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
      expenseValue: currentExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      paymentValue: currentPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    });

    setLastMonth({
      totalInvoices: lastInvoices.length,
      totalExpenses: lastExpenses.length,
      totalPayments: lastPayments.length,
      invoiceValue: lastInvoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
      expenseValue: lastExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      paymentValue: lastPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    });

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
              <Link to="/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                View Reports
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/billing">
                <Eye className="mr-2 h-4 w-4" />
                Review Invoices
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/expenses">
                <Eye className="mr-2 h-4 w-4" />
                Review Expenses
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Month Stats */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Current Month Overview</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Invoices"
            value={String(currentMonth?.totalInvoices || 0)}
            subtitle={`₹${(currentMonth?.invoiceValue || 0).toLocaleString()}`}
            icon={Receipt}
            variant="info"
            delay={0}
          />
          <StatCard
            title="Expenses"
            value={String(currentMonth?.totalExpenses || 0)}
            subtitle={`₹${(currentMonth?.expenseValue || 0).toLocaleString()}`}
            icon={Wallet}
            variant="warning"
            delay={100}
          />
          <StatCard
            title="Payments"
            value={String(currentMonth?.totalPayments || 0)}
            subtitle={`₹${(currentMonth?.paymentValue || 0).toLocaleString()}`}
            icon={FileText}
            variant="success"
            delay={200}
          />
        </div>
      </div>

      {/* Comparison Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Month-over-Month Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="font-medium text-muted-foreground">Metric</div>
              <div className="font-medium text-muted-foreground">Last Month</div>
              <div className="font-medium text-muted-foreground">This Month</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
              <div className="font-medium">Invoice Value</div>
              <div>₹{(lastMonth?.invoiceValue || 0).toLocaleString()}</div>
              <div className="font-semibold text-primary">
                ₹{(currentMonth?.invoiceValue || 0).toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
              <div className="font-medium">Expense Value</div>
              <div>₹{(lastMonth?.expenseValue || 0).toLocaleString()}</div>
              <div className="font-semibold text-primary">
                ₹{(currentMonth?.expenseValue || 0).toLocaleString()}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center border-t pt-4">
              <div className="font-medium">Payment Value</div>
              <div>₹{(lastMonth?.paymentValue || 0).toLocaleString()}</div>
              <div className="font-semibold text-primary">
                ₹{(currentMonth?.paymentValue || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
