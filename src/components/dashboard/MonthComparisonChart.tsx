import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { GitCompare, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMonthComparison } from "@/hooks/useDashboardCharts";
import { motion } from "framer-motion";

export function MonthComparisonChart() {
  const { data: chartData, isLoading } = useMonthComparison();

  const formatValue = (metric: string, value: number) => {
    if (metric === "Revenue") return `₹${(value / 1000).toFixed(0)}k`;
    if (metric === "Production") return `${value}L`;
    return value.toString();
  };

  const TrendIcon = ({ change }: { change: number }) => {
    if (change > 0) return <TrendingUp className="h-3.5 w-3.5 text-success" />;
    if (change < 0) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <GitCompare className="h-5 w-5 text-accent" />
              This Month vs Last
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">This Month</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                <span className="text-muted-foreground">Last Month</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[200px] w-full">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !chartData || chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No comparison data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis 
                    dataKey="metric" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(150 10% 45%)', fontSize: 11 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(150 10% 45%)', fontSize: 11 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0 0% 100%)',
                      border: '1px solid hsl(150 15% 85%)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px hsl(150 25% 15% / 0.1)',
                    }}
                    cursor={{ fill: 'hsl(150 15% 95%)' }}
                  />
                  <Bar 
                    dataKey="current" 
                    fill="hsl(155 55% 32%)" 
                    radius={[4, 4, 0, 0]} 
                    name="This Month"
                    barSize={28}
                  />
                  <Bar 
                    dataKey="previous" 
                    fill="hsl(150 10% 70%)" 
                    radius={[4, 4, 0, 0]} 
                    name="Last Month"
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {chartData && chartData.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3 border-t pt-3">
              {chartData.map((item) => (
                <div key={item.metric} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendIcon change={item.change} />
                    <span className={`text-xs font-semibold ${
                      item.change > 0 ? 'text-success' : 
                      item.change < 0 ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      {item.change > 0 ? '+' : ''}{item.change}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.metric}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
