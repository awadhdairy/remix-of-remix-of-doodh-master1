import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { format, subDays } from "date-fns";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Trophy,
  AlertTriangle,
  Droplets,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { InsightsSkeleton } from "@/components/common/LoadingSkeleton";
import { getCattleTag, getCattleName } from "@/lib/supabase-helpers";

interface CattlePerformance {
  cattle_id: string;
  tag_number: string;
  name: string | null;
  average_daily: number;
  total_production: number;
  production_days: number;
  trend: "improving" | "declining" | "stable";
  trendPercentage: number;
  rank: number;
}

interface ProductionSummary {
  total_liters: number;
  average_daily: number;
  morning_percentage: number;
  active_cattle: number;
}

async function fetchProductionInsights() {
  const days = 30;
  const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
  const midDate = format(subDays(new Date(), Math.floor(days / 2)), "yyyy-MM-dd");

  const { data: production } = await supabase
    .from("milk_production")
    .select(`
      cattle_id,
      quantity_liters,
      production_date,
      session,
      cattle:cattle_id (tag_number, name)
    `)
    .gte("production_date", startDate);

  if (!production || production.length === 0) {
    return {
      topPerformers: [],
      underperformers: [],
      summary: null,
      anomalyCount: 0,
    };
  }

  // Group by cattle for performance
  const cattleMap = new Map<string, {
    tag_number: string;
    name: string | null;
    firstHalfTotal: number;
    secondHalfTotal: number;
    firstHalfDays: Set<string>;
    secondHalfDays: Set<string>;
    totalProduction: number;
    productionDays: Set<string>;
  }>();

  let morningTotal = 0;
  let eveningTotal = 0;
  const activeCattle = new Set<string>();
  const dailyTotals = new Map<string, number>();

  production.forEach(p => {
    const existing = cattleMap.get(p.cattle_id) || {
      tag_number: getCattleTag(p.cattle),
      name: getCattleName(p.cattle),
      firstHalfTotal: 0,
      secondHalfTotal: 0,
      firstHalfDays: new Set<string>(),
      secondHalfDays: new Set<string>(),
      totalProduction: 0,
      productionDays: new Set<string>(),
    };

    const isFirstHalf = p.production_date < midDate;
    if (isFirstHalf) {
      existing.firstHalfTotal += Number(p.quantity_liters);
      existing.firstHalfDays.add(p.production_date);
    } else {
      existing.secondHalfTotal += Number(p.quantity_liters);
      existing.secondHalfDays.add(p.production_date);
    }

    existing.totalProduction += Number(p.quantity_liters);
    existing.productionDays.add(p.production_date);
    cattleMap.set(p.cattle_id, existing);

    // Summary calculations
    if (p.session === "morning") {
      morningTotal += Number(p.quantity_liters);
    } else {
      eveningTotal += Number(p.quantity_liters);
    }
    activeCattle.add(p.cattle_id);
    const current = dailyTotals.get(p.production_date) || 0;
    dailyTotals.set(p.production_date, current + Number(p.quantity_liters));
  });

  // Calculate performance metrics
  const performances: CattlePerformance[] = Array.from(cattleMap.entries()).map(([id, data]) => {
    const productionDaysCount = data.productionDays.size;
    const averageDaily = productionDaysCount > 0 ? data.totalProduction / productionDaysCount : 0;

    const firstHalfAvg = data.firstHalfDays.size > 0 ? data.firstHalfTotal / data.firstHalfDays.size : 0;
    const secondHalfAvg = data.secondHalfDays.size > 0 ? data.secondHalfTotal / data.secondHalfDays.size : 0;
    
    let trend: "improving" | "declining" | "stable" = "stable";
    let trendPercentage = 0;

    if (firstHalfAvg > 0) {
      trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      if (trendPercentage > 5) trend = "improving";
      else if (trendPercentage < -5) trend = "declining";
    }

    return {
      cattle_id: id,
      tag_number: data.tag_number,
      name: data.name,
      average_daily: Math.round(averageDaily * 100) / 100,
      total_production: Math.round(data.totalProduction * 100) / 100,
      production_days: productionDaysCount,
      trend,
      trendPercentage: Math.round(trendPercentage * 10) / 10,
      rank: 0,
    };
  });

  performances.sort((a, b) => b.average_daily - a.average_daily);
  performances.forEach((p, index) => {
    p.rank = index + 1;
  });

  const total = morningTotal + eveningTotal;
  const summary: ProductionSummary = {
    total_liters: Math.round(total * 100) / 100,
    average_daily: Math.round((total / dailyTotals.size) * 100) / 100,
    morning_percentage: total > 0 ? Math.round((morningTotal / total) * 100) : 50,
    active_cattle: activeCattle.size,
  };

  const topPerformers = performances.slice(0, 3);
  const underperformers = performances.filter(p => p.trend === "declining").slice(-3).reverse();
  
  // Simple anomaly count
  const avgMap = new Map(performances.map(p => [p.cattle_id, p.average_daily]));
  let anomalyCount = 0;
  performances.forEach(p => {
    if (Math.abs(p.trendPercentage) > 30) anomalyCount++;
  });

  return { topPerformers, underperformers, summary, anomalyCount };
}

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case "improving": return <TrendingUp className="h-3 w-3 text-success" />;
    case "declining": return <TrendingDown className="h-3 w-3 text-destructive" />;
    default: return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
};

export function ProductionInsights() {
  const { data, isLoading } = useQuery({
    queryKey: ["production-insights"],
    queryFn: fetchProductionInsights,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) {
    return <InsightsSkeleton />;
  }

  const { topPerformers, underperformers, summary, anomalyCount } = data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <Droplets className="h-5 w-5 text-info" />
            </motion.div>
            <CardTitle className="text-lg">Production Insights</CardTitle>
          </div>
          {anomalyCount > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Badge variant="outline" className="text-warning border-warning/30">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {anomalyCount} anomalies
              </Badge>
            </motion.div>
          )}
        </div>
        <CardDescription>
          30-day production analytics and performance tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        {summary && (
          <motion.div 
            className="grid grid-cols-2 gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{summary.total_liters.toLocaleString()}L</div>
              <div className="text-xs text-muted-foreground">Total Production</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{summary.average_daily.toLocaleString()}L</div>
              <div className="text-xs text-muted-foreground">Daily Average</div>
            </div>
          </motion.div>
        )}

        {/* Session Distribution */}
        {summary && (
          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Sun className="h-4 w-4 text-warning" />
                Morning
              </span>
              <span className="flex items-center gap-1">
                <Moon className="h-4 w-4 text-primary" />
                Evening
              </span>
            </div>
            <Progress value={summary.morning_percentage} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{summary.morning_percentage}%</span>
              <span>{100 - summary.morning_percentage}%</span>
            </div>
          </motion.div>
        )}

        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Trophy className="h-4 w-4 text-warning" />
              Top Performers
            </div>
            <div className="space-y-1">
              {topPerformers.map((cow, index) => (
                <motion.div
                  key={cow.cattle_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-success/5 border border-success/20"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs w-6 h-6 p-0 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div>
                      <span className="font-medium text-sm">{cow.tag_number}</span>
                      {cow.name && <span className="text-xs text-muted-foreground ml-1">({cow.name})</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cow.average_daily}L/day</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(cow.trend)}
                      <span className={cn(
                        "text-xs",
                        cow.trend === "improving" && "text-success",
                        cow.trend === "declining" && "text-destructive"
                      )}>
                        {cow.trendPercentage > 0 ? "+" : ""}{cow.trendPercentage}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Underperformers */}
        {underperformers.length > 0 && (
          <motion.div 
            className="space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Attention Needed
            </div>
            <div className="space-y-1">
              {underperformers.map((cow, index) => (
                <motion.div
                  key={cow.cattle_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <div>
                    <span className="font-medium text-sm">{cow.tag_number}</span>
                    {cow.name && <span className="text-xs text-muted-foreground ml-1">({cow.name})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cow.average_daily}L/day</span>
                    <Badge variant="destructive" className="text-xs">
                      {cow.trendPercentage}%
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Active Cattle */}
        {summary && (
          <motion.div 
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span className="text-sm text-muted-foreground">Active Producing Cattle</span>
            <Badge variant="secondary">{summary.active_cattle}</Badge>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
