import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  Droplets,
  Truck,
  IndianRupee,
  ClipboardList
} from "lucide-react";
import { format, addDays, subDays, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { exportToExcel, exportToPDF, exportToCSV } from "@/lib/export";

interface DailyProduction {
  date: string;
  morning: number;
  evening: number;
  total: number;
  cattleCount: number;
}

interface DailyDelivery {
  date: string;
  scheduled: number;
  delivered: number;
  pending: number;
  skipped: number;
}

interface DailyFinance {
  date: string;
  revenue: number;
  expenses: number;
  payments: number;
  netAmount: number;
}

interface DailyAttendance {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

type ViewMode = "week" | "month";
type DataCategory = "production" | "deliveries" | "finance" | "attendance";

export function DailyDataTable() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [category, setCategory] = useState<DataCategory>("production");
  const [loading, setLoading] = useState(false);
  
  const [productionData, setProductionData] = useState<DailyProduction[]>([]);
  const [deliveryData, setDeliveryData] = useState<DailyDelivery[]>([]);
  const [financeData, setFinanceData] = useState<DailyFinance[]>([]);
  const [attendanceData, setAttendanceData] = useState<DailyAttendance[]>([]);

  const getDateRange = () => {
    if (viewMode === "week") {
      return {
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 1 })
      };
    }
    return {
      start: startOfMonth(selectedDate),
      end: endOfMonth(selectedDate)
    };
  };

  const fetchData = async () => {
    setLoading(true);
    const { start, end } = getDateRange();
    const days = eachDayOfInterval({ start, end });
    const startStr = format(start, "yyyy-MM-dd");
    const endStr = format(end, "yyyy-MM-dd");

    try {
      // Fetch production data
      const { data: production } = await supabase
        .from("milk_production")
        .select("production_date, session, quantity_liters, cattle_id")
        .gte("production_date", startStr)
        .lte("production_date", endStr);

      const prodByDate = days.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const dayProd = (production || []).filter(p => p.production_date === dateStr);
        const morning = dayProd.filter(p => p.session === "morning").reduce((sum, p) => sum + Number(p.quantity_liters), 0);
        const evening = dayProd.filter(p => p.session === "evening").reduce((sum, p) => sum + Number(p.quantity_liters), 0);
        const uniqueCattle = new Set(dayProd.map(p => p.cattle_id)).size;
        return {
          date: dateStr,
          morning,
          evening,
          total: morning + evening,
          cattleCount: uniqueCattle
        };
      });
      setProductionData(prodByDate);

      // Fetch delivery data
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("delivery_date, status")
        .gte("delivery_date", startStr)
        .lte("delivery_date", endStr);

      const delByDate = days.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const dayDel = (deliveries || []).filter(d => d.delivery_date === dateStr);
        return {
          date: dateStr,
          scheduled: dayDel.length,
          delivered: dayDel.filter(d => d.status === "delivered").length,
          pending: dayDel.filter(d => d.status === "pending").length,
          skipped: dayDel.filter(d => d.status === "missed").length
        };
      });
      setDeliveryData(delByDate);

      // Fetch finance data
      const [{ data: invoices }, { data: expenses }, { data: payments }] = await Promise.all([
        supabase.from("invoices").select("created_at, final_amount").gte("created_at", startStr).lte("created_at", endStr + "T23:59:59"),
        supabase.from("expenses").select("expense_date, amount").gte("expense_date", startStr).lte("expense_date", endStr),
        supabase.from("payments").select("payment_date, amount").gte("payment_date", startStr).lte("payment_date", endStr)
      ]);

      const finByDate = days.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const dayRevenue = (invoices || []).filter(i => i.created_at?.startsWith(dateStr)).reduce((sum, i) => sum + Number(i.final_amount), 0);
        const dayExpenses = (expenses || []).filter(e => e.expense_date === dateStr).reduce((sum, e) => sum + Number(e.amount), 0);
        const dayPayments = (payments || []).filter(p => p.payment_date === dateStr).reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          date: dateStr,
          revenue: dayRevenue,
          expenses: dayExpenses,
          payments: dayPayments,
          netAmount: dayPayments - dayExpenses
        };
      });
      setFinanceData(finByDate);

      // Fetch attendance data
      const { data: attendance } = await supabase
        .from("attendance")
        .select("attendance_date, status, employee_id")
        .gte("attendance_date", startStr)
        .lte("attendance_date", endStr);

      const { data: employees } = await supabase.from("employees").select("id").eq("is_active", true);
      const totalEmployees = employees?.length || 0;

      const attByDate = days.map(date => {
        const dateStr = format(date, "yyyy-MM-dd");
        const dayAtt = (attendance || []).filter(a => a.attendance_date === dateStr);
        const present = dayAtt.filter(a => a.status === "present").length;
        const absent = dayAtt.filter(a => a.status === "absent").length;
        const late = dayAtt.filter(a => a.status === "late" || a.status === "half_day").length;
        return {
          date: dateStr,
          present,
          absent,
          late,
          total: totalEmployees
        };
      });
      setAttendanceData(attByDate);

    } catch (error) {
      console.error("Error fetching daily data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, viewMode]);

  const navigateDate = (direction: "prev" | "next") => {
    const days = viewMode === "week" ? 7 : 30;
    setSelectedDate(direction === "prev" ? subDays(selectedDate, days) : addDays(selectedDate, days));
  };

  const handleExport = (exportFormat: "excel" | "pdf" | "csv") => {
    const { start, end } = getDateRange();
    const periodLabel = `${format(start, "dd_MMM")}_to_${format(end, "dd_MMM_yyyy")}`;

    let data: any[] = [];
    let columns: { key: string; header: string; width?: number }[] = [];
    let title = "";

    switch (category) {
      case "production":
        data = productionData.map(d => ({
          ...d,
          date: format(new Date(d.date), "dd MMM yyyy")
        }));
        columns = [
          { key: "date", header: "Date", width: 15 },
          { key: "morning", header: "Morning (L)", width: 12 },
          { key: "evening", header: "Evening (L)", width: 12 },
          { key: "total", header: "Total (L)", width: 12 },
          { key: "cattleCount", header: "Cattle", width: 10 }
        ];
        title = "Daily Production Report";
        break;
      case "deliveries":
        data = deliveryData.map(d => ({
          ...d,
          date: format(new Date(d.date), "dd MMM yyyy")
        }));
        columns = [
          { key: "date", header: "Date", width: 15 },
          { key: "scheduled", header: "Scheduled", width: 12 },
          { key: "delivered", header: "Delivered", width: 12 },
          { key: "pending", header: "Pending", width: 12 },
          { key: "skipped", header: "Skipped", width: 10 }
        ];
        title = "Daily Deliveries Report";
        break;
      case "finance":
        data = financeData.map(d => ({
          ...d,
          date: format(new Date(d.date), "dd MMM yyyy"),
          revenue: `₹${d.revenue.toLocaleString()}`,
          expenses: `₹${d.expenses.toLocaleString()}`,
          payments: `₹${d.payments.toLocaleString()}`,
          netAmount: `₹${d.netAmount.toLocaleString()}`
        }));
        columns = [
          { key: "date", header: "Date", width: 15 },
          { key: "revenue", header: "Revenue", width: 12 },
          { key: "expenses", header: "Expenses", width: 12 },
          { key: "payments", header: "Collections", width: 12 },
          { key: "netAmount", header: "Net", width: 12 }
        ];
        title = "Daily Finance Report";
        break;
      case "attendance":
        data = attendanceData.map(d => ({
          ...d,
          date: format(new Date(d.date), "dd MMM yyyy")
        }));
        columns = [
          { key: "date", header: "Date", width: 15 },
          { key: "present", header: "Present", width: 10 },
          { key: "absent", header: "Absent", width: 10 },
          { key: "late", header: "Late", width: 10 },
          { key: "total", header: "Total Staff", width: 12 }
        ];
        title = "Daily Attendance Report";
        break;
    }

    const filename = `daily_${category}_${periodLabel}`;

    switch (exportFormat) {
      case "excel":
        exportToExcel(data, columns, filename, title);
        break;
      case "pdf":
        exportToPDF(data, columns, filename, title, { orientation: "portrait" });
        break;
      case "csv":
        exportToCSV(data, columns, filename);
        break;
    }
  };

  const categoryIcons = {
    production: Droplets,
    deliveries: Truck,
    finance: IndianRupee,
    attendance: ClipboardList
  };

  const CategoryIcon = categoryIcons[category];
  const { start, end } = getDateRange();

  const renderProductionTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Morning (L)</TableHead>
          <TableHead className="text-right">Evening (L)</TableHead>
          <TableHead className="text-right">Total (L)</TableHead>
          <TableHead className="text-right">Cattle</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {productionData.map((row) => (
          <TableRow key={row.date}>
            <TableCell className="font-medium">{format(new Date(row.date), "dd MMM, EEE")}</TableCell>
            <TableCell className="text-right">{row.morning.toFixed(1)}</TableCell>
            <TableCell className="text-right">{row.evening.toFixed(1)}</TableCell>
            <TableCell className="text-right font-semibold">{row.total.toFixed(1)}</TableCell>
            <TableCell className="text-right">{row.cattleCount}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold">
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{productionData.reduce((sum, d) => sum + d.morning, 0).toFixed(1)}</TableCell>
          <TableCell className="text-right">{productionData.reduce((sum, d) => sum + d.evening, 0).toFixed(1)}</TableCell>
          <TableCell className="text-right">{productionData.reduce((sum, d) => sum + d.total, 0).toFixed(1)}</TableCell>
          <TableCell className="text-right">-</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  const renderDeliveriesTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Scheduled</TableHead>
          <TableHead className="text-right">Delivered</TableHead>
          <TableHead className="text-right">Pending</TableHead>
          <TableHead className="text-right">Skipped</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deliveryData.map((row) => (
          <TableRow key={row.date}>
            <TableCell className="font-medium">{format(new Date(row.date), "dd MMM, EEE")}</TableCell>
            <TableCell className="text-right">{row.scheduled}</TableCell>
            <TableCell className="text-right">
              <Badge variant="default" className="bg-success">{row.delivered}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {row.pending > 0 && <Badge variant="secondary">{row.pending}</Badge>}
              {row.pending === 0 && "-"}
            </TableCell>
            <TableCell className="text-right">
              {row.skipped > 0 && <Badge variant="destructive">{row.skipped}</Badge>}
              {row.skipped === 0 && "-"}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold">
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{deliveryData.reduce((sum, d) => sum + d.scheduled, 0)}</TableCell>
          <TableCell className="text-right">{deliveryData.reduce((sum, d) => sum + d.delivered, 0)}</TableCell>
          <TableCell className="text-right">{deliveryData.reduce((sum, d) => sum + d.pending, 0)}</TableCell>
          <TableCell className="text-right">{deliveryData.reduce((sum, d) => sum + d.skipped, 0)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  const renderFinanceTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Expenses</TableHead>
          <TableHead className="text-right">Collections</TableHead>
          <TableHead className="text-right">Net</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {financeData.map((row) => (
          <TableRow key={row.date}>
            <TableCell className="font-medium">{format(new Date(row.date), "dd MMM, EEE")}</TableCell>
            <TableCell className="text-right text-success">₹{row.revenue.toLocaleString()}</TableCell>
            <TableCell className="text-right text-destructive">₹{row.expenses.toLocaleString()}</TableCell>
            <TableCell className="text-right">₹{row.payments.toLocaleString()}</TableCell>
            <TableCell className={cn("text-right font-semibold", row.netAmount >= 0 ? "text-success" : "text-destructive")}>
              ₹{row.netAmount.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold">
          <TableCell>Total</TableCell>
          <TableCell className="text-right text-success">₹{financeData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()}</TableCell>
          <TableCell className="text-right text-destructive">₹{financeData.reduce((sum, d) => sum + d.expenses, 0).toLocaleString()}</TableCell>
          <TableCell className="text-right">₹{financeData.reduce((sum, d) => sum + d.payments, 0).toLocaleString()}</TableCell>
          <TableCell className={cn("text-right", financeData.reduce((sum, d) => sum + d.netAmount, 0) >= 0 ? "text-success" : "text-destructive")}>
            ₹{financeData.reduce((sum, d) => sum + d.netAmount, 0).toLocaleString()}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  const renderAttendanceTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Present</TableHead>
          <TableHead className="text-right">Absent</TableHead>
          <TableHead className="text-right">Late</TableHead>
          <TableHead className="text-right">Total Staff</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attendanceData.map((row) => (
          <TableRow key={row.date}>
            <TableCell className="font-medium">{format(new Date(row.date), "dd MMM, EEE")}</TableCell>
            <TableCell className="text-right">
              <Badge variant="default" className="bg-success">{row.present}</Badge>
            </TableCell>
            <TableCell className="text-right">
              {row.absent > 0 && <Badge variant="destructive">{row.absent}</Badge>}
              {row.absent === 0 && "-"}
            </TableCell>
            <TableCell className="text-right">
              {row.late > 0 && <Badge variant="secondary">{row.late}</Badge>}
              {row.late === 0 && "-"}
            </TableCell>
            <TableCell className="text-right">{row.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CategoryIcon className="h-5 w-5 text-primary" />
              Daily Data Report
            </CardTitle>
            <CardDescription>
              {format(start, "dd MMM")} - {format(end, "dd MMM yyyy")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => navigateDate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, "MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => navigateDate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
            Today
          </Button>
        </div>

        {/* Category Tabs */}
        <Tabs value={category} onValueChange={(v) => setCategory(v as DataCategory)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="production" className="gap-1">
              <Droplets className="h-4 w-4" />
              <span className="hidden sm:inline">Production</span>
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="gap-1">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Deliveries</span>
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-1">
              <IndianRupee className="h-4 w-4" />
              <span className="hidden sm:inline">Finance</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-1">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Attendance</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 overflow-x-auto">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <TabsContent value="production" className="m-0">
                  {renderProductionTable()}
                </TabsContent>
                <TabsContent value="deliveries" className="m-0">
                  {renderDeliveriesTable()}
                </TabsContent>
                <TabsContent value="finance" className="m-0">
                  {renderFinanceTable()}
                </TabsContent>
                <TabsContent value="attendance" className="m-0">
                  {renderAttendanceTable()}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
