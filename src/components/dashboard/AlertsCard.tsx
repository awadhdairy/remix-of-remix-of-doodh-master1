import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Bell, Syringe, TrendingDown, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  category: "vaccination" | "production" | "inventory" | "payment";
  title: string;
  description: string;
}

const mockAlerts: Alert[] = [
  {
    id: "1",
    type: "warning",
    category: "vaccination",
    title: "Vaccination Due",
    description: "3 cattle due for FMD vaccination tomorrow",
  },
  {
    id: "2",
    type: "error",
    category: "production",
    title: "Low Milk Yield",
    description: "Cow #42 showing 30% drop in production",
  },
  {
    id: "3",
    type: "info",
    category: "inventory",
    title: "Low Stock Alert",
    description: "Green fodder stock below minimum level",
  },
  {
    id: "4",
    type: "warning",
    category: "payment",
    title: "Payment Overdue",
    description: "2 customers with overdue payments",
  },
];

const typeStyles = {
  warning: "border-l-warning bg-warning/5",
  error: "border-l-destructive bg-destructive/5",
  info: "border-l-info bg-info/5",
};

const categoryIcons = {
  vaccination: Syringe,
  production: TrendingDown,
  inventory: Package,
  payment: AlertTriangle,
};

const badgeVariants = {
  warning: "bg-warning/20 text-warning hover:bg-warning/30",
  error: "bg-destructive/20 text-destructive hover:bg-destructive/30",
  info: "bg-info/20 text-info hover:bg-info/30",
};

export function AlertsCard() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Bell className="h-5 w-5 text-destructive" />
            Alerts & Reminders
          </div>
          <Badge variant="outline" className="bg-destructive/10 text-destructive">
            {mockAlerts.length} Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px] px-6">
          <div className="space-y-2">
            {mockAlerts.map((alert, index) => {
              const Icon = categoryIcons[alert.category];
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
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
