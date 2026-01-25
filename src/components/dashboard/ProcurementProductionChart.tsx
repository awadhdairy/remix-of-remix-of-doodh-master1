import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComposedChart, Bar, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { Droplets, Loader2 } from "lucide-react";
import { useProcurementVsProduction } from "@/hooks/useDashboardCharts";
import { motion } from "framer-motion";

export function ProcurementProductionChart() {
  const { data: chartData, isLoading } = useProcurementVsProduction();

  const totalProduction = chartData?.reduce((sum, d) => sum + d.production, 0) || 0;
  const totalProcurement = chartData?.reduce((sum, d) => sum + d.procurement, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="col-span-full lg:col-span-2"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Droplets className="h-5 w-5 text-info" />
              Production vs Procurement (Last 7 Days)
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">Farm Production</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded bg-info" />
                <span className="text-muted-foreground">Procurement</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[260px] w-full">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !chartData || chartData.every(d => d.production === 0 && d.procurement === 0) ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No production or procurement data this week</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(150 10% 45%)', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(150 10% 45%)', fontSize: 12 }}
                    tickFormatter={(value) => `${value}L`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0 0% 100%)',
                      border: '1px solid hsl(150 15% 85%)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px hsl(150 25% 15% / 0.1)',
                    }}
                    labelStyle={{ color: 'hsl(150 25% 15%)', fontWeight: 600 }}
                    formatter={(value: number) => [`${value} L`, '']}
                  />
                  <Bar 
                    dataKey="procurement" 
                    fill="hsl(205 92% 52%)" 
                    radius={[4, 4, 0, 0]} 
                    name="Procurement"
                    barSize={32}
                    opacity={0.8}
                  />
                  <Line
                    type="monotone"
                    dataKey="production"
                    stroke="hsl(155 55% 32%)"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(155 55% 32%)', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, stroke: 'hsl(155 55% 32%)', strokeWidth: 2, fill: 'white' }}
                    name="Farm Production"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-3 border-t pt-3">
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{totalProduction.toFixed(1)} L</p>
              <p className="text-xs text-muted-foreground">Total Farm Production</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-info">{totalProcurement.toFixed(1)} L</p>
              <p className="text-xs text-muted-foreground">Total Procurement</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
