import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Beef, Loader2 } from "lucide-react";
import { useCattleComposition } from "@/hooks/useDashboardCharts";
import { motion } from "framer-motion";

export function CattleCompositionChart() {
  const { data: chartData, isLoading } = useCattleComposition();

  const total = chartData?.reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Beef className="h-5 w-5 text-primary" />
              Herd Composition
            </div>
            <span className="text-sm font-medium text-muted-foreground">{total} Total</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[260px] w-full">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !chartData || chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No cattle data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <XAxis 
                    type="number" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(150 10% 45%)', fontSize: 11 }}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="status" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(150 10% 45%)', fontSize: 11 }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0 0% 100%)',
                      border: '1px solid hsl(150 15% 85%)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px hsl(150 25% 15% / 0.1)',
                    }}
                    cursor={{ fill: 'hsl(150 15% 95%)' }}
                    formatter={(value: number) => [`${value} head`, '']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
