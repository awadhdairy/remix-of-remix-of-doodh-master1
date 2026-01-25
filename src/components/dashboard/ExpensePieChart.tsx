import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Wallet, Loader2 } from "lucide-react";
import { useExpenseBreakdown } from "@/hooks/useDashboardCharts";
import { motion } from "framer-motion";

export function ExpensePieChart() {
  const { data: chartData, isLoading } = useExpenseBreakdown();

  const total = chartData?.reduce((sum, item) => sum + item.amount, 0) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Wallet className="h-5 w-5 text-warning" />
            Monthly Expenses
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
                <p className="text-sm text-muted-foreground">No expense data this month</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="amount"
                    nameKey="category"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(0 0% 100%)',
                      border: '1px solid hsl(150 15% 85%)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px hsl(150 25% 15% / 0.1)',
                    }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                  />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {total > 0 && (
            <div className="text-center border-t pt-3 mt-2">
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-lg font-bold text-foreground">₹{total.toLocaleString()}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
