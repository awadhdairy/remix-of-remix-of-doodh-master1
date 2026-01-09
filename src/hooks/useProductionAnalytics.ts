import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, parseISO, differenceInDays } from "date-fns";

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
  best_day: { date: string; amount: number };
  worst_day: { date: string; amount: number };
  morning_total: number;
  evening_total: number;
  morning_percentage: number;
  active_cattle: number;
}

interface ProductionTrend {
  date: string;
  morning: number;
  evening: number;
  total: number;
}

/**
 * Production analytics hook with performance tracking algorithms
 * 
 * Metrics:
 * - Per-cattle performance ranking
 * - Trend detection (7-day rolling average comparison)
 * - Session distribution analysis
 * - Anomaly detection
 */
export function useProductionAnalytics() {
  const [loading, setLoading] = useState(false);

  /**
   * Calculate cattle performance rankings
   * Algorithm: Rank by average daily production over period
   */
  const getCattlePerformance = useCallback(async (
    days: number = 30
  ): Promise<CattlePerformance[]> => {
    setLoading(true);
    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");
    const midDate = format(subDays(new Date(), Math.floor(days / 2)), "yyyy-MM-dd");

    try {
      const { data: production } = await supabase
        .from("milk_production")
        .select(`
          cattle_id,
          quantity_liters,
          production_date,
          cattle:cattle_id (tag_number, name)
        `)
        .gte("production_date", startDate);

      if (!production || production.length === 0) {
        return [];
      }

      // Group by cattle
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

      production.forEach(p => {
        const cattle = p.cattle as any;
        const existing = cattleMap.get(p.cattle_id) || {
          tag_number: cattle?.tag_number || "Unknown",
          name: cattle?.name || null,
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
      });

      // Calculate performance metrics
      const performances: CattlePerformance[] = Array.from(cattleMap.entries()).map(([id, data]) => {
        const productionDaysCount = data.productionDays.size;
        const averageDaily = productionDaysCount > 0 ? data.totalProduction / productionDaysCount : 0;

        // Calculate trend (compare first half vs second half average)
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

      // Sort by average daily production and assign ranks
      performances.sort((a, b) => b.average_daily - a.average_daily);
      performances.forEach((p, index) => {
        p.rank = index + 1;
      });

      return performances;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get production summary for a date range
   */
  const getProductionSummary = useCallback(async (
    days: number = 30
  ): Promise<ProductionSummary> => {
    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

    const { data: production } = await supabase
      .from("milk_production")
      .select("quantity_liters, production_date, session, cattle_id")
      .gte("production_date", startDate);

    if (!production || production.length === 0) {
      return {
        total_liters: 0,
        average_daily: 0,
        best_day: { date: "", amount: 0 },
        worst_day: { date: "", amount: 0 },
        morning_total: 0,
        evening_total: 0,
        morning_percentage: 50,
        active_cattle: 0,
      };
    }

    // Aggregate by date
    const dailyTotals = new Map<string, number>();
    let morningTotal = 0;
    let eveningTotal = 0;
    const activeCattle = new Set<string>();

    production.forEach(p => {
      const current = dailyTotals.get(p.production_date) || 0;
      dailyTotals.set(p.production_date, current + Number(p.quantity_liters));
      
      if (p.session === "morning") {
        morningTotal += Number(p.quantity_liters);
      } else {
        eveningTotal += Number(p.quantity_liters);
      }
      
      activeCattle.add(p.cattle_id);
    });

    const total = morningTotal + eveningTotal;
    const dailyEntries = Array.from(dailyTotals.entries());
    dailyEntries.sort((a, b) => b[1] - a[1]);

    return {
      total_liters: Math.round(total * 100) / 100,
      average_daily: Math.round((total / dailyTotals.size) * 100) / 100,
      best_day: { 
        date: dailyEntries[0]?.[0] || "", 
        amount: dailyEntries[0]?.[1] || 0 
      },
      worst_day: { 
        date: dailyEntries[dailyEntries.length - 1]?.[0] || "", 
        amount: dailyEntries[dailyEntries.length - 1]?.[1] || 0 
      },
      morning_total: Math.round(morningTotal * 100) / 100,
      evening_total: Math.round(eveningTotal * 100) / 100,
      morning_percentage: total > 0 ? Math.round((morningTotal / total) * 100) : 50,
      active_cattle: activeCattle.size,
    };
  }, []);

  /**
   * Get daily production trends
   */
  const getProductionTrends = useCallback(async (
    days: number = 14
  ): Promise<ProductionTrend[]> => {
    const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

    const { data: production } = await supabase
      .from("milk_production")
      .select("quantity_liters, production_date, session")
      .gte("production_date", startDate)
      .order("production_date", { ascending: true });

    if (!production) return [];

    const trendsMap = new Map<string, { morning: number; evening: number }>();

    production.forEach(p => {
      const existing = trendsMap.get(p.production_date) || { morning: 0, evening: 0 };
      if (p.session === "morning") {
        existing.morning += Number(p.quantity_liters);
      } else {
        existing.evening += Number(p.quantity_liters);
      }
      trendsMap.set(p.production_date, existing);
    });

    return Array.from(trendsMap.entries()).map(([date, data]) => ({
      date,
      morning: Math.round(data.morning * 100) / 100,
      evening: Math.round(data.evening * 100) / 100,
      total: Math.round((data.morning + data.evening) * 100) / 100,
    }));
  }, []);

  /**
   * Detect production anomalies (deviation from average)
   */
  const detectAnomalies = useCallback(async (
    threshold: number = 2 // Standard deviations
  ): Promise<Array<{
    cattle_id: string;
    tag_number: string;
    date: string;
    expected: number;
    actual: number;
    deviation: number;
    type: "high" | "low";
  }>> => {
    const performances = await getCattlePerformance(30);
    const avgMap = new Map(performances.map(p => [p.cattle_id, p.average_daily]));

    const startDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
    const { data: recentProduction } = await supabase
      .from("milk_production")
      .select(`
        cattle_id,
        quantity_liters,
        production_date,
        cattle:cattle_id (tag_number)
      `)
      .gte("production_date", startDate);

    if (!recentProduction) return [];

    // Group by cattle and date
    const dailyByCattle = new Map<string, Map<string, number>>();
    
    recentProduction.forEach(p => {
      if (!dailyByCattle.has(p.cattle_id)) {
        dailyByCattle.set(p.cattle_id, new Map());
      }
      const cattleDaily = dailyByCattle.get(p.cattle_id)!;
      const existing = cattleDaily.get(p.production_date) || 0;
      cattleDaily.set(p.production_date, existing + Number(p.quantity_liters));
    });

    const anomalies: Array<{
      cattle_id: string;
      tag_number: string;
      date: string;
      expected: number;
      actual: number;
      deviation: number;
      type: "high" | "low";
    }> = [];

    dailyByCattle.forEach((dailyMap, cattleId) => {
      const expected = avgMap.get(cattleId) || 0;
      if (expected === 0) return;

      dailyMap.forEach((actual, date) => {
        const deviation = ((actual - expected) / expected) * 100;
        const thresholdPercent = threshold * 33; // ~66% deviation at 2 std

        if (Math.abs(deviation) > thresholdPercent) {
          const cattle = recentProduction.find(p => p.cattle_id === cattleId)?.cattle as any;
          anomalies.push({
            cattle_id: cattleId,
            tag_number: cattle?.tag_number || "Unknown",
            date,
            expected: Math.round(expected * 100) / 100,
            actual: Math.round(actual * 100) / 100,
            deviation: Math.round(deviation),
            type: deviation > 0 ? "high" : "low",
          });
        }
      });
    });

    return anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  }, [getCattlePerformance]);

  return {
    loading,
    getCattlePerformance,
    getProductionSummary,
    getProductionTrends,
    detectAnomalies,
  };
}
