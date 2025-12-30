import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "./StatCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { ProductionChart } from "./ProductionChart";
import { AlertsCard } from "./AlertsCard";
import { 
  Droplets, 
  Beef, 
  Users, 
  IndianRupee,
  Loader2
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface DashboardStats {
  todayProduction: number;
  morningProduction: number;
  eveningProduction: number;
  totalCattle: number;
  lactatingCattle: number;
  dryCattle: number;
  totalCustomers: number;
  activeCustomers: number;
  monthlyRevenue: number;
  pendingAmount: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    const [productionRes, cattleRes, customersRes, invoicesRes] = await Promise.all([
      supabase
        .from("milk_production")
        .select("session, quantity_liters")
        .eq("production_date", todayStr),
      supabase
        .from("cattle")
        .select("status, lactation_status"),
      supabase
        .from("customers")
        .select("is_active"),
      supabase
        .from("invoices")
        .select("final_amount, paid_amount")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd),
    ]);

    const production = productionRes.data || [];
    const cattle = cattleRes.data || [];
    const customers = customersRes.data || [];
    const invoices = invoicesRes.data || [];

    const morningProduction = production
      .filter(p => p.session === "morning")
      .reduce((sum, p) => sum + Number(p.quantity_liters), 0);
    
    const eveningProduction = production
      .filter(p => p.session === "evening")
      .reduce((sum, p) => sum + Number(p.quantity_liters), 0);

    const activeCattle = cattle.filter(c => c.status === "active");
    
    setStats({
      todayProduction: morningProduction + eveningProduction,
      morningProduction,
      eveningProduction,
      totalCattle: activeCattle.length,
      lactatingCattle: cattle.filter(c => c.lactation_status === "lactating").length,
      dryCattle: cattle.filter(c => c.lactation_status === "dry").length,
      totalCustomers: customers.length,
      activeCustomers: customers.filter(c => c.is_active).length,
      monthlyRevenue: invoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
      pendingAmount: invoices.reduce((sum, i) => sum + (Number(i.final_amount) - Number(i.paid_amount)), 0),
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
      <QuickActionsCard />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Production"
          value={`${stats?.todayProduction || 0} L`}
          subtitle={`Morning: ${stats?.morningProduction || 0}L | Evening: ${stats?.eveningProduction || 0}L`}
          icon={Droplets}
          variant="info"
          delay={0}
        />
        <StatCard
          title="Active Cattle"
          value={String(stats?.totalCattle || 0)}
          subtitle={`${stats?.lactatingCattle || 0} Lactating | ${stats?.dryCattle || 0} Dry`}
          icon={Beef}
          variant="primary"
          delay={100}
        />
        <StatCard
          title="Total Customers"
          value={String(stats?.totalCustomers || 0)}
          subtitle={`${stats?.activeCustomers || 0} active`}
          icon={Users}
          variant="success"
          delay={200}
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${(stats?.monthlyRevenue || 0).toLocaleString()}`}
          subtitle={`Pending: ₹${(stats?.pendingAmount || 0).toLocaleString()}`}
          icon={IndianRupee}
          variant="warning"
          delay={300}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ProductionChart />
        <RecentActivityCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AlertsCard />
      </div>
    </div>
  );
}
