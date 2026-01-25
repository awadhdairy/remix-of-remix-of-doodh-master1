import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import {
  TrendingUp,
  Droplets,
  Users,
  BarChart3,
  Loader2,
  Activity,
  Target,
} from "lucide-react";

interface ProcurementRecord {
  id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  procurement_date: string;
  session: string;
  quantity_liters: number;
  fat_percentage: number | null;
  snf_percentage: number | null;
  rate_per_liter: number | null;
  total_amount: number | null;
}

interface VendorStats {
  name: string;
  totalQuantity: number;
  totalAmount: number;
  avgFat: number;
  avgSnf: number;
  avgRate: number;
  recordCount: number;
}

interface DailyTrend {
  date: string;
  displayDate: string;
  morning: number;
  evening: number;
  total: number;
  avgFat: number;
  avgSnf: number;
  amount: number;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

export function ProcurementAnalytics() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "month">("30d");
  const [procurements, setProcurements] = useState<ProcurementRecord[]>([]);
  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [vendorStats, setVendorStats] = useState<VendorStats[]>([]);
  const [qualityData, setQualityData] = useState<{ date: string; avgFat: number; avgSnf: number }[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalQuantity: 0,
    totalAmount: 0,
    avgFat: 0,
    avgSnf: 0,
    avgRate: 0,
    uniqueVendors: 0,
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  const getDateRange = () => {
    const end = new Date();
    let start: Date;

    switch (dateRange) {
      case "7d":
        start = subDays(end, 7);
        break;
      case "30d":
        start = subDays(end, 30);
        break;
      case "90d":
        start = subDays(end, 90);
        break;
      case "month":
        start = startOfMonth(end);
        break;
      default:
        start = subDays(end, 30);
    }

    return { start, end };
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    const { start, end } = getDateRange();

    const { data, error } = await supabase
      .from("milk_procurement")
      .select("*")
      .gte("procurement_date", format(start, "yyyy-MM-dd"))
      .lte("procurement_date", format(end, "yyyy-MM-dd"))
      .order("procurement_date", { ascending: true });

    if (error) {
      console.error("Error fetching analytics:", error);
      setLoading(false);
      return;
    }

    setProcurements(data || []);
    processAnalyticsData(data || [], start, end);
    setLoading(false);
  };

  const processAnalyticsData = (data: ProcurementRecord[], start: Date, end: Date) => {
    // Daily trends
    const days = eachDayOfInterval({ start, end });
    const dailyMap = new Map<string, DailyTrend>();

    days.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      dailyMap.set(dateStr, {
        date: dateStr,
        displayDate: format(day, "dd MMM"),
        morning: 0,
        evening: 0,
        total: 0,
        avgFat: 0,
        avgSnf: 0,
        amount: 0,
      });
    });

    const vendorMap = new Map<string, VendorStats>();
    let totalFat = 0,
      totalSnf = 0,
      fatCount = 0,
      snfCount = 0;

    data.forEach((record) => {
      const dateStr = record.procurement_date;
      const daily = dailyMap.get(dateStr);

      if (daily) {
        const qty = Number(record.quantity_liters) || 0;
        if (record.session === "morning") {
          daily.morning += qty;
        } else {
          daily.evening += qty;
        }
        daily.total += qty;
        daily.amount += Number(record.total_amount) || 0;

        if (record.fat_percentage) {
          daily.avgFat = (daily.avgFat + Number(record.fat_percentage)) / 2 || Number(record.fat_percentage);
        }
        if (record.snf_percentage) {
          daily.avgSnf = (daily.avgSnf + Number(record.snf_percentage)) / 2 || Number(record.snf_percentage);
        }
      }

      // Vendor stats
      const vendorName = record.vendor_name || "Unknown";
      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          name: vendorName,
          totalQuantity: 0,
          totalAmount: 0,
          avgFat: 0,
          avgSnf: 0,
          avgRate: 0,
          recordCount: 0,
        });
      }

      const vendor = vendorMap.get(vendorName)!;
      vendor.totalQuantity += Number(record.quantity_liters) || 0;
      vendor.totalAmount += Number(record.total_amount) || 0;
      vendor.recordCount += 1;

      if (record.fat_percentage) {
        vendor.avgFat = ((vendor.avgFat * (vendor.recordCount - 1)) + Number(record.fat_percentage)) / vendor.recordCount;
        totalFat += Number(record.fat_percentage);
        fatCount++;
      }
      if (record.snf_percentage) {
        vendor.avgSnf = ((vendor.avgSnf * (vendor.recordCount - 1)) + Number(record.snf_percentage)) / vendor.recordCount;
        totalSnf += Number(record.snf_percentage);
        snfCount++;
      }
      if (record.rate_per_liter) {
        vendor.avgRate = ((vendor.avgRate * (vendor.recordCount - 1)) + Number(record.rate_per_liter)) / vendor.recordCount;
      }
    });

    // Set daily trends
    const trends = Array.from(dailyMap.values()).filter(d => d.total > 0 || dateRange === "7d");
    setDailyTrends(trends);

    // Set vendor stats sorted by total quantity
    const vendorStatsArray = Array.from(vendorMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
    setVendorStats(vendorStatsArray);

    // Quality data for chart
    const qualityTrends = trends.filter(d => d.avgFat > 0 || d.avgSnf > 0).map(d => ({
      date: d.displayDate,
      avgFat: Number(d.avgFat.toFixed(2)),
      avgSnf: Number(d.avgSnf.toFixed(2)),
    }));
    setQualityData(qualityTrends);

    // Summary stats
    const totalQty = data.reduce((sum, r) => sum + Number(r.quantity_liters || 0), 0);
    const totalAmt = data.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    const rateRecords = data.filter(r => r.rate_per_liter);
    const avgRate = rateRecords.length
      ? rateRecords.reduce((sum, r) => sum + Number(r.rate_per_liter || 0), 0) / rateRecords.length
      : 0;

    setSummaryStats({
      totalQuantity: totalQty,
      totalAmount: totalAmt,
      avgFat: fatCount ? totalFat / fatCount : 0,
      avgSnf: snfCount ? totalSnf / snfCount : 0,
      avgRate,
      uniqueVendors: vendorMap.size,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Procurement Analytics
        </h3>
        <Select value={dateRange} onValueChange={(v: "7d" | "30d" | "90d" | "month") => setDateRange(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Procured</CardTitle>
            <Droplets className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.totalQuantity.toLocaleString()} L</div>
            <p className="text-xs text-muted-foreground">From {summaryStats.uniqueVendors} vendors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{summaryStats.totalAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Avg ₹{summaryStats.avgRate.toFixed(2)}/L</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Fat %</CardTitle>
            <Target className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.avgFat.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">Quality metric</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg SNF %</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats.avgSnf.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">Solids-not-fat</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Volume Trends</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Comparison</TabsTrigger>
          <TabsTrigger value="quality">Quality Metrics</TabsTrigger>
          <TabsTrigger value="sessions">Session Analysis</TabsTrigger>
        </TabsList>

        {/* Volume Trends */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Procurement Volume</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTrends.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No data for selected period</div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={dailyTrends}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                      formatter={(value: number) => [`${value.toLocaleString()} L`, "Volume"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      fill="url(#colorTotal)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyTrends.filter(d => d.amount > 0)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Amount"]}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendor Comparison */}
        <TabsContent value="vendors" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vendor Volume Share</CardTitle>
              </CardHeader>
              <CardContent>
                {vendorStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No vendor data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={vendorStats.slice(0, 8)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="totalQuantity"
                        nameKey="name"
                        label={({ name, percent }) => `${name.slice(0, 10)}${name.length > 10 ? '...' : ''} ${(percent * 100).toFixed(0)}%`}
                      >
                        {vendorStats.slice(0, 8).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${value.toLocaleString()} L`, "Volume"]}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--background))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Vendors by Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={vendorStats.slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toLocaleString()} L`, "Volume"]}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="totalQuantity" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Vendor Stats Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Vendor Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Vendor</th>
                      <th className="text-right p-2 font-medium">Volume (L)</th>
                      <th className="text-right p-2 font-medium">Amount (₹)</th>
                      <th className="text-right p-2 font-medium">Avg Fat %</th>
                      <th className="text-right p-2 font-medium">Avg SNF %</th>
                      <th className="text-right p-2 font-medium">Avg Rate</th>
                      <th className="text-right p-2 font-medium">Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorStats.map((vendor, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{vendor.name}</td>
                        <td className="text-right p-2">{vendor.totalQuantity.toLocaleString()}</td>
                        <td className="text-right p-2">₹{vendor.totalAmount.toLocaleString()}</td>
                        <td className="text-right p-2">{vendor.avgFat.toFixed(2)}%</td>
                        <td className="text-right p-2">{vendor.avgSnf.toFixed(2)}%</td>
                        <td className="text-right p-2">₹{vendor.avgRate.toFixed(2)}</td>
                        <td className="text-right p-2">{vendor.recordCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Metrics */}
        <TabsContent value="quality" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fat & SNF Percentage Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {qualityData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No quality data recorded</div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={qualityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 'auto']} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgFat"
                      name="Fat %"
                      stroke="hsl(var(--chart-4))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgSnf"
                      name="SNF %"
                      stroke="hsl(var(--chart-5))"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fat % by Vendor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={vendorStats.filter(v => v.avgFat > 0).slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, "Fat"]}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="avgFat" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">SNF % by Vendor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={vendorStats.filter(v => v.avgSnf > 0).slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, "SNF"]}
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar dataKey="avgSnf" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Session Analysis */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Morning vs Evening Collection</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={dailyTrends.filter(d => d.morning > 0 || d.evening > 0)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} L`]}
                  />
                  <Legend />
                  <Bar dataKey="morning" name="Morning" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="evening" name="Evening" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Session Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const morningTotal = dailyTrends.reduce((sum, d) => sum + d.morning, 0);
                  const eveningTotal = dailyTrends.reduce((sum, d) => sum + d.evening, 0);
                  const sessionData = [
                    { name: "Morning", value: morningTotal },
                    { name: "Evening", value: eveningTotal },
                  ];

                  return (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={sessionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="hsl(var(--chart-1))" />
                          <Cell fill="hsl(var(--chart-2))" />
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`${value.toLocaleString()} L`, "Volume"]}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--background))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Session Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const morningTotal = dailyTrends.reduce((sum, d) => sum + d.morning, 0);
                  const eveningTotal = dailyTrends.reduce((sum, d) => sum + d.evening, 0);
                  const total = morningTotal + eveningTotal;

                  return (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                        <div>
                          <p className="text-sm font-medium">Morning Collection</p>
                          <p className="text-2xl font-bold">{morningTotal.toLocaleString()} L</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {total > 0 ? ((morningTotal / total) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                        <div>
                          <p className="text-sm font-medium">Evening Collection</p>
                          <p className="text-2xl font-bold">{eveningTotal.toLocaleString()} L</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {total > 0 ? ((eveningTotal / total) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
