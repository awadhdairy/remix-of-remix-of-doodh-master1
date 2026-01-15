import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Bell, Syringe, TrendingDown, Package, Loader2, IndianRupee, Beef } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isBefore, isAfter } from "date-fns";

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  category: "vaccination" | "production" | "inventory" | "payment" | "breeding" | "health";
  title: string;
  description: string;
}

async function fetchAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const today = new Date();
  const nextWeek = addDays(today, 7);

  // Check for overdue vaccinations/health tasks
  const { data: healthDue } = await supabase
    .from("cattle_health")
    .select("id, title, next_due_date, cattle:cattle_id(tag_number)")
    .not("next_due_date", "is", null)
    .lte("next_due_date", format(nextWeek, "yyyy-MM-dd"));

  if (healthDue) {
    const overdue = healthDue.filter(h => h.next_due_date && isBefore(new Date(h.next_due_date), today));
    const upcoming = healthDue.filter(h => h.next_due_date && !isBefore(new Date(h.next_due_date), today));
    
    if (overdue.length > 0) {
      alerts.push({
        id: "health-overdue",
        type: "error",
        category: "vaccination",
        title: "Overdue Health Tasks",
        description: `${overdue.length} cattle with overdue vaccinations/checkups`,
      });
    }
    
    if (upcoming.length > 0) {
      alerts.push({
        id: "health-upcoming",
        type: "warning",
        category: "vaccination",
        title: "Upcoming Health Tasks",
        description: `${upcoming.length} health tasks due this week`,
      });
    }
  }

  // Check for low feed inventory
  const { data: lowStock } = await supabase
    .from("feed_inventory")
    .select("id, name, current_stock, min_stock_level")
    .not("min_stock_level", "is", null);

  if (lowStock) {
    const lowItems = lowStock.filter(f => 
      f.current_stock !== null && f.min_stock_level !== null && 
      Number(f.current_stock) <= Number(f.min_stock_level)
    );
    
    if (lowItems.length > 0) {
      alerts.push({
        id: "inventory-low",
        type: "warning",
        category: "inventory",
        title: "Low Stock Alert",
        description: `${lowItems.length} feed items below minimum level`,
      });
    }
  }

  // Check for overdue invoices
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("id")
    .eq("payment_status", "pending")
    .lt("due_date", format(today, "yyyy-MM-dd"));

  if (overdueInvoices && overdueInvoices.length > 0) {
    alerts.push({
      id: "payment-overdue",
      type: "error",
      category: "payment",
      title: "Overdue Payments",
      description: `${overdueInvoices.length} invoices past due date`,
    });
  }

  // Check for expected calvings
  const { data: expectedCalvings } = await supabase
    .from("breeding_records")
    .select("id, expected_calving_date, cattle:cattle_id(tag_number)")
    .not("expected_calving_date", "is", null)
    .gte("expected_calving_date", format(today, "yyyy-MM-dd"))
    .lte("expected_calving_date", format(nextWeek, "yyyy-MM-dd"))
    .is("actual_calving_date", null);

  if (expectedCalvings && expectedCalvings.length > 0) {
    alerts.push({
      id: "breeding-calving",
      type: "info",
      category: "breeding",
      title: "Expected Calvings",
      description: `${expectedCalvings.length} cattle expected to calve this week`,
    });
  }

  // Check production trends (simplified - comparing today vs yesterday if data exists)
  const { data: recentProduction } = await supabase
    .from("milk_production")
    .select("production_date, quantity_liters")
    .gte("production_date", format(addDays(today, -2), "yyyy-MM-dd"))
    .order("production_date", { ascending: false });

  if (recentProduction && recentProduction.length > 0) {
    const byDate: Record<string, number> = {};
    recentProduction.forEach(p => {
      byDate[p.production_date] = (byDate[p.production_date] || 0) + Number(p.quantity_liters);
    });
    
    const dates = Object.keys(byDate).sort().reverse();
    if (dates.length >= 2) {
      const todayTotal = byDate[dates[0]] || 0;
      const yesterdayTotal = byDate[dates[1]] || 0;
      
      if (yesterdayTotal > 0 && todayTotal < yesterdayTotal * 0.8) {
        alerts.push({
          id: "production-drop",
          type: "warning",
          category: "production",
          title: "Production Drop",
          description: `Today's production is ${Math.round((1 - todayTotal / yesterdayTotal) * 100)}% lower than yesterday`,
        });
      }
    }
  }

  // If no alerts, add a positive message
  if (alerts.length === 0) {
    alerts.push({
      id: "all-good",
      type: "info",
      category: "health",
      title: "All Systems Normal",
      description: "No pending alerts or issues detected",
    });
  }

  return alerts;
}

const typeStyles = {
  warning: "border-l-warning bg-warning/5",
  error: "border-l-destructive bg-destructive/5",
  info: "border-l-info bg-info/5",
};

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  vaccination: Syringe,
  production: TrendingDown,
  inventory: Package,
  payment: IndianRupee,
  breeding: Beef,
  health: Syringe,
};

const badgeVariants = {
  warning: "bg-warning/20 text-warning hover:bg-warning/30",
  error: "bg-destructive/20 text-destructive hover:bg-destructive/30",
  info: "bg-info/20 text-info hover:bg-info/30",
};

export function AlertsCard() {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: fetchAlerts,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const alertCount = alerts?.filter(a => a.type !== "info" || a.id !== "all-good").length || 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Bell className="h-5 w-5 text-destructive" />
            Alerts & Reminders
          </div>
          <Badge variant="outline" className={cn(
            alertCount > 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
          )}>
            {isLoading ? "..." : `${alertCount} Active`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px] px-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="flex h-full items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, index) => {
                const Icon = categoryIcons[alert.category] || AlertTriangle;
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "rounded-lg border-l-4 p-3 transition-colors hover:bg-muted/30",
                      typeStyles[alert.type],
                      "animate-slide-in-left"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{alert.title}</p>
                          <Badge 
                            variant="secondary" 
                            className={cn("text-[10px]", badgeVariants[alert.type])}
                          >
                            {alert.type}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{alert.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
