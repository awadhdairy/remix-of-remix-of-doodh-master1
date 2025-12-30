import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Droplets, 
  Truck, 
  Receipt, 
  Beef, 
  Users,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const quickActions = [
  {
    title: "Record Milk",
    icon: Droplets,
    href: "/production?action=add",
    color: "text-info",
    bgColor: "bg-info/10 hover:bg-info/20",
  },
  {
    title: "New Delivery",
    icon: Truck,
    href: "/deliveries?action=add",
    color: "text-warning",
    bgColor: "bg-warning/10 hover:bg-warning/20",
  },
  {
    title: "Create Invoice",
    icon: Receipt,
    href: "/billing?action=add",
    color: "text-success",
    bgColor: "bg-success/10 hover:bg-success/20",
  },
  {
    title: "Add Cattle",
    icon: Beef,
    href: "/cattle?action=add",
    color: "text-primary",
    bgColor: "bg-primary/10 hover:bg-primary/20",
  },
  {
    title: "New Customer",
    icon: Users,
    href: "/customers?action=add",
    color: "text-accent",
    bgColor: "bg-accent/10 hover:bg-accent/20",
  },
];

export function QuickActionsCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Zap className="h-5 w-5 text-warning" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {quickActions.map((action, index) => (
            <Link key={action.title} to={action.href}>
              <Button
                variant="ghost"
                className={cn(
                  "h-auto w-full flex-col gap-2 p-4 transition-all duration-200",
                  action.bgColor,
                  "animate-scale-in"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <action.icon className={cn("h-6 w-6", action.color)} />
                <span className="text-xs font-medium text-foreground">{action.title}</span>
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
