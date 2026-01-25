import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Users, Loader2 } from "lucide-react";
import { useCustomerGrowth } from "@/hooks/useDashboardCharts";
import { motion } from "framer-motion";

export function CustomerGrowthChart() {
  const { data: chartData, isLoading } = useCustomerGrowth();

  const latestData = chartData?.[chartData.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-success" />
              Customer Growth
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">Total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                <span className="text-muted-foreground">Active</span>
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
                <p className="text-sm text-muted-foreground">No customer data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(150 10% 45%)', fontSize: 10 }}
                    interval={1}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(150 10% 45%)', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0 0% 100%)',
                      border: '1px solid hsl(150 15% 85%)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px hsl(150 25% 15% / 0.1)',
                    }}
                    labelStyle={{ color: 'hsl(150 25% 15%)', fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(155 55% 32%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(155 55% 32%)', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, stroke: 'hsl(155 55% 32%)', strokeWidth: 2, fill: 'white' }}
                    name="Total Customers"
                  />
                  <Line
                    type="monotone"
                    dataKey="active"
                    stroke="hsl(162 60% 42%)"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(162 60% 42%)', strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, stroke: 'hsl(162 60% 42%)', strokeWidth: 2, fill: 'white' }}
                    name="Active Customers"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {latestData && (
            <div className="grid grid-cols-2 gap-4 mt-3 border-t pt-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{latestData.total}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{latestData.active}</p>
                <p className="text-xs text-muted-foreground">Active Customers</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
