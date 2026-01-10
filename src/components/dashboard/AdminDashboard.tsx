import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "./StatCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { ProductionChart } from "./ProductionChart";
import { ProductionInsights } from "./ProductionInsights";
import { useBreedingAlerts } from "@/hooks/useBreedingAlerts";
import { BreedingAlertsPanel } from "@/components/breeding/BreedingAlertsPanel";
import { 
  Droplets, 
  Beef, 
  Users, 
  IndianRupee,
  Loader2
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { useNavigate } from "react-router-dom";

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

interface Cattle {
  id: string;
  tag_number: string;
  name: string | null;
  status: string | null;
  lactation_status: string | null;
}

interface BreedingRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  record_date: string;
  expected_calving_date: string | null;
  heat_cycle_day: number | null;
  pregnancy_confirmed: boolean | null;
}

interface HealthRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  title: string;
  next_due_date: string | null;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);

  const { alerts, criticalCount, warningCount, upcomingCount } = useBreedingAlerts(
    breedingRecords,
    healthRecords,
    cattle
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

    const [
      productionRes,
      cattleRes,
      customersRes,
      invoicesRes,
      breedingRes,
      healthRes,
    ] = await Promise.all([
      supabase
        .from("milk_production")
        .select("session, quantity_liters")
        .eq("production_date", todayStr),
      supabase
        .from("cattle")
        .select("id, tag_number, name, status, lactation_status"),
      supabase
        .from("customers")
        .select("is_active"),
      supabase
        .from("invoices")
        .select("final_amount, paid_amount")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd),
      supabase
        .from("breeding_records")
        .select("id, cattle_id, record_type, record_date, expected_calving_date, heat_cycle_day, pregnancy_confirmed"),
      supabase
        .from("cattle_health")
        .select("id, cattle_id, record_type, title, next_due_date"),
    ]);

    const production = productionRes.data || [];
    const cattleData = cattleRes.data || [];
    const customers = customersRes.data || [];
    const invoices = invoicesRes.data || [];
    const breedingData = breedingRes.data || [];
    const healthData = healthRes.data || [];

    setCattle(cattleData);
    setBreedingRecords(breedingData);
    setHealthRecords(healthData);

    const morningProduction = production
      .filter(p => p.session === "morning")
      .reduce((sum, p) => sum + Number(p.quantity_liters), 0);
    
    const eveningProduction = production
      .filter(p => p.session === "evening")
      .reduce((sum, p) => sum + Number(p.quantity_liters), 0);

    const activeCattle = cattleData.filter(c => c.status === "active");
    
    setStats({
      todayProduction: morningProduction + eveningProduction,
      morningProduction,
      eveningProduction,
      totalCattle: activeCattle.length,
      lactatingCattle: cattleData.filter(c => c.lactation_status === "lactating").length,
      dryCattle: cattleData.filter(c => c.lactation_status === "dry").length,
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

      <ProductionInsights />

      <div className="grid gap-4 lg:grid-cols-2">
        <BreedingAlertsPanel
          alerts={alerts}
          criticalCount={criticalCount}
          warningCount={warningCount}
          upcomingCount={upcomingCount}
          maxItems={8}
          showViewAll={true}
          onViewAll={() => navigate("/breeding")}
        />
      </div>
    </div>
  );
}
