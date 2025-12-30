import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const mockData = [
  { day: "Mon", morning: 120, evening: 110 },
  { day: "Tue", morning: 125, evening: 115 },
  { day: "Wed", morning: 130, evening: 120 },
  { day: "Thu", morning: 128, evening: 118 },
  { day: "Fri", morning: 135, evening: 125 },
  { day: "Sat", morning: 140, evening: 130 },
  { day: "Sun", morning: 138, evening: 128 },
];

export function ProductionChart() {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-success" />
            Weekly Production
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-muted-foreground">Morning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="text-muted-foreground">Evening</span>
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="morningGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(152 45% 28%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(152 45% 28%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="eveningGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(158 50% 45%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(158 50% 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                itemStyle={{ color: 'hsl(150 10% 45%)' }}
                formatter={(value: number) => [`${value} L`, '']}
              />
              <Area
                type="monotone"
                dataKey="morning"
                stroke="hsl(152 45% 28%)"
                strokeWidth={2}
                fill="url(#morningGradient)"
                name="Morning"
              />
              <Area
                type="monotone"
                dataKey="evening"
                stroke="hsl(158 50% 45%)"
                strokeWidth={2}
                fill="url(#eveningGradient)"
                name="Evening"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
