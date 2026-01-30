import { useQuery } from "@tanstack/react-query";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Zap, 
  Beef, 
  Package, 
  Wrench, 
  HeartPulse, 
  Wallet,
  TrendingUp,
  ArrowRight
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";

interface AutoExpenseCategory {
  category: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  total: number;
  count: number;
}

async function fetchAutoExpenseStats() {
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("expenses")
    .select("category, amount, notes")
    .like("notes", "[AUTO]%")
    .gte("expense_date", monthStart)
    .lte("expense_date", monthEnd);

  if (error) throw error;

  const expenses = data || [];

  // Categorize auto expenses
  const salaryExpenses = expenses.filter(e => e.notes?.includes("payroll:"));
  const feedExpenses = expenses.filter(e => 
    e.notes?.includes("feed_purchase:") || 
    e.notes?.includes("feed_") || 
    e.notes?.includes("vendor_payment:") ||
    e.notes?.includes("milk_procurement:")
  );
  const equipmentExpenses = expenses.filter(e => e.notes?.includes("equipment:"));
  const maintenanceExpenses = expenses.filter(e => e.notes?.includes("maintenance:"));
  const healthExpenses = expenses.filter(e => e.notes?.includes("health:"));

  const categories: AutoExpenseCategory[] = [
    {
      category: "salary",
      label: "Salary",
      icon: Wallet,
      color: "text-primary",
      bgColor: "bg-primary/10",
      total: salaryExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      count: salaryExpenses.length,
    },
    {
      category: "feed",
      label: "Feed & Procurement",
      icon: Package,
      color: "text-success",
      bgColor: "bg-success/10",
      total: feedExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      count: feedExpenses.length,
    },
    {
      category: "equipment",
      label: "Equipment",
      icon: Beef,
      color: "text-info",
      bgColor: "bg-info/10",
      total: equipmentExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      count: equipmentExpenses.length,
    },
    {
      category: "maintenance",
      label: "Maintenance",
      icon: Wrench,
      color: "text-warning",
      bgColor: "bg-warning/10",
      total: maintenanceExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      count: maintenanceExpenses.length,
    },
    {
      category: "health",
      label: "Health & Medicine",
      icon: HeartPulse,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      total: healthExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      count: healthExpenses.length,
    },
  ];

  const grandTotal = categories.reduce((sum, c) => sum + c.total, 0);
  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);

  return { categories, grandTotal, totalCount };
}

export function ExpenseAutomationCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["auto-expense-stats"],
    queryFn: fetchAutoExpenseStats,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { categories, grandTotal, totalCount } = data || { categories: [], grandTotal: 0, totalCount: 0 };

  // Filter to show only categories with expenses
  const activeCategories = categories.filter(c => c.count > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-info/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-info/10">
                <Zap className="h-5 w-5 text-info" />
              </div>
              <div>
                <CardTitle className="text-base">Auto-Tracked Expenses</CardTitle>
                <p className="text-xs text-muted-foreground">This month's automated entries</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-info/10 text-info border-info/20">
              <TrendingUp className="h-3 w-3 mr-1" />
              {totalCount} entries
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Grand Total */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm font-medium">Total Auto-Tracked</span>
            <span className="text-xl font-bold text-destructive">
              ₹{grandTotal.toLocaleString()}
            </span>
          </div>

          {/* Category Breakdown */}
          {activeCategories.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {activeCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <motion.div
                    key={cat.category}
                    className={`p-3 rounded-lg ${cat.bgColor} border border-border/30`}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-4 w-4 ${cat.color}`} />
                      <span className="text-xs font-medium text-muted-foreground">
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-lg font-bold ${cat.color}`}>
                        ₹{cat.total.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {cat.count} {cat.count === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No auto-tracked expenses this month
            </div>
          )}

          {/* View All Button */}
          <Button 
            variant="ghost" 
            className="w-full justify-between text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/expenses")}
          >
            View All Expenses
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
