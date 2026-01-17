import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCustomerName, getCustomerArea } from "@/lib/supabase-helpers";
import { StatCard } from "./StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Truck, 
  Users, 
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface DeliveryStats {
  todayDeliveries: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  customersOnRoute: number;
  pendingBottles: number;
}

interface TodayDelivery {
  id: string;
  customer_name: string;
  status: string;
  delivery_time: string | null;
  area: string | null;
}

export function DeliveryDashboard() {
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [todayDeliveries, setTodayDeliveries] = useState<TodayDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeliveryData();
  }, []);

  const fetchDeliveryData = async () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const [deliveriesRes, customersRes, bottlesRes] = await Promise.all([
      supabase
        .from("deliveries")
        .select(`
          id,
          status,
          delivery_time,
          customers (
            name,
            area
          )
        `)
        .eq("delivery_date", todayStr),
      supabase
        .from("customers")
        .select("id")
        .eq("is_active", true),
      supabase
        .from("customer_bottles")
        .select("quantity_pending")
        .gt("quantity_pending", 0),
    ]);

    const deliveries = deliveriesRes.data || [];
    const customers = customersRes.data || [];
    const bottles = bottlesRes.data || [];

    setStats({
      todayDeliveries: deliveries.length,
      completedDeliveries: deliveries.filter(d => d.status === "delivered").length,
      pendingDeliveries: deliveries.filter(d => d.status === "pending").length,
      customersOnRoute: customers.length,
      pendingBottles: bottles.reduce((sum, b) => sum + (b.quantity_pending || 0), 0),
    });

    setTodayDeliveries(
      deliveries.slice(0, 5).map(d => ({
        id: d.id,
        customer_name: getCustomerName(d.customers),
        status: d.status || "pending",
        delivery_time: d.delivery_time,
        area: getCustomerArea(d.customers),
      }))
    );

    setLoading(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "missed":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
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
      {/* Quick Actions for Delivery Staff */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/deliveries">
                <Truck className="mr-2 h-4 w-4" />
                Start Deliveries
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/bottles">
                <Package className="mr-2 h-4 w-4" />
                Collect Bottles
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/customers">
                <Users className="mr-2 h-4 w-4" />
                View Customers
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Deliveries"
          value={String(stats?.todayDeliveries || 0)}
          subtitle="Scheduled for today"
          icon={Truck}
          variant="info"
          delay={0}
        />
        <StatCard
          title="Completed"
          value={String(stats?.completedDeliveries || 0)}
          subtitle="Deliveries done"
          icon={CheckCircle2}
          variant="success"
          delay={100}
        />
        <StatCard
          title="Pending"
          value={String(stats?.pendingDeliveries || 0)}
          subtitle="Yet to deliver"
          icon={Clock}
          variant="warning"
          delay={200}
        />
        <StatCard
          title="Pending Bottles"
          value={String(stats?.pendingBottles || 0)}
          subtitle="To be collected"
          icon={Package}
          variant="primary"
          delay={300}
        />
      </div>

      {/* Today's Deliveries List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Today's Delivery Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayDeliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No deliveries scheduled for today
            </p>
          ) : (
            <div className="space-y-3">
              {todayDeliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(delivery.status)}
                    <div>
                      <p className="font-medium">{delivery.customer_name}</p>
                      {delivery.area && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {delivery.area}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      delivery.status === "delivered"
                        ? "default"
                        : delivery.status === "pending"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {delivery.status}
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
