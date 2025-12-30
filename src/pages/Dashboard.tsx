import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { ProductionChart } from "@/components/dashboard/ProductionChart";
import { AlertsCard } from "@/components/dashboard/AlertsCard";
import { 
  Droplets, 
  Beef, 
  Users, 
  IndianRupee,
  Calendar
} from "lucide-react";

export default function Dashboard() {
  const today = new Date().toLocaleDateString('en-IN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{today}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsCard />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Production"
          value="465 L"
          subtitle="Morning: 245L | Evening: 220L"
          icon={Droplets}
          trend={{ value: 5.2, isPositive: true }}
          variant="info"
          delay={0}
        />
        <StatCard
          title="Active Cattle"
          value="32"
          subtitle="24 Lactating | 8 Dry"
          icon={Beef}
          variant="primary"
          delay={100}
        />
        <StatCard
          title="Total Customers"
          value="156"
          subtitle="12 new this month"
          icon={Users}
          trend={{ value: 8.1, isPositive: true }}
          variant="success"
          delay={200}
        />
        <StatCard
          title="Monthly Revenue"
          value="₹2,45,000"
          subtitle="Pending: ₹35,000"
          icon={IndianRupee}
          trend={{ value: 12.5, isPositive: true }}
          variant="warning"
          delay={300}
        />
      </div>

      {/* Charts & Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ProductionChart />
        <RecentActivityCard />
      </div>

      {/* Alerts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AlertsCard />
      </div>
    </div>
  );
}
