import { useQuery } from "@tanstack/react-query";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { format, subMonths, startOfMonth, endOfMonth, subDays } from "date-fns";

// Types
export interface MonthlyRevenue {
  month: string;
  billed: number;
  collected: number;
  pending: number;
}

export interface ExpenseCategory {
  category: string;
  amount: number;
  color: string;
}

export interface CattleStatus {
  status: string;
  count: number;
  color: string;
}

export interface DeliveryStats {
  delivered: number;
  pending: number;
  cancelled: number;
  total: number;
  rate: number;
}

export interface MonthComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
}

export interface CustomerTrend {
  month: string;
  total: number;
  active: number;
}

export interface DailyComparison {
  day: string;
  production: number;
  procurement: number;
}

// Color mappings
const EXPENSE_COLORS: Record<string, string> = {
  feed: "hsl(152 45% 28%)",
  veterinary: "hsl(275 85% 58%)",
  equipment: "hsl(220 95% 58%)",
  salary: "hsl(28 98% 55%)",
  utilities: "hsl(192 88% 52%)",
  maintenance: "hsl(42 95% 52%)",
  transport: "hsl(335 85% 58%)",
  other: "hsl(220 12% 52%)",
};

const CATTLE_COLORS: Record<string, string> = {
  lactating: "hsl(152 45% 28%)",
  dry: "hsl(42 95% 52%)",
  pregnant: "hsl(275 85% 58%)",
  heifer: "hsl(192 88% 52%)",
  calf: "hsl(28 98% 55%)",
  bull: "hsl(220 95% 58%)",
};

// Fetch functions
async function fetchRevenueGrowth(): Promise<MonthlyRevenue[]> {
  const months: MonthlyRevenue[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const end = format(endOfMonth(monthDate), "yyyy-MM-dd");

    const { data } = await supabase
      .from("invoices")
      .select("final_amount, paid_amount")
      .gte("created_at", start)
      .lte("created_at", end);

    const billed = (data || []).reduce((sum, inv) => sum + Number(inv.final_amount || 0), 0);
    const collected = (data || []).reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);

    months.push({
      month: format(monthDate, "MMM"),
      billed: Math.round(billed),
      collected: Math.round(collected),
      pending: Math.round(billed - collected),
    });
  }

  return months;
}

async function fetchExpenseBreakdown(): Promise<ExpenseCategory[]> {
  const now = new Date();
  const start = format(startOfMonth(now), "yyyy-MM-dd");
  const end = format(endOfMonth(now), "yyyy-MM-dd");

  const { data } = await supabase
    .from("expenses")
    .select("category, amount")
    .gte("expense_date", start)
    .lte("expense_date", end);

  const grouped: Record<string, number> = {};
  (data || []).forEach((expense) => {
    const cat = expense.category?.toLowerCase() || "other";
    grouped[cat] = (grouped[cat] || 0) + Number(expense.amount || 0);
  });

  return Object.entries(grouped)
    .map(([category, amount]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      amount: Math.round(amount),
      color: EXPENSE_COLORS[category] || EXPENSE_COLORS.other,
    }))
    .sort((a, b) => b.amount - a.amount);
}

async function fetchCattleComposition(): Promise<CattleStatus[]> {
  const { data } = await supabase
    .from("cattle")
    .select("lactation_status, cattle_type, status")
    .eq("status", "active");

  const counts: Record<string, number> = {
    lactating: 0,
    dry: 0,
    pregnant: 0,
    heifer: 0,
    calf: 0,
    bull: 0,
  };

  (data || []).forEach((cattle) => {
    if (cattle.cattle_type === "bull") {
      counts.bull++;
    } else if (cattle.cattle_type === "calf") {
      counts.calf++;
    } else if (cattle.cattle_type === "heifer") {
      counts.heifer++;
    } else if (cattle.lactation_status === "lactating") {
      counts.lactating++;
    } else if (cattle.lactation_status === "dry") {
      counts.dry++;
    } else if (cattle.lactation_status === "pregnant") {
      counts.pregnant++;
    }
  });

  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      color: CATTLE_COLORS[status] || CATTLE_COLORS.dry,
    }));
}

async function fetchDeliveryPerformance(): Promise<DeliveryStats> {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data } = await supabase
    .from("deliveries")
    .select("status")
    .eq("delivery_date", today);

  const stats = { delivered: 0, pending: 0, cancelled: 0, total: 0, rate: 0 };
  
  (data || []).forEach((d) => {
    stats.total++;
    const status = d.status as string;
    if (status === "delivered") stats.delivered++;
    else if (status === "pending") stats.pending++;
    else if (status === "cancelled" || status === "missed") stats.cancelled++;
  });

  stats.rate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  return stats;
}

async function fetchMonthComparison(): Promise<MonthComparison[]> {
  const now = new Date();
  const thisMonthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const thisMonthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

  // Parallel fetch for this month and last month data
  const [
    thisProduction,
    lastProduction,
    thisRevenue,
    lastRevenue,
    thisDeliveries,
    lastDeliveries,
  ] = await Promise.all([
    supabase.from("milk_production").select("quantity_liters").gte("production_date", thisMonthStart).lte("production_date", thisMonthEnd),
    supabase.from("milk_production").select("quantity_liters").gte("production_date", lastMonthStart).lte("production_date", lastMonthEnd),
    supabase.from("invoices").select("final_amount").gte("created_at", thisMonthStart).lte("created_at", thisMonthEnd),
    supabase.from("invoices").select("final_amount").gte("created_at", lastMonthStart).lte("created_at", lastMonthEnd),
    supabase.from("deliveries").select("id").gte("delivery_date", thisMonthStart).lte("delivery_date", thisMonthEnd),
    supabase.from("deliveries").select("id").gte("delivery_date", lastMonthStart).lte("delivery_date", lastMonthEnd),
  ]);

  const thisP = (thisProduction.data || []).reduce((sum, p) => sum + Number(p.quantity_liters || 0), 0);
  const lastP = (lastProduction.data || []).reduce((sum, p) => sum + Number(p.quantity_liters || 0), 0);
  const thisR = (thisRevenue.data || []).reduce((sum, i) => sum + Number(i.final_amount || 0), 0);
  const lastR = (lastRevenue.data || []).reduce((sum, i) => sum + Number(i.final_amount || 0), 0);
  const thisD = thisDeliveries.data?.length || 0;
  const lastD = lastDeliveries.data?.length || 0;

  const calcChange = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;

  return [
    { metric: "Production", current: Math.round(thisP), previous: Math.round(lastP), change: calcChange(thisP, lastP) },
    { metric: "Revenue", current: Math.round(thisR), previous: Math.round(lastR), change: calcChange(thisR, lastR) },
    { metric: "Deliveries", current: thisD, previous: lastD, change: calcChange(thisD, lastD) },
  ];
}

async function fetchCustomerGrowth(): Promise<CustomerTrend[]> {
  const { data } = await supabase
    .from("customers")
    .select("created_at, is_active");

  const trends: CustomerTrend[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthEnd = endOfMonth(monthDate);
    const monthKey = format(monthDate, "MMM");

    const customersUpToMonth = (data || []).filter(
      (c) => new Date(c.created_at!) <= monthEnd
    );
    
    trends.push({
      month: monthKey,
      total: customersUpToMonth.length,
      active: customersUpToMonth.filter((c) => c.is_active).length,
    });
  }

  return trends;
}

async function fetchProcurementVsProduction(): Promise<DailyComparison[]> {
  const today = new Date();
  const weekAgo = subDays(today, 6);

  const [productionRes, procurementRes] = await Promise.all([
    supabase
      .from("milk_production")
      .select("production_date, quantity_liters")
      .gte("production_date", format(weekAgo, "yyyy-MM-dd"))
      .lte("production_date", format(today, "yyyy-MM-dd")),
    supabase
      .from("milk_procurement")
      .select("procurement_date, quantity_liters")
      .gte("procurement_date", format(weekAgo, "yyyy-MM-dd"))
      .lte("procurement_date", format(today, "yyyy-MM-dd")),
  ]);

  const result: DailyComparison[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayName = format(date, "EEE");

    const production = (productionRes.data || [])
      .filter((p) => p.production_date === dateStr)
      .reduce((sum, p) => sum + Number(p.quantity_liters || 0), 0);

    const procurement = (procurementRes.data || [])
      .filter((p) => p.procurement_date === dateStr)
      .reduce((sum, p) => sum + Number(p.quantity_liters || 0), 0);

    result.push({
      day: dayName,
      production: Math.round(production * 10) / 10,
      procurement: Math.round(procurement * 10) / 10,
    });
  }

  return result;
}

// Hooks
export function useRevenueGrowth() {
  return useQuery({
    queryKey: ["revenue-growth-chart"],
    queryFn: fetchRevenueGrowth,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useExpenseBreakdown() {
  return useQuery({
    queryKey: ["expense-breakdown-chart"],
    queryFn: fetchExpenseBreakdown,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useCattleComposition() {
  return useQuery({
    queryKey: ["cattle-composition-chart"],
    queryFn: fetchCattleComposition,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useDeliveryPerformance() {
  return useQuery({
    queryKey: ["delivery-performance-chart"],
    queryFn: fetchDeliveryPerformance,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useMonthComparison() {
  return useQuery({
    queryKey: ["month-comparison-chart"],
    queryFn: fetchMonthComparison,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useCustomerGrowth() {
  return useQuery({
    queryKey: ["customer-growth-chart"],
    queryFn: fetchCustomerGrowth,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useProcurementVsProduction() {
  return useQuery({
    queryKey: ["procurement-vs-production-chart"],
    queryFn: fetchProcurementVsProduction,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
