import { useNavigate } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";
import { StatCard } from "./StatCard";
import { RecentActivityCard } from "./RecentActivityCard";
import { QuickActionsCard } from "./QuickActionsCard";
import { ProductionChart } from "./ProductionChart";
import { ProductionInsights } from "./ProductionInsights";
import { useBreedingAlerts } from "@/hooks/useBreedingAlerts";
import { BreedingAlertsPanel } from "@/components/breeding/BreedingAlertsPanel";
import { DashboardSkeleton } from "@/components/common/LoadingSkeleton";
import { motion } from "framer-motion";
import { 
  Droplets, 
  Beef, 
  Users, 
  IndianRupee,
} from "lucide-react";

export function AdminDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardData();

  const { alerts, criticalCount, warningCount, upcomingCount } = useBreedingAlerts(
    data?.breedingRecords || [],
    data?.healthRecords || [],
    data?.cattle || []
  );

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  const { stats } = data;

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <QuickActionsCard />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Production"
          value={`${stats?.todayProduction || 0} L`}
          subtitle={`Morning: ${stats?.morningProduction || 0}L | Evening: ${stats?.eveningProduction || 0}L`}
          icon={Droplets}
          variant="info"
          index={0}
        />
        <StatCard
          title="Active Cattle"
          value={String(stats?.totalCattle || 0)}
          subtitle={`${stats?.lactatingCattle || 0} Lactating | ${stats?.dryCattle || 0} Dry`}
          icon={Beef}
          variant="primary"
          index={1}
        />
        <StatCard
          title="Total Customers"
          value={String(stats?.totalCustomers || 0)}
          subtitle={`${stats?.activeCustomers || 0} active`}
          icon={Users}
          variant="success"
          index={2}
        />
        <StatCard
          title="Monthly Revenue"
          value={`₹${(stats?.monthlyRevenue || 0).toLocaleString()}`}
          subtitle={`Pending: ₹${(stats?.pendingAmount || 0).toLocaleString()}`}
          icon={IndianRupee}
          variant="warning"
          index={3}
        />
      </div>

      <motion.div 
        className="grid gap-4 lg:grid-cols-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <ProductionChart />
        <RecentActivityCard />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <ProductionInsights />
      </motion.div>

      <motion.div 
        className="grid gap-4 lg:grid-cols-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <BreedingAlertsPanel
          alerts={alerts}
          criticalCount={criticalCount}
          warningCount={warningCount}
          upcomingCount={upcomingCount}
          maxItems={8}
          showViewAll={true}
          onViewAll={() => navigate("/breeding")}
        />
      </motion.div>
    </motion.div>
  );
}
