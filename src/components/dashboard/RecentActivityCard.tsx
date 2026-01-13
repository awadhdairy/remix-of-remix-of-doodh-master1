import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Activity, Droplets, Truck, Receipt, Beef, Clock } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "production" | "delivery" | "payment" | "cattle" | "other";
  title: string;
  description: string;
  time: string;
}

const mockActivities: ActivityItem[] = [
  {
    id: "1",
    type: "production",
    title: "Milk Collection",
    description: "Morning session: 245 liters collected",
    time: "2 hours ago",
  },
  {
    id: "2",
    type: "delivery",
    title: "Delivery Completed",
    description: "Route A completed by Ramesh",
    time: "3 hours ago",
  },
  {
    id: "3",
    type: "payment",
    title: "Payment Received",
    description: "₹15,000 from Sharma Dairy",
    time: "4 hours ago",
  },
  {
    id: "4",
    type: "cattle",
    title: "Health Checkup",
    description: "Vaccination completed for 5 cattle",
    time: "5 hours ago",
  },
  {
    id: "5",
    type: "production",
    title: "Milk Collection",
    description: "Evening session: 220 liters collected",
    time: "Yesterday",
  },
];

const typeIcons = {
  production: Droplets,
  delivery: Truck,
  payment: Receipt,
  cattle: Beef,
  other: Activity,
};

const typeColors = {
  production: "bg-info/10 text-info",
  delivery: "bg-warning/10 text-warning",
  payment: "bg-success/10 text-success",
  cattle: "bg-primary/10 text-primary",
  other: "bg-muted text-muted-foreground",
};

export function RecentActivityCard() {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <motion.div
            initial={{ rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Activity className="h-5 w-5 text-primary" />
          </motion.div>
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px] px-6">
          <div className="space-y-1">
            {mockActivities.map((activity, index) => {
              const Icon = typeIcons[activity.type];
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: 0.3, 
                    delay: index * 0.08,
                  }}
                  whileHover={{ x: 4, backgroundColor: "hsl(var(--muted) / 0.5)" }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-3 transition-colors cursor-pointer"
                  )}
                >
                  <motion.div 
                    className={cn("rounded-lg p-2", typeColors[activity.type])}
                    whileHover={{ scale: 1.1 }}
                  >
                    <Icon className="h-4 w-4" />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{activity.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{activity.time}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
