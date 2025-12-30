import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "./StatCard";
import { ProductionChart } from "./ProductionChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Beef, 
  Droplets, 
  Stethoscope,
  Wheat,
  Loader2,
  AlertTriangle,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface FarmStats {
  totalCattle: number;
  lactatingCattle: number;
  dryCattle: number;
  todayProduction: number;
  morningProduction: number;
  eveningProduction: number;
  lowStockItems: number;
  upcomingHealthTasks: number;
}

interface HealthAlert {
  id: string;
  cattle_tag: string;
  title: string;
  next_due_date: string;
}

export function FarmDashboard() {
  const [stats, setStats] = useState<FarmStats | null>(null);
  const [healthAlerts, setHealthAlerts] = useState<HealthAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFarmData();
  }, []);

  const fetchFarmData = async () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = format(nextWeek, "yyyy-MM-dd");

    const [cattleRes, productionRes, feedRes, healthRes] = await Promise.all([
      supabase
        .from("cattle")
        .select("status, lactation_status"),
      supabase
        .from("milk_production")
        .select("session, quantity_liters")
        .eq("production_date", todayStr),
      supabase
        .from("feed_inventory")
        .select("current_stock, min_stock_level"),
      supabase
        .from("cattle_health")
        .select(`
          id,
          title,
          next_due_date,
          cattle (tag_number)
        `)
        .gte("next_due_date", todayStr)
        .lte("next_due_date", nextWeekStr)
        .order("next_due_date"),
    ]);

    const cattle = cattleRes.data || [];
    const production = productionRes.data || [];
    const feed = feedRes.data || [];
    const health = healthRes.data || [];

    const morningProduction = production
      .filter(p => p.session === "morning")
      .reduce((sum, p) => sum + Number(p.quantity_liters), 0);
    
    const eveningProduction = production
      .filter(p => p.session === "evening")
      .reduce((sum, p) => sum + Number(p.quantity_liters), 0);

    const lowStockItems = feed.filter(
      f => (f.current_stock || 0) <= (f.min_stock_level || 0)
    ).length;

    setStats({
      totalCattle: cattle.filter(c => c.status === "active").length,
      lactatingCattle: cattle.filter(c => c.lactation_status === "lactating").length,
      dryCattle: cattle.filter(c => c.lactation_status === "dry").length,
      todayProduction: morningProduction + eveningProduction,
      morningProduction,
      eveningProduction,
      lowStockItems,
      upcomingHealthTasks: health.length,
    });

    setHealthAlerts(
      health.slice(0, 5).map(h => ({
        id: h.id,
        cattle_tag: (h.cattle as any)?.tag_number || "Unknown",
        title: h.title,
        next_due_date: h.next_due_date || "",
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
      {/* Quick Actions for Farm Workers */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/production">
                <Plus className="mr-2 h-4 w-4" />
                Record Milk
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/cattle">
                <Beef className="mr-2 h-4 w-4" />
                View Cattle
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/inventory">
                <Wheat className="mr-2 h-4 w-4" />
                Feed Inventory
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
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
          title="Low Stock Items"
          value={String(stats?.lowStockItems || 0)}
          subtitle="Need restocking"
          icon={Wheat}
          variant={stats?.lowStockItems ? "warning" : "success"}
          delay={200}
        />
        <StatCard
          title="Health Tasks"
          value={String(stats?.upcomingHealthTasks || 0)}
          subtitle="Due this week"
          icon={Stethoscope}
          variant="primary"
          delay={300}
        />
      </div>

      {/* Production Chart */}
      <ProductionChart />

      {/* Upcoming Health Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Upcoming Health Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No upcoming health tasks this week
            </p>
          ) : (
            <div className="space-y-3">
              {healthAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Cattle: {alert.cattle_tag}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {format(new Date(alert.next_due_date), "MMM d")}
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
