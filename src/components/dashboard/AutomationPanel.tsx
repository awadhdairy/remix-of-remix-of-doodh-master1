import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAutoDeliveryScheduler } from "@/hooks/useAutoDeliveryScheduler";
import { useAutoInvoiceGenerator } from "@/hooks/useAutoInvoiceGenerator";
import { useCattleStatusAutomation } from "@/hooks/useCattleStatusAutomation";
import { 
  Zap, 
  Truck, 
  Receipt, 
  Beef, 
  Play, 
  Check,
  Loader2,
  RefreshCw,
  Calendar
} from "lucide-react";
import { format, addDays } from "date-fns";

interface AutomationResult {
  type: string;
  success: boolean;
  message: string;
  details?: string;
}

export function AutomationPanel() {
  const { toast } = useToast();
  const { scheduleDeliveriesForDate, scheduleDeliveriesForRange } = useAutoDeliveryScheduler();
  const { generateMonthlyInvoices } = useAutoInvoiceGenerator();
  const { runAutomation: runCattleAutomation } = useCattleStatusAutomation();
  
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<AutomationResult[]>([]);

  const handleScheduleTomorrowDeliveries = async () => {
    setRunning("deliveries-tomorrow");
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    
    const result = await scheduleDeliveriesForDate(tomorrow);
    
    setResults(prev => [...prev, {
      type: "Deliveries",
      success: result.errors.length === 0,
      message: `Scheduled ${result.scheduled} deliveries, skipped ${result.skipped}`,
      details: result.errors.join(", ") || undefined,
    }]);

    toast({
      title: "Delivery Scheduling Complete",
      description: `${result.scheduled} deliveries scheduled for ${format(addDays(new Date(), 1), "dd MMM")}`,
    });
    
    setRunning(null);
  };

  const handleScheduleWeekDeliveries = async () => {
    setRunning("deliveries-week");
    
    const results = await scheduleDeliveriesForRange(addDays(new Date(), 1), 7);
    const totalScheduled = results.reduce((sum, r) => sum + r.scheduled, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    
    setResults(prev => [...prev, {
      type: "Week Deliveries",
      success: true,
      message: `Scheduled ${totalScheduled} deliveries for next 7 days`,
      details: `${totalSkipped} skipped (vacation/existing)`,
    }]);

    toast({
      title: "Weekly Scheduling Complete",
      description: `${totalScheduled} deliveries scheduled for the next 7 days`,
    });
    
    setRunning(null);
  };

  const handleGenerateInvoices = async () => {
    setRunning("invoices");
    const now = new Date();
    
    const result = await generateMonthlyInvoices(now.getFullYear(), now.getMonth() + 1);
    
    setResults(prev => [...prev, {
      type: "Invoices",
      success: result.errors.length === 0,
      message: `Generated ${result.generated} invoices (₹${result.total_amount.toLocaleString()})`,
      details: result.skipped > 0 ? `${result.skipped} skipped (existing/no deliveries)` : undefined,
    }]);

    toast({
      title: "Invoice Generation Complete",
      description: `${result.generated} invoices generated totaling ₹${result.total_amount.toLocaleString()}`,
    });
    
    setRunning(null);
  };

  const handleCattleStatusSync = async () => {
    setRunning("cattle");
    
    const result = await runCattleAutomation();
    
    setResults(prev => [...prev, {
      type: "Cattle Status",
      success: result.errors.length === 0,
      message: `Updated ${result.updated} cattle records`,
      details: result.updates.map(u => `${u.tag_number}: ${u.old_value} → ${u.new_value}`).join(", ") || "No updates needed",
    }]);

    toast({
      title: "Cattle Status Sync Complete",
      description: result.updated > 0 
        ? `${result.updated} cattle status(es) updated automatically`
        : "All cattle statuses are up to date",
    });
    
    setRunning(null);
  };

  const handleRunAll = async () => {
    setRunning("all");
    setResults([]);

    // Run in sequence to avoid conflicts
    await handleCattleStatusSync();
    await handleScheduleTomorrowDeliveries();
    
    toast({
      title: "All Automations Complete",
      description: "System has been synchronized",
    });
    
    setRunning(null);
  };

  const clearResults = () => setResults([]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            <CardTitle className="text-lg">Automation Center</CardTitle>
          </div>
          {results.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearResults}>
              <RefreshCw className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
        <CardDescription>
          Run automated tasks to sync and schedule operations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={handleScheduleTomorrowDeliveries}
            disabled={running !== null}
          >
            {running === "deliveries-tomorrow" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Truck className="h-4 w-4 mr-2 text-info" />
            )}
            <div className="text-left">
              <div className="font-medium">Schedule Tomorrow</div>
              <div className="text-xs text-muted-foreground">Auto-create deliveries</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={handleScheduleWeekDeliveries}
            disabled={running !== null}
          >
            {running === "deliveries-week" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 mr-2 text-primary" />
            )}
            <div className="text-left">
              <div className="font-medium">Schedule Week</div>
              <div className="text-xs text-muted-foreground">Next 7 days</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={handleGenerateInvoices}
            disabled={running !== null}
          >
            {running === "invoices" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4 mr-2 text-success" />
            )}
            <div className="text-left">
              <div className="font-medium">Generate Invoices</div>
              <div className="text-xs text-muted-foreground">Monthly billing</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={handleCattleStatusSync}
            disabled={running !== null}
          >
            {running === "cattle" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Beef className="h-4 w-4 mr-2 text-warning" />
            )}
            <div className="text-left">
              <div className="font-medium">Sync Cattle Status</div>
              <div className="text-xs text-muted-foreground">Update lactation status</div>
            </div>
          </Button>
        </div>

        {/* Run All Button */}
        <Button
          className="w-full"
          onClick={handleRunAll}
          disabled={running !== null}
        >
          {running === "all" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run Daily Sync
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-sm font-medium">Recent Results</div>
            {results.slice(-4).map((result, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50"
              >
                {result.success ? (
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                ) : (
                  <Badge variant="destructive" className="text-xs">Error</Badge>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{result.type}</div>
                  <div className="text-muted-foreground truncate">{result.message}</div>
                  {result.details && (
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {result.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
