import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { Truck, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useDeliveryPerformance } from "@/hooks/useDashboardCharts";
import { motion } from "framer-motion";

export function DeliveryPerformanceChart() {
  const { data: stats, isLoading } = useDeliveryPerformance();

  const chartData = stats ? [
    { name: "Completion", value: stats.rate, fill: "hsl(145 75% 42%)" },
  ] : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Truck className="h-5 w-5 text-info" />
            Today's Deliveries
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[180px] w-full relative">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !stats || stats.total === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No deliveries scheduled today</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="100%"
                    barSize={14}
                    data={chartData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis
                      type="number"
                      domain={[0, 100]}
                      angleAxisId={0}
                      tick={false}
                    />
                    <RadialBar
                      background={{ fill: 'hsl(150 15% 90%)' }}
                      dataKey="value"
                      cornerRadius={10}
                      angleAxisId={0}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">{stats.rate}%</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {stats && stats.total > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3 border-t pt-3">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <div>
                  <p className="text-sm font-semibold">{stats.delivered}</p>
                  <p className="text-[10px] text-muted-foreground">Delivered</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-warning" />
                <div>
                  <p className="text-sm font-semibold">{stats.pending}</p>
                  <p className="text-[10px] text-muted-foreground">Pending</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-sm font-semibold">{stats.cancelled}</p>
                  <p className="text-[10px] text-muted-foreground">Cancelled</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
