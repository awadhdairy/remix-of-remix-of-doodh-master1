import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProductionAnalytics } from "@/hooks/useProductionAnalytics";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Trophy,
  AlertTriangle,
  Droplets,
  Sun,
  Moon,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function ProductionInsights() {
  const { loading, getCattlePerformance, getProductionSummary, detectAnomalies } = useProductionAnalytics();
  
  const [topPerformers, setTopPerformers] = useState<CattlePerformance[]>([]);
  const [underperformers, setUnderperformers] = useState<CattlePerformance[]>([]);
  const [summary, setSummary] = useState<{
    total_liters: number;
    average_daily: number;
    morning_percentage: number;
    active_cattle: number;
  } | null>(null);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [performances, summaryData, anomalies] = await Promise.all([
        getCattlePerformance(30),
        getProductionSummary(30),
        detectAnomalies(2),
      ]);

      // Top 3 performers
      setTopPerformers(performances.slice(0, 3));
      
      // Bottom 3 with declining trend
      const declining = performances
        .filter(p => p.trend === "declining")
        .slice(-3)
        .reverse();
      setUnderperformers(declining);
      
      setSummary(summaryData);
      setAnomalyCount(anomalies.length);
    } finally {
      setDataLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-3 w-3 text-success" />;
      case "declining": return <TrendingDown className="h-3 w-3 text-destructive" />;
      default: return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (dataLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-info" />
            <CardTitle className="text-lg">Production Insights</CardTitle>
          </div>
          {anomalyCount > 0 && (
            <Badge variant="outline" className="text-warning border-warning/30">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {anomalyCount} anomalies
            </Badge>
          )}
        </div>
        <CardDescription>
          30-day production analytics and performance tracking
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{summary.total_liters.toLocaleString()}L</div>
              <div className="text-xs text-muted-foreground">Total Production</div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{summary.average_daily.toLocaleString()}L</div>
              <div className="text-xs text-muted-foreground">Daily Average</div>
            </div>
          </div>
        )}

        {/* Session Distribution */}
        {summary && (
          <div className="space-y-2">
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
          </div>
        )}

        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Trophy className="h-4 w-4 text-warning" />
              Top Performers
            </div>
            <div className="space-y-1">
              {topPerformers.map((cow, index) => (
                <div
                  key={cow.cattle_id}
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Underperformers */}
        {underperformers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Attention Needed
            </div>
            <div className="space-y-1">
              {underperformers.map((cow) => (
                <div
                  key={cow.cattle_id}
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
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Cattle */}
        {summary && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">Active Producing Cattle</span>
            <Badge variant="secondary">{summary.active_cattle}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
