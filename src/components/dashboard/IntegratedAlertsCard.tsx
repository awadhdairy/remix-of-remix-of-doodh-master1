import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  Bell, 
  ChevronRight, 
  Heart, 
  Stethoscope, 
  Package, 
  IndianRupee,
  TrendingDown,
  AlertCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  category: "breeding" | "health" | "inventory" | "payment" | "delivery" | "production";
  title: string;
  description: string;
  dueDate?: Date;
  daysUntil?: number;
  entityId?: string;
  entityType?: string;
  priority: number;
  actionLabel?: string;
  actionRoute?: string;
}

interface IntegratedAlertsCardProps {
  alerts: Alert[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  maxItems?: number;
}

const categoryIcons: Record<string, React.ReactNode> = {
  breeding: <Heart className="h-4 w-4" />,
  health: <Stethoscope className="h-4 w-4" />,
  inventory: <Package className="h-4 w-4" />,
  payment: <IndianRupee className="h-4 w-4" />,
  delivery: <Package className="h-4 w-4" />,
  production: <TrendingDown className="h-4 w-4" />,
};

const typeStyles: Record<string, { badge: string; icon: React.ReactNode }> = {
  critical: { 
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    icon: <AlertCircle className="h-4 w-4 text-destructive" />
  },
  warning: { 
    badge: "bg-warning/10 text-warning border-warning/30",
    icon: <AlertTriangle className="h-4 w-4 text-warning" />
  },
  info: { 
    badge: "bg-info/10 text-info border-info/30",
    icon: <Info className="h-4 w-4 text-info" />
  },
};

export function IntegratedAlertsCard({ 
  alerts, 
  criticalCount, 
  warningCount, 
  infoCount,
  maxItems = 8 
}: IntegratedAlertsCardProps) {
  const navigate = useNavigate();
  const displayAlerts = alerts.slice(0, maxItems);

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">System Alerts</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} Critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge className="bg-warning text-warning-foreground text-xs">
                {warningCount} Warning
              </Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {infoCount} Info
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Cross-module alerts requiring attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active alerts</p>
            <p className="text-sm">All systems operating normally</p>
          </div>
        ) : (
          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-2">
              {displayAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    "hover:bg-accent/50 cursor-pointer",
                    typeStyles[alert.type].badge
                  )}
                  onClick={() => alert.actionRoute && navigate(alert.actionRoute)}
                >
                  <div className="mt-0.5 shrink-0">
                    {typeStyles[alert.type].icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{alert.title}</span>
                      <Badge variant="outline" className="text-xs shrink-0 capitalize">
                        {categoryIcons[alert.category]}
                        <span className="ml-1">{alert.category}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {alert.description}
                    </p>
                    {alert.actionLabel && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 mt-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          alert.actionRoute && navigate(alert.actionRoute);
                        }}
                      >
                        {alert.actionLabel}
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
