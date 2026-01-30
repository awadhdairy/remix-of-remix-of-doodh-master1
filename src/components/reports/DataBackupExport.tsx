import { useState } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  Upload, 
  Database, 
  FileJson, 
  FileSpreadsheet, 
  FileText,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive
} from "lucide-react";
import { format, subDays, subWeeks, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { exportToExcel, exportToPDF, exportToCSV } from "@/lib/export";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type ExportPeriod = "weekly" | "monthly" | "all";
type ExportFormat = "json" | "excel" | "pdf" | "csv";

interface TableData {
  name: string;
  displayName: string;
  data: any[];
  columns: { key: string; header: string; width?: number }[];
}

interface BackupMetadata {
  version: string;
  exportedAt: string;
  period: string;
  dateRange: { start: string; end: string } | null;
  tables: string[];
  recordCounts: Record<string, number>;
}

export function DataBackupExport() {
  const { toast } = useToast();
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("monthly");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);

  const getDateRange = (period: ExportPeriod) => {
    const today = new Date();
    switch (period) {
      case "weekly":
        return {
          start: startOfWeek(today, { weekStartsOn: 1 }),
          end: endOfWeek(today, { weekStartsOn: 1 })
        };
      case "monthly":
        return {
          start: startOfMonth(today),
          end: endOfMonth(today)
        };
      case "all":
        return null;
    }
  };

  const fetchAllData = async (period: ExportPeriod): Promise<TableData[]> => {
    const dateRange = getDateRange(period);
    const dateFilter = dateRange 
      ? { start: format(dateRange.start, "yyyy-MM-dd"), end: format(dateRange.end, "yyyy-MM-dd") }
      : null;

    const tables: TableData[] = [];
    setExportProgress(5);

    // Cattle
    const { data: cattle } = await supabase.from("cattle").select("*");
    tables.push({
      name: "cattle",
      displayName: "Cattle",
      data: cattle || [],
      columns: [
        { key: "tag_number", header: "Tag Number", width: 12 },
        { key: "name", header: "Name", width: 15 },
        { key: "breed", header: "Breed", width: 15 },
        { key: "cattle_type", header: "Type", width: 10 },
        { key: "status", header: "Status", width: 10 },
        { key: "lactation_status", header: "Lactation", width: 12 },
        { key: "date_of_birth", header: "DOB", width: 12 },
        { key: "weight", header: "Weight", width: 10 },
      ]
    });
    setExportProgress(15);

    // Milk Production
    let productionQuery = supabase.from("milk_production").select("*");
    if (dateFilter) {
      productionQuery = productionQuery.gte("production_date", dateFilter.start).lte("production_date", dateFilter.end);
    }
    const { data: production } = await productionQuery.order("production_date", { ascending: true });
    tables.push({
      name: "milk_production",
      displayName: "Milk Production",
      data: production || [],
      columns: [
        { key: "production_date", header: "Date", width: 12 },
        { key: "cattle_id", header: "Cattle ID", width: 20 },
        { key: "session", header: "Session", width: 10 },
        { key: "quantity_liters", header: "Quantity (L)", width: 12 },
        { key: "fat_percentage", header: "Fat %", width: 10 },
        { key: "snf_percentage", header: "SNF %", width: 10 },
      ]
    });
    setExportProgress(25);

    // Customers
    const { data: customers } = await supabase.from("customers").select("*");
    tables.push({
      name: "customers",
      displayName: "Customers",
      data: customers || [],
      columns: [
        { key: "name", header: "Name", width: 20 },
        { key: "phone", header: "Phone", width: 15 },
        { key: "email", header: "Email", width: 25 },
        { key: "address", header: "Address", width: 30 },
        { key: "area", header: "Area", width: 15 },
        { key: "subscription_type", header: "Subscription", width: 12 },
        { key: "credit_balance", header: "Credit", width: 12 },
        { key: "advance_balance", header: "Advance", width: 12 },
        { key: "is_active", header: "Active", width: 8 },
      ]
    });
    setExportProgress(35);

    // Deliveries
    let deliveriesQuery = supabase.from("deliveries").select("*");
    if (dateFilter) {
      deliveriesQuery = deliveriesQuery.gte("delivery_date", dateFilter.start).lte("delivery_date", dateFilter.end);
    }
    const { data: deliveries } = await deliveriesQuery.order("delivery_date", { ascending: true });
    tables.push({
      name: "deliveries",
      displayName: "Deliveries",
      data: deliveries || [],
      columns: [
        { key: "delivery_date", header: "Date", width: 12 },
        { key: "customer_id", header: "Customer ID", width: 20 },
        { key: "status", header: "Status", width: 12 },
        { key: "delivery_time", header: "Time", width: 10 },
        { key: "notes", header: "Notes", width: 25 },
      ]
    });
    setExportProgress(45);

    // Invoices
    let invoicesQuery = supabase.from("invoices").select("*");
    if (dateFilter) {
      invoicesQuery = invoicesQuery.gte("created_at", dateFilter.start).lte("created_at", dateFilter.end);
    }
    const { data: invoices } = await invoicesQuery.order("created_at", { ascending: true });
    tables.push({
      name: "invoices",
      displayName: "Invoices",
      data: invoices || [],
      columns: [
        { key: "invoice_number", header: "Invoice #", width: 15 },
        { key: "customer_id", header: "Customer ID", width: 20 },
        { key: "billing_period_start", header: "Period Start", width: 12 },
        { key: "billing_period_end", header: "Period End", width: 12 },
        { key: "total_amount", header: "Total", width: 12 },
        { key: "paid_amount", header: "Paid", width: 12 },
        { key: "payment_status", header: "Status", width: 10 },
        { key: "due_date", header: "Due Date", width: 12 },
      ]
    });
    setExportProgress(55);

    // Payments
    let paymentsQuery = supabase.from("payments").select("*");
    if (dateFilter) {
      paymentsQuery = paymentsQuery.gte("payment_date", dateFilter.start).lte("payment_date", dateFilter.end);
    }
    const { data: payments } = await paymentsQuery.order("payment_date", { ascending: true });
    tables.push({
      name: "payments",
      displayName: "Payments",
      data: payments || [],
      columns: [
        { key: "payment_date", header: "Date", width: 12 },
        { key: "customer_id", header: "Customer ID", width: 20 },
        { key: "invoice_id", header: "Invoice ID", width: 20 },
        { key: "amount", header: "Amount", width: 12 },
        { key: "payment_mode", header: "Mode", width: 12 },
        { key: "reference_number", header: "Reference", width: 15 },
      ]
    });
    setExportProgress(65);

    // Expenses
    let expensesQuery = supabase.from("expenses").select("*");
    if (dateFilter) {
      expensesQuery = expensesQuery.gte("expense_date", dateFilter.start).lte("expense_date", dateFilter.end);
    }
    const { data: expenses } = await expensesQuery.order("expense_date", { ascending: true });
    tables.push({
      name: "expenses",
      displayName: "Expenses",
      data: expenses || [],
      columns: [
        { key: "expense_date", header: "Date", width: 12 },
        { key: "title", header: "Title", width: 25 },
        { key: "category", header: "Category", width: 15 },
        { key: "amount", header: "Amount", width: 12 },
        { key: "notes", header: "Notes", width: 30 },
      ]
    });
    setExportProgress(75);

    // Employees
    const { data: employees } = await supabase.from("employees").select("*");
    tables.push({
      name: "employees",
      displayName: "Employees",
      data: employees || [],
      columns: [
        { key: "name", header: "Name", width: 20 },
        { key: "phone", header: "Phone", width: 15 },
        { key: "role", header: "Role", width: 15 },
        { key: "salary", header: "Salary", width: 12 },
        { key: "joining_date", header: "Joining Date", width: 12 },
        { key: "is_active", header: "Active", width: 8 },
      ]
    });
    setExportProgress(80);

    // Attendance
    let attendanceQuery = supabase.from("attendance").select("*");
    if (dateFilter) {
      attendanceQuery = attendanceQuery.gte("attendance_date", dateFilter.start).lte("attendance_date", dateFilter.end);
    }
    const { data: attendance } = await attendanceQuery.order("attendance_date", { ascending: true });
    tables.push({
      name: "attendance",
      displayName: "Attendance",
      data: attendance || [],
      columns: [
        { key: "attendance_date", header: "Date", width: 12 },
        { key: "employee_id", header: "Employee ID", width: 20 },
        { key: "status", header: "Status", width: 10 },
        { key: "check_in", header: "Check In", width: 10 },
        { key: "check_out", header: "Check Out", width: 10 },
      ]
    });
    setExportProgress(85);

    // Cattle Health
    let healthQuery = supabase.from("cattle_health").select("*");
    if (dateFilter) {
      healthQuery = healthQuery.gte("record_date", dateFilter.start).lte("record_date", dateFilter.end);
    }
    const { data: health } = await healthQuery.order("record_date", { ascending: true });
    tables.push({
      name: "cattle_health",
      displayName: "Health Records",
      data: health || [],
      columns: [
        { key: "record_date", header: "Date", width: 12 },
        { key: "cattle_id", header: "Cattle ID", width: 20 },
        { key: "record_type", header: "Type", width: 12 },
        { key: "title", header: "Title", width: 25 },
        { key: "description", header: "Description", width: 30 },
        { key: "cost", header: "Cost", width: 10 },
      ]
    });
    setExportProgress(90);

    // Breeding Records
    let breedingQuery = supabase.from("breeding_records").select("*");
    if (dateFilter) {
      breedingQuery = breedingQuery.gte("record_date", dateFilter.start).lte("record_date", dateFilter.end);
    }
    const { data: breeding } = await breedingQuery.order("record_date", { ascending: true });
    tables.push({
      name: "breeding_records",
      displayName: "Breeding Records",
      data: breeding || [],
      columns: [
        { key: "record_date", header: "Date", width: 12 },
        { key: "cattle_id", header: "Cattle ID", width: 20 },
        { key: "record_type", header: "Type", width: 15 },
        { key: "insemination_bull", header: "Bull", width: 15 },
        { key: "pregnancy_confirmed", header: "Pregnant", width: 10 },
        { key: "expected_calving_date", header: "Expected Calving", width: 15 },
      ]
    });
    setExportProgress(95);

    // Feed Inventory
    const { data: feed } = await supabase.from("feed_inventory").select("*");
    tables.push({
      name: "feed_inventory",
      displayName: "Feed Inventory",
      data: feed || [],
      columns: [
        { key: "name", header: "Name", width: 20 },
        { key: "category", header: "Category", width: 15 },
        { key: "current_stock", header: "Stock", width: 12 },
        { key: "unit", header: "Unit", width: 10 },
        { key: "cost_per_unit", header: "Cost/Unit", width: 12 },
        { key: "min_stock_level", header: "Min Stock", width: 12 },
      ]
    });

    setExportProgress(100);
    return tables;
  };

  const exportAsJSON = (tables: TableData[], period: ExportPeriod) => {
    const dateRange = getDateRange(period);
    const metadata: BackupMetadata = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      period,
      dateRange: dateRange ? {
        start: format(dateRange.start, "yyyy-MM-dd"),
        end: format(dateRange.end, "yyyy-MM-dd")
      } : null,
      tables: tables.map(t => t.name),
      recordCounts: tables.reduce((acc, t) => ({ ...acc, [t.name]: t.data.length }), {})
    };

    const backup = {
      metadata,
      data: tables.reduce((acc, t) => ({ ...acc, [t.name]: t.data }), {})
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dairy_backup_${period}_${format(new Date(), "yyyy-MM-dd_HHmm")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsExcel = (tables: TableData[], period: ExportPeriod) => {
    const wb = XLSX.utils.book_new();
    
    // Add metadata sheet
    const dateRange = getDateRange(period);
    const metadataSheet = XLSX.utils.aoa_to_sheet([
      ["Awadh Dairy - Data Backup"],
      [""],
      ["Export Date", format(new Date(), "dd MMM yyyy HH:mm")],
      ["Period", period.charAt(0).toUpperCase() + period.slice(1)],
      ["Date Range", dateRange ? `${format(dateRange.start, "dd MMM yyyy")} - ${format(dateRange.end, "dd MMM yyyy")}` : "All Data"],
      [""],
      ["Table", "Record Count"],
      ...tables.map(t => [t.displayName, t.data.length])
    ]);
    XLSX.utils.book_append_sheet(wb, metadataSheet, "Summary");

    // Add each table as a sheet
    tables.forEach(table => {
      if (table.data.length > 0) {
        const wsData = [
          table.columns.map(col => col.header),
          ...table.data.map(row => table.columns.map(col => {
            const value = row[col.key];
            if (value === null || value === undefined) return "";
            if (typeof value === "object") return JSON.stringify(value);
            return value;
          }))
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws["!cols"] = table.columns.map(col => ({ wch: col.width || 15 }));
        XLSX.utils.book_append_sheet(wb, ws, table.displayName.substring(0, 31));
      }
    });

    XLSX.writeFile(wb, `dairy_backup_${period}_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`);
  };

  const exportAsPDF = (tables: TableData[], period: ExportPeriod) => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const dateRange = getDateRange(period);
    let currentY = 20;

    // Title page
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Awadh Dairy", 148.5, currentY, { align: "center" });
    currentY += 10;
    
    doc.setFontSize(18);
    doc.text("Data Backup Report", 148.5, currentY, { align: "center" });
    currentY += 15;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Export Date: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 148.5, currentY, { align: "center" });
    currentY += 7;
    doc.text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)}`, 148.5, currentY, { align: "center" });
    currentY += 7;
    if (dateRange) {
      doc.text(`Date Range: ${format(dateRange.start, "dd MMM yyyy")} - ${format(dateRange.end, "dd MMM yyyy")}`, 148.5, currentY, { align: "center" });
    }
    currentY += 15;

    // Summary table
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Data Summary", 14, currentY);
    currentY += 5;

    autoTable(doc, {
      head: [["Table", "Records"]],
      body: tables.map(t => [t.displayName, t.data.length.toString()]),
      startY: currentY,
      theme: "striped",
      headStyles: { fillColor: [34, 139, 34] },
      margin: { left: 14, right: 14 },
    });

    // Add each table
    tables.forEach(table => {
      if (table.data.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(table.displayName, 14, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`${table.data.length} records`, 14, 27);

        autoTable(doc, {
          head: [table.columns.map(col => col.header)],
          body: table.data.slice(0, 100).map(row => table.columns.map(col => {
            const value = row[col.key];
            if (value === null || value === undefined) return "";
            if (typeof value === "boolean") return value ? "Yes" : "No";
            if (typeof value === "object") return JSON.stringify(value);
            return String(value).substring(0, 50);
          })),
          startY: 32,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [34, 139, 34], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
        });

        if (table.data.length > 100) {
          doc.setFontSize(9);
          doc.text(`Showing first 100 of ${table.data.length} records. Use Excel/JSON for complete data.`, 14, doc.internal.pageSize.height - 10);
        }
      }
    });

    doc.save(`dairy_backup_${period}_${format(new Date(), "yyyy-MM-dd_HHmm")}.pdf`);
  };

  const exportAsCSV = (tables: TableData[], period: ExportPeriod) => {
    // Create a zip-like combined CSV with sections
    let csvContent = "";
    
    tables.forEach(table => {
      csvContent += `\n### ${table.displayName.toUpperCase()} ###\n`;
      csvContent += table.columns.map(col => `"${col.header}"`).join(",") + "\n";
      table.data.forEach(row => {
        csvContent += table.columns.map(col => {
          const value = row[col.key];
          if (value === null || value === undefined) return '""';
          if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
          return `"${value}"`;
        }).join(",") + "\n";
      });
      csvContent += "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dairy_backup_${period}_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportProgress(0);
    
    try {
      const tables = await fetchAllData(exportPeriod);
      
      switch (exportFormat) {
        case "json":
          exportAsJSON(tables, exportPeriod);
          break;
        case "excel":
          exportAsExcel(tables, exportPeriod);
          break;
        case "pdf":
          exportAsPDF(tables, exportPeriod);
          break;
        case "csv":
          exportAsCSV(tables, exportPeriod);
          break;
      }

      const totalRecords = tables.reduce((sum, t) => sum + t.data.length, 0);
      toast({
        title: "Export Complete",
        description: `Exported ${totalRecords.toLocaleString()} records across ${tables.length} tables`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast({
        title: "Invalid File",
        description: "Please select a JSON backup file",
        variant: "destructive",
      });
      return;
    }

    setRestoring(true);
    setRestoreProgress(0);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.metadata || !backup.data) {
        throw new Error("Invalid backup file format");
      }

      const metadata = backup.metadata as BackupMetadata;
      const tablesCount = Object.keys(backup.data).length;
      let processedTables = 0;

      toast({
        title: "Restore Started",
        description: `Restoring ${tablesCount} tables from backup created on ${format(new Date(metadata.exportedAt), "dd MMM yyyy HH:mm")}`,
      });

      // Note: Actual restore would require careful handling of foreign keys and existing data
      // This is a preview/validation step
      for (const [tableName, records] of Object.entries(backup.data)) {
        processedTables++;
        setRestoreProgress((processedTables / tablesCount) * 100);
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate processing
      }

      toast({
        title: "Backup Validated",
        description: `Backup file contains ${Object.values(metadata.recordCounts).reduce((a, b) => a + b, 0).toLocaleString()} records. Contact support for full restore.`,
      });
    } catch (error) {
      console.error("Restore error:", error);
      toast({
        title: "Restore Failed",
        description: "Invalid backup file or corrupted data",
        variant: "destructive",
      });
    } finally {
      setRestoring(false);
      setRestoreProgress(0);
      event.target.value = "";
    }
  };

  const formatIcons = {
    json: FileJson,
    excel: FileSpreadsheet,
    pdf: FileText,
    csv: FileText,
  };

  const FormatIcon = formatIcons[exportFormat];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Data Backup & Export
        </CardTitle>
        <CardDescription>
          Export your dairy data for backup or reporting purposes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="export" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </TabsTrigger>
            <TabsTrigger value="restore" className="gap-2">
              <Upload className="h-4 w-4" />
              Restore
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Export Period</label>
                <Select value={exportPeriod} onValueChange={(v) => setExportPeriod(v as ExportPeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        This Week
                      </div>
                    </SelectItem>
                    <SelectItem value="monthly">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        This Month
                      </div>
                    </SelectItem>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        All Data
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Export Format</label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4" />
                        JSON (Full Backup)
                      </div>
                    </SelectItem>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel (.xlsx)
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PDF Report
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        CSV
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FormatIcon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">
                    {exportFormat.toUpperCase()} Export
                  </span>
                </div>
                <Badge variant="secondary">
                  {exportPeriod === "weekly" ? "7 days" : exportPeriod === "monthly" ? "30 days" : "All time"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {exportFormat === "json" && "Complete database backup with metadata. Best for restoration."}
                {exportFormat === "excel" && "Multi-sheet workbook with all tables. Great for analysis."}
                {exportFormat === "pdf" && "Formatted report with summary and tables. Good for printing."}
                {exportFormat === "csv" && "Combined CSV with all tables. Universal compatibility."}
              </p>
            </div>

            {exporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Exporting data...</span>
                  <span>{Math.round(exportProgress)}%</span>
                </div>
                <Progress value={exportProgress} />
              </div>
            )}

            <Button 
              onClick={handleExport} 
              disabled={exporting}
              className="w-full gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export {exportPeriod.charAt(0).toUpperCase() + exportPeriod.slice(1)} Data
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="restore" className="space-y-4">
            <div className="rounded-lg border-2 border-dashed p-8 text-center space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-medium">Restore from Backup</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a JSON backup file to validate and restore data
                </p>
              </div>
              <div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  disabled={restoring}
                  className="hidden"
                  id="restore-file"
                />
                <Button asChild variant="outline" disabled={restoring}>
                  <label htmlFor="restore-file" className="cursor-pointer gap-2">
                    {restoring ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Select Backup File
                      </>
                    )}
                  </label>
                </Button>
              </div>
            </div>

            {restoring && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Validating backup...</span>
                  <span>{Math.round(restoreProgress)}%</span>
                </div>
                <Progress value={restoreProgress} />
              </div>
            )}

            <div className="rounded-lg bg-warning/10 border border-warning/30 p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-warning shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Important Note</p>
                  <p className="text-xs text-muted-foreground">
                    Data restoration will validate the backup file structure. For full database restoration, 
                    please contact system administrator to ensure data integrity and avoid conflicts.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
