import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { invokeExternalFunction } from "@/lib/external-supabase";
import { format } from "date-fns";
import { 
  Truck, 
  Calendar, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  RefreshCw,
  Clock
} from "lucide-react";

interface DeliveryResult {
  scheduled: number;
  delivered: number;
  skipped: number;
  errors: string[];
}

export function DeliveryAutomationCard() {
  const [loading, setLoading] = useState<string | null>(null);
  const [autoDeliverEnabled, setAutoDeliverEnabled] = useState(false);
  const [lastResult, setLastResult] = useState<DeliveryResult | null>(null);
  const { toast } = useToast();

  const callEdgeFunction = async (mode: string, label: string) => {
    setLoading(mode);
    try {
      const { data, error } = await invokeExternalFunction<{
        success: boolean;
        result?: DeliveryResult;
      }>("auto-deliver-daily", { mode });

      if (error) throw error;
      if (!data?.success) throw new Error("Edge function returned failure");

      const result = data.result;
      if (result) {
        setLastResult(result);
        toast({
          title: `${label} complete`,
          description: `Scheduled: ${result.scheduled}, Delivered: ${result.delivered}, Skipped: ${result.skipped}${result.errors.length > 0 ? `, Errors: ${result.errors.length}` : ""}`,
          variant: result.errors.length > 0 ? "destructive" : "default",
        });
      }
    } catch (error: any) {
      toast({
        title: `Error: ${label}`,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleScheduleToday = () => {
    const mode = autoDeliverEnabled ? "full" : "schedule_only";
    callEdgeFunction(mode, autoDeliverEnabled ? "Schedule + Deliver" : "Schedule Today");
  };

  const handleAutoDeliverPending = () => {
    callEdgeFunction("auto_deliver_pending", "Auto-Deliver Pending");
  };

  const handleTriggerCronJob = () => {
    callEdgeFunction("full", "Full Auto-Delivery");
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-colored">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Delivery Automation</CardTitle>
              <CardDescription className="text-xs">
                Schedule and manage daily deliveries
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            <Calendar className="h-3 w-3 mr-1" />
            {format(new Date(), "dd MMM")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Auto-deliver toggle */}
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            <Label htmlFor="auto-deliver" className="text-sm font-medium cursor-pointer">
              Auto-mark as Delivered
            </Label>
          </div>
          <Switch
            id="auto-deliver"
            checked={autoDeliverEnabled}
            onCheckedChange={setAutoDeliverEnabled}
          />
        </div>

        {/* Action Buttons */}
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={handleScheduleToday}
            disabled={!!loading}
            className="w-full"
          >
            {loading === "schedule_only" || loading === "full" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Schedule Today
          </Button>
          <Button
            variant="default"
            onClick={handleAutoDeliverPending}
            disabled={!!loading}
            className="w-full"
          >
            {loading === "auto_deliver_pending" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Auto-Deliver All
          </Button>
        </div>

        {/* Cron Job Trigger */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Auto-runs daily at <span className="font-medium text-foreground">10:00 AM IST</span>
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTriggerCronJob}
            disabled={!!loading}
            className="w-full"
          >
            {loading === "full" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Zap className="mr-2 h-4 w-4" />
            )}
            Run Auto-Delivery Now
          </Button>
        </div>

        {/* Last Result */}
        {lastResult && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Last Run Result:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1 text-success" />
                {lastResult.scheduled} scheduled
              </Badge>
              {lastResult.delivered > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1 text-warning" />
                  {lastResult.delivered} delivered
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {lastResult.skipped} skipped
              </Badge>
              {lastResult.errors.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {lastResult.errors.length} errors
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Quick Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>• Subscription orders auto-marked as <span className="text-success font-medium">delivered</span> at 10 AM</p>
          <p>• Customers on vacation are automatically skipped</p>
          <p>• Manually marked as "missed" or "partial" are NOT changed</p>
        </div>
      </CardContent>
    </Card>
  );
}
