import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAutoDeliveryScheduler } from "@/hooks/useAutoDeliveryScheduler";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays } from "date-fns";
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

export function DeliveryAutomationCard() {
  const [loading, setLoading] = useState(false);
  const [cronLoading, setCronLoading] = useState(false);
  const [autoDeliverEnabled, setAutoDeliverEnabled] = useState(false);
  const [lastResult, setLastResult] = useState<{
    scheduled: number;
    skipped: number;
    autoDelivered: number;
    errors: string[];
  } | null>(null);
  const { toast } = useToast();
  const { 
    scheduleDeliveriesForDate, 
    autoDeliverPendingForDate 
  } = useAutoDeliveryScheduler();

  const today = format(new Date(), "yyyy-MM-dd");

  // Trigger the auto-delivery RPC directly
  const handleTriggerCronJob = async () => {
    setCronLoading(true);
    try {
      const { data, error } = await supabase.rpc('run_auto_delivery');

      if (error) throw error;

      // RPC returns the result directly - cast to proper type
      const result = data as { 
        success: boolean; 
        date: string;
        scheduled: number; 
        delivered: number; 
        skipped: number; 
        errors: string[]; 
      } | null;
      
      if (result) {
        toast({
          title: "Auto-delivery complete",
          description: `Delivered: ${result.delivered}, Scheduled: ${result.scheduled}, Skipped: ${result.skipped}`,
        });
        setLastResult({
          scheduled: result.scheduled,
          skipped: result.skipped,
          autoDelivered: result.delivered,
          errors: result.errors || [],
        });
      }
    } catch (error: any) {
      toast({
        title: "Error triggering auto-delivery",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCronLoading(false);
    }
  };

  const handleScheduleToday = async () => {
    setLoading(true);
    try {
      const result = await scheduleDeliveriesForDate(today, autoDeliverEnabled);
      setLastResult(result);

      if (result.errors.length > 0) {
        toast({
          title: "Scheduling completed with errors",
          description: `Scheduled: ${result.scheduled}, Errors: ${result.errors.length}`,
          variant: "destructive",
        });
      } else if (result.scheduled === 0) {
        toast({
          title: "No new deliveries",
          description: `All deliveries already scheduled or skipped (${result.skipped} customers)`,
        });
      } else {
        toast({
          title: "Deliveries scheduled",
          description: `Created ${result.scheduled} deliveries${result.autoDelivered > 0 ? ` (${result.autoDelivered} auto-delivered)` : ""}`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error scheduling deliveries",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDeliverPending = async () => {
    setLoading(true);
    try {
      const result = await autoDeliverPendingForDate(today);

      if (result.errors.length > 0) {
        toast({
          title: "Auto-deliver completed with errors",
          description: `Delivered: ${result.delivered}, Errors: ${result.errors.length}`,
          variant: "destructive",
        });
      } else if (result.delivered === 0) {
        toast({
          title: "No pending deliveries",
          description: "All deliveries for today are already processed",
        });
      } else {
        toast({
          title: "Auto-delivery complete",
          description: `Marked ${result.delivered} deliveries as delivered`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error with auto-delivery",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Schedule Today
          </Button>
          <Button
            variant="default"
            onClick={handleAutoDeliverPending}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
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
            disabled={cronLoading}
            className="w-full"
          >
            {cronLoading ? (
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
              {lastResult.autoDelivered > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1 text-warning" />
                  {lastResult.autoDelivered} auto-delivered
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
