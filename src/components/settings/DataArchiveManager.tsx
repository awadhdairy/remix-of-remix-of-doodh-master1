import { useState } from "react";
import { invokeExternalFunctionWithSession } from "@/lib/external-supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Trash2,
  Eye,
  Download,
  AlertTriangle,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { format, subYears } from "date-fns";
import { exportToExcel } from "@/lib/export";

interface TablePreview {
  table: string;
  label: string;
  count: number;
  dateColumn: string;
  category: "safe" | "financial" | "audit";
}

interface ArchiveResult {
  success: boolean;
  deleted: Record<string, number>;
  errors: string[];
  totalDeleted: number;
}

const ARCHIVABLE_TABLES: { table: string; label: string; dateColumn: string; category: "safe" | "financial" | "audit" }[] = [
  { table: "activity_logs", label: "Activity Logs", dateColumn: "created_at", category: "audit" },
  { table: "attendance", label: "Attendance Records", dateColumn: "attendance_date", category: "safe" },
  { table: "bottle_transactions", label: "Bottle Transactions", dateColumn: "transaction_date", category: "safe" },
  { table: "breeding_records", label: "Breeding Records", dateColumn: "record_date", category: "safe" },
  { table: "cattle_health", label: "Cattle Health Records", dateColumn: "record_date", category: "safe" },
  { table: "deliveries", label: "Deliveries", dateColumn: "delivery_date", category: "safe" },
  { table: "feed_consumption", label: "Feed Consumption", dateColumn: "consumption_date", category: "safe" },
  { table: "maintenance_records", label: "Maintenance Records", dateColumn: "maintenance_date", category: "safe" },
  { table: "milk_procurement", label: "Milk Procurement", dateColumn: "procurement_date", category: "safe" },
  { table: "milk_production", label: "Milk Production", dateColumn: "production_date", category: "safe" },
  { table: "notification_logs", label: "Notification Logs", dateColumn: "created_at", category: "audit" },
  { table: "invoices", label: "Invoices (Paid Only)", dateColumn: "created_at", category: "financial" },
  { table: "expenses", label: "Expenses", dateColumn: "expense_date", category: "financial" },
  { table: "payments", label: "Payments", dateColumn: "payment_date", category: "financial" },
  { table: "payroll_records", label: "Payroll Records", dateColumn: "pay_period_start", category: "financial" },
  { table: "vendor_payments", label: "Vendor Payments", dateColumn: "payment_date", category: "financial" },
];

export function DataArchiveManager() {
  const [retentionYears, setRetentionYears] = useState<string>("2");
  const [previews, setPreviews] = useState<TablePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<ArchiveResult | null>(null);
  const { toast } = useToast();

  const isFactoryReset = retentionYears === "0";
  const cutoffDate = isFactoryReset ? new Date() : subYears(new Date(), parseInt(retentionYears));

  const handlePreview = async () => {
    setPreviewing(true);
    setPreviews([]);
    setResult(null);

    try {
      const response = await invokeExternalFunctionWithSession<{
        error?: string;
        counts?: Record<string, number>;
      }>("archive-old-data", {
        mode: "preview",
        retention_years: parseInt(retentionYears),
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to preview data");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      const previewData: TablePreview[] = ARCHIVABLE_TABLES.map((t) => ({
        ...t,
        count: response.data.counts?.[t.table] || 0,
      }));

      setPreviews(previewData);
      
      const totalCount = previewData.reduce((sum, p) => sum + p.count, 0);
      toast({
        title: "Preview Complete",
        description: isFactoryReset 
          ? `Found ${totalCount.toLocaleString()} total records to delete`
          : `Found ${totalCount.toLocaleString()} records older than ${retentionYears} year(s)`,
      });
    } catch (error: any) {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to preview archivable data",
        variant: "destructive",
      });
    } finally {
      setPreviewing(false);
    }
  };

  const handleExportBeforeDelete = async () => {
    if (previews.length === 0) {
      toast({
        title: "No data to export",
        description: "Please run preview first",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const response = await invokeExternalFunctionWithSession<{
        error?: string;
        export?: Record<string, unknown[]>;
      }>("archive-old-data", {
        mode: "export",
        retention_years: parseInt(retentionYears),
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to export data");
      }

      if (response.data?.export) {
        // Convert to Excel
        const exportData = Object.entries(response.data.export).flatMap(([table, records]: [string, any]) => {
          return (records as any[]).map((record) => ({
            _table: table,
            ...record,
          }));
        });

        if (exportData.length > 0) {
          const columns = Object.keys(exportData[0]).map((key) => ({
            key,
            header: key.replace(/_/g, " ").toUpperCase(),
          }));
          
          const filename = isFactoryReset 
            ? `factory-reset-backup-${format(new Date(), "yyyy-MM-dd")}`
            : `archive-backup-${format(new Date(), "yyyy-MM-dd")}`;
          
          exportToExcel(
            exportData,
            columns,
            filename
          );

          toast({
            title: "Export Complete",
            description: `Exported ${exportData.length.toLocaleString()} records to Excel`,
          });
        } else {
          toast({
            title: "No Data",
            description: "No records found to export",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleArchive = async () => {
    if (!pin || pin.length !== 6) {
      toast({
        title: "PIN Required",
        description: "Please enter your 6-digit PIN to confirm",
        variant: "destructive",
      });
      return;
    }

    // Extra validation for factory reset
    if (isFactoryReset && confirmText !== "DELETE ALL") {
      toast({
        title: "Confirmation Required",
        description: 'Please type "DELETE ALL" to confirm complete reset',
        variant: "destructive",
      });
      return;
    }

    setArchiving(true);
    setProgress(0);
    setResult(null);

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 5, 90));
      }, 500);

      const response = await invokeExternalFunctionWithSession<{
        error?: string;
        deleted?: Record<string, number>;
        errors?: string[];
        totalDeleted?: number;
      }>("archive-old-data", {
        mode: "execute",
        retention_years: parseInt(retentionYears),
        pin,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.error) {
        throw new Error(response.error.message || "Failed to archive data");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setResult({
        success: true,
        deleted: response.data.deleted || {},
        errors: response.data.errors || [],
        totalDeleted: response.data.totalDeleted || 0,
      });

      setConfirmOpen(false);
      setPin("");
      setConfirmText("");
      setPreviews([]);

      toast({
        title: isFactoryReset ? "Factory Reset Complete" : "Archive Complete",
        description: `Successfully deleted ${response.data.totalDeleted?.toLocaleString() || 0} records`,
      });
    } catch (error: any) {
      setResult({
        success: false,
        deleted: {},
        errors: [error.message],
        totalDeleted: 0,
      });
      toast({
        title: isFactoryReset ? "Factory Reset Failed" : "Archive Failed",
        description: error.message || "Failed to archive data",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  };

  const totalRecords = previews.reduce((sum, p) => sum + p.count, 0);
  const safeRecords = previews.filter((p) => p.category === "safe").reduce((sum, p) => sum + p.count, 0);
  const financialRecords = previews.filter((p) => p.category === "financial").reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Retention & Cleanup
          </CardTitle>
          <CardDescription>
            Remove old historical data to maintain database performance. Data older than the retention period will be permanently deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Retention Period Selector */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label htmlFor="retention">Keep data from last</Label>
              <Select value={retentionYears} onValueChange={(val) => {
                setRetentionYears(val);
                setPreviews([]);
                setResult(null);
                setConfirmText("");
              }}>
                <SelectTrigger id="retention">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="0" className="text-destructive font-semibold">
                    <span className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4" />
                      Clear All (Factory Reset)
                    </span>
                  </SelectItem>
                  <SelectItem value="1">1 Year</SelectItem>
                  <SelectItem value="2">2 Years</SelectItem>
                  <SelectItem value="3">3 Years</SelectItem>
                  <SelectItem value="5">5 Years</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <Calendar className="inline h-3 w-3 mr-1" />
                {isFactoryReset 
                  ? "ALL transactional records will be deleted"
                  : `Records before ${format(cutoffDate, "MMMM d, yyyy")} will be deleted`
                }
              </p>
            </div>

            <Button onClick={handlePreview} disabled={previewing} className="gap-2">
              {previewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview Data
            </Button>
          </div>

          {/* Factory Reset Critical Warning */}
          {isFactoryReset && (
            <Alert variant="destructive" className="border-2 border-destructive bg-destructive/10">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-lg font-bold">⚠️ COMPLETE DATA RESET</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p className="font-medium">
                  This will delete ALL transactional data including today's records.
                </p>
                <p>
                  Only master data (customers, cattle, products, users, routes) will be preserved.
                </p>
                <p className="font-bold text-destructive">
                  THIS ACTION CANNOT BE UNDONE. Export a backup before proceeding!
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Standard Warning */}
          {!isFactoryReset && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Irreversible Action</AlertTitle>
              <AlertDescription>
                Deleted data cannot be recovered. Always export a backup before proceeding. 
                Financial records (invoices, payments, expenses) are subject to legal retention requirements.
              </AlertDescription>
            </Alert>
          )}

          {/* Preview Results */}
          {previews.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">
                  {isFactoryReset ? "All Records to be Deleted" : "Records to be Deleted"}
                </h4>
                <div className="flex gap-2">
                  <Badge variant={isFactoryReset ? "destructive" : "outline"} className="gap-1">
                    <span className="font-normal">Total:</span> {totalRecords.toLocaleString()}
                  </Badge>
                </div>
              </div>

              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Table</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Records</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previews.filter((p) => p.count > 0).map((preview) => (
                      <TableRow key={preview.table}>
                        <TableCell className="font-medium">{preview.label}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              preview.category === "financial"
                                ? "destructive"
                                : preview.category === "audit"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {preview.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {preview.count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {previews.every((p) => p.count === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          {isFactoryReset 
                            ? "No transactional records found in the system"
                            : `No records found older than ${retentionYears} year(s)`
                          }
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Action Buttons */}
              {totalRecords > 0 && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={handleExportBeforeDelete}
                    disabled={exporting}
                    className="gap-2"
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isFactoryReset ? "Export Full Backup (Required)" : "Export Backup (Excel)"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmOpen(true)}
                    className="gap-2"
                  >
                    {isFactoryReset ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {isFactoryReset 
                      ? `Factory Reset (${totalRecords.toLocaleString()} Records)`
                      : `Delete ${totalRecords.toLocaleString()} Records`
                    }
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Result Display */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.success 
                  ? (isFactoryReset ? "Factory Reset Complete" : "Cleanup Complete")
                  : (isFactoryReset ? "Factory Reset Failed" : "Cleanup Failed")
                }
              </AlertTitle>
              <AlertDescription>
                {result.success ? (
                  <div className="mt-2">
                    <p>Deleted {result.totalDeleted.toLocaleString()} records:</p>
                    <ul className="mt-1 text-sm">
                      {Object.entries(result.deleted)
                        .filter(([, count]) => count > 0)
                        .map(([table, count]) => (
                          <li key={table}>
                            • {table}: {count.toLocaleString()}
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : (
                  <p>{result.errors.join(", ")}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog with PIN */}
      <Dialog open={confirmOpen} onOpenChange={(open) => {
        setConfirmOpen(open);
        if (!open) {
          setPin("");
          setConfirmText("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isFactoryReset ? (
                <RotateCcw className="h-5 w-5 text-destructive" />
              ) : (
                <Shield className="h-5 w-5 text-destructive" />
              )}
              {isFactoryReset ? "Confirm Factory Reset" : "Confirm Data Deletion"}
            </DialogTitle>
            <DialogDescription>
              {isFactoryReset ? (
                <span className="text-destructive font-medium">
                  You are about to permanently delete ALL {totalRecords.toLocaleString()} transactional records. 
                  This will reset the system to a fresh state. This action cannot be undone.
                </span>
              ) : (
                <>
                  You are about to permanently delete {totalRecords.toLocaleString()} records
                  older than {format(cutoffDate, "MMMM d, yyyy")}. This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Summary:</p>
              <ul className="text-muted-foreground space-y-0.5">
                <li>• Historical data: {safeRecords.toLocaleString()} records</li>
                <li>• Financial records: {financialRecords.toLocaleString()} records</li>
                <li>• Audit logs: {previews.filter((p) => p.category === "audit").reduce((sum, p) => sum + p.count, 0).toLocaleString()} records</li>
              </ul>
            </div>

            {/* Extra confirmation for factory reset */}
            {isFactoryReset && (
              <div className="space-y-2">
                <Label htmlFor="confirm-text" className="text-destructive font-medium">
                  Type "DELETE ALL" to confirm complete reset
                </Label>
                <Input
                  id="confirm-text"
                  type="text"
                  placeholder="DELETE ALL"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  className="text-center text-lg tracking-widest uppercase border-destructive"
                />
                {confirmText && confirmText !== "DELETE ALL" && (
                  <p className="text-xs text-destructive">Please type exactly: DELETE ALL</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirm-pin">Enter your 6-digit PIN to confirm</Label>
              <Input
                id="confirm-pin"
                type="password"
                placeholder="••••••"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-lg tracking-widest"
              />
            </div>

            {archiving && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{isFactoryReset ? "Resetting system..." : "Deleting records..."}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setPin("");
                setConfirmText("");
              }}
              disabled={archiving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archiving || pin.length !== 6 || (isFactoryReset && confirmText !== "DELETE ALL")}
              className="gap-2"
            >
              {archiving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isFactoryReset ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isFactoryReset ? "Reset Everything" : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
