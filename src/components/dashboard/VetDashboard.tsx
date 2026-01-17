import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCattleTag } from "@/lib/supabase-helpers";
import { StatCard } from "./StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Stethoscope, 
  Beef,
  Syringe,
  HeartPulse,
  Loader2,
  Calendar,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface VetStats {
  totalCattle: number;
  healthRecordsThisMonth: number;
  upcomingVaccinations: number;
  recentTreatments: number;
}

interface HealthTask {
  id: string;
  cattle_tag: string;
  title: string;
  record_type: string;
  next_due_date: string;
}

export function VetDashboard() {
  const [stats, setStats] = useState<VetStats | null>(null);
  const [healthTasks, setHealthTasks] = useState<HealthTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVetData();
  }, []);

  const fetchVetData = async () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const nextMonthStr = format(nextMonth, "yyyy-MM-dd");
    const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

    const [cattleRes, healthMonthRes, upcomingRes] = await Promise.all([
      supabase
        .from("cattle")
        .select("id")
        .eq("status", "active"),
      supabase
        .from("cattle_health")
        .select("id, record_type")
        .gte("record_date", monthStart),
      supabase
        .from("cattle_health")
        .select(`
          id,
          title,
          record_type,
          next_due_date,
          cattle (tag_number)
        `)
        .gte("next_due_date", todayStr)
        .lte("next_due_date", nextMonthStr)
        .order("next_due_date")
        .limit(10),
    ]);

    const cattle = cattleRes.data || [];
    const healthMonth = healthMonthRes.data || [];
    const upcoming = upcomingRes.data || [];

    const vaccinations = upcoming.filter(h => h.record_type === "vaccination");

    setStats({
      totalCattle: cattle.length,
      healthRecordsThisMonth: healthMonth.length,
      upcomingVaccinations: vaccinations.length,
      recentTreatments: healthMonth.filter(h => h.record_type === "treatment").length,
    });

    setHealthTasks(
      upcoming.map(h => ({
        id: h.id,
        cattle_tag: getCattleTag(h.cattle),
        title: h.title,
        record_type: h.record_type,
        next_due_date: h.next_due_date || "",
      }))
    );

    setLoading(false);
  };

  const getRecordTypeIcon = (type: string) => {
    switch (type) {
      case "vaccination":
        return <Syringe className="h-4 w-4 text-health-vaccination" />;
      case "treatment":
        return <HeartPulse className="h-4 w-4 text-health-treatment" />;
      case "checkup":
        return <Stethoscope className="h-4 w-4 text-health-checkup" />;
      default:
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
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
      {/* Quick Actions */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/health">
                <Plus className="mr-2 h-4 w-4" />
                Add Health Record
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/cattle">
                <Beef className="mr-2 h-4 w-4" />
                View Cattle
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Cattle"
          value={String(stats?.totalCattle || 0)}
          subtitle="Active animals"
          icon={Beef}
          variant="primary"
          delay={0}
        />
        <StatCard
          title="Records This Month"
          value={String(stats?.healthRecordsThisMonth || 0)}
          subtitle="Health records added"
          icon={Stethoscope}
          variant="info"
          delay={100}
        />
        <StatCard
          title="Upcoming Vaccinations"
          value={String(stats?.upcomingVaccinations || 0)}
          subtitle="Next 30 days"
          icon={Syringe}
          variant="warning"
          delay={200}
        />
        <StatCard
          title="Treatments"
          value={String(stats?.recentTreatments || 0)}
          subtitle="This month"
          icon={HeartPulse}
          variant="success"
          delay={300}
        />
      </div>

      {/* Upcoming Health Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Health Tasks (Next 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No upcoming health tasks scheduled
            </p>
          ) : (
            <div className="space-y-3">
              {healthTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {getRecordTypeIcon(task.record_type)}
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Cattle: {task.cattle_tag} • {task.record_type}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {format(new Date(task.next_due_date), "MMM d")}
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
