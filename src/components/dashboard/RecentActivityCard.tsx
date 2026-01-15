import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Activity, Droplets, Truck, Receipt, Beef, Clock, Loader2, Syringe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: "production" | "delivery" | "payment" | "cattle" | "health" | "other";
  title: string;
  description: string;
  time: string;
  created_at: string;
}

async function fetchRecentActivities(): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];

  // Fetch recent milk production
  const { data: production } = await supabase
    .from("milk_production")
    .select("id, created_at, session, quantity_liters, cattle:cattle_id(tag_number)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (production) {
    production.forEach((p) => {
      const cattle = p.cattle as { tag_number: string } | null;
      activities.push({
        id: `prod-${p.id}`,
        type: "production",
        title: "Milk Collection",
        description: `${p.session === "morning" ? "Morning" : "Evening"}: ${p.quantity_liters}L from ${cattle?.tag_number || "Unknown"}`,
        time: formatDistanceToNow(new Date(p.created_at), { addSuffix: true }),
        created_at: p.created_at,
      });
    });
  }

  // Fetch recent deliveries
  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, created_at, status, customer:customer_id(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (deliveries) {
    deliveries.forEach((d) => {
      const customer = d.customer as { name: string } | null;
      activities.push({
        id: `del-${d.id}`,
        type: "delivery",
        title: d.status === "delivered" ? "Delivery Completed" : "Delivery Scheduled",
        description: `${customer?.name || "Unknown"} - ${d.status}`,
        time: formatDistanceToNow(new Date(d.created_at), { addSuffix: true }),
        created_at: d.created_at,
      });
    });
  }

  // Fetch recent payments
  const { data: payments } = await supabase
    .from("payments")
    .select("id, created_at, amount, customer:customer_id(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (payments) {
    payments.forEach((p) => {
      const customer = p.customer as { name: string } | null;
      activities.push({
        id: `pay-${p.id}`,
        type: "payment",
        title: "Payment Received",
        description: `₹${Number(p.amount).toLocaleString()} from ${customer?.name || "Unknown"}`,
        time: formatDistanceToNow(new Date(p.created_at), { addSuffix: true }),
        created_at: p.created_at,
      });
    });
  }

  // Fetch recent health records
  const { data: health } = await supabase
    .from("cattle_health")
    .select("id, created_at, title, record_type, cattle:cattle_id(tag_number)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (health) {
    health.forEach((h) => {
      const cattle = h.cattle as { tag_number: string } | null;
      activities.push({
        id: `health-${h.id}`,
        type: "health",
        title: h.title,
        description: `${h.record_type} for ${cattle?.tag_number || "Unknown"}`,
        time: formatDistanceToNow(new Date(h.created_at), { addSuffix: true }),
        created_at: h.created_at,
      });
    });
  }

  // Sort all by created_at and take top 10
  return activities
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);
}

const typeIcons = {
  production: Droplets,
  delivery: Truck,
  payment: Receipt,
  cattle: Beef,
  health: Syringe,
  other: Activity,
};

const typeColors = {
  production: "bg-info/10 text-info",
  delivery: "bg-warning/10 text-warning",
  payment: "bg-success/10 text-success",
  cattle: "bg-primary/10 text-primary",
  health: "bg-accent/10 text-accent",
  other: "bg-muted text-muted-foreground",
};

export function RecentActivityCard() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["recent-activities"],
    queryFn: fetchRecentActivities,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

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
          {isLoading ? (
            <div className="flex h-full items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !activities || activities.length === 0 ? (
            <div className="flex h-full items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((activity, index) => {
                const Icon = typeIcons[activity.type] || Activity;
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
                      className={cn("rounded-lg p-2", typeColors[activity.type] || typeColors.other)}
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
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
