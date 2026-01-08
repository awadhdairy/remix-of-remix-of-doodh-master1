import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMilkHistory, MilkHistoryRecord, DailyProductionTotal } from "@/hooks/useMilkHistory";
import { format } from "date-fns";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Sun, 
  Moon, 
  Droplets,
  Loader2,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MilkHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "cattle" | "daily";
  cattleId?: string;
  cattleName?: string;
  sessionFilter?: "morning" | "evening" | "total";
}

function TrendIndicator({ value, small = false }: { value: number | null; small?: boolean }) {
  if (value === null) return <span className="text-muted-foreground">-</span>;
  
  const iconSize = small ? "h-3 w-3" : "h-4 w-4";
  const textSize = small ? "text-xs" : "text-sm";
  
  if (value > 0) {
    return (
      <span className={cn("flex items-center gap-0.5 text-success", textSize)}>
        <TrendingUp className={iconSize} />
        +{value.toFixed(1)}L
      </span>
    );
  } else if (value < 0) {
    return (
      <span className={cn("flex items-center gap-0.5 text-destructive", textSize)}>
        <TrendingDown className={iconSize} />
        {value.toFixed(1)}L
      </span>
    );
  } else {
    return (
      <span className={cn("flex items-center gap-0.5 text-muted-foreground", textSize)}>
        <Minus className={iconSize} />
        0L
      </span>
    );
  }
}

function CattleHistoryRow({ record }: { record: MilkHistoryRecord }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center py-3 px-2 border-b last:border-b-0 hover:bg-muted/50">
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {format(new Date(record.date), "dd MMM yyyy")}
          </span>
        </div>
      </div>
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-warning" />
          <div>
            <span className="font-semibold">
              {record.morning !== null ? `${record.morning}L` : "-"}
            </span>
            {record.morningChange !== null && (
              <div className="mt-0.5">
                <TrendIndicator value={record.morningChange} small />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-info" />
          <div>
            <span className="font-semibold">
              {record.evening !== null ? `${record.evening}L` : "-"}
            </span>
            {record.eveningChange !== null && (
              <div className="mt-0.5">
                <TrendIndicator value={record.eveningChange} small />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="col-span-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-primary" />
          <div>
            <span className="font-bold text-primary">{record.total.toFixed(1)}L</span>
            {record.totalChange !== null && (
              <div className="mt-0.5">
                <TrendIndicator value={record.totalChange} small />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DailyTotalRow({ record, showSession }: { record: DailyProductionTotal; showSession?: "morning" | "evening" | "total" }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center py-3 px-2 border-b last:border-b-0 hover:bg-muted/50">
      <div className="col-span-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {format(new Date(record.date), "dd MMM yyyy")}
          </span>
        </div>
      </div>
      {(!showSession || showSession === "total") && (
        <>
          <div className="col-span-2">
            <div className="flex items-center gap-1">
              <Sun className="h-4 w-4 text-warning" />
              <span className="font-semibold">{record.morning.toFixed(1)}L</span>
            </div>
            {record.morningChange !== null && (
              <TrendIndicator value={record.morningChange} small />
            )}
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-1">
              <Moon className="h-4 w-4 text-info" />
              <span className="font-semibold">{record.evening.toFixed(1)}L</span>
            </div>
            {record.eveningChange !== null && (
              <TrendIndicator value={record.eveningChange} small />
            )}
          </div>
          <div className="col-span-4">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-primary" />
              <span className="font-bold text-lg text-primary">{record.total.toFixed(1)}L</span>
              {record.totalChange !== null && (
                <TrendIndicator value={record.totalChange} />
              )}
            </div>
          </div>
        </>
      )}
      {showSession === "morning" && (
        <div className="col-span-8">
          <div className="flex items-center gap-3">
            <Sun className="h-5 w-5 text-warning" />
            <span className="font-bold text-xl text-warning">{record.morning.toFixed(1)}L</span>
            {record.morningChange !== null && (
              <TrendIndicator value={record.morningChange} />
            )}
          </div>
        </div>
      )}
      {showSession === "evening" && (
        <div className="col-span-8">
          <div className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-info" />
            <span className="font-bold text-xl text-info">{record.evening.toFixed(1)}L</span>
            {record.eveningChange !== null && (
              <TrendIndicator value={record.eveningChange} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function MilkHistoryDialog({
  open,
  onOpenChange,
  mode,
  cattleId,
  cattleName,
  sessionFilter = "total",
}: MilkHistoryDialogProps) {
  const { loading, cattleHistory, dailyTotals, fetchCattleHistory, fetchDailyTotals } = useMilkHistory();
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    if (open) {
      if (mode === "cattle" && cattleId) {
        fetchCattleHistory(cattleId, days);
      } else if (mode === "daily") {
        const filter = sessionFilter === "total" ? undefined : sessionFilter;
        fetchDailyTotals(days, filter);
      }
    }
  }, [open, mode, cattleId, days, sessionFilter, fetchCattleHistory, fetchDailyTotals]);

  const getTitle = () => {
    if (mode === "cattle") {
      return `Milk Production History - ${cattleName || "Cattle"}`;
    }
    if (sessionFilter === "morning") return "Morning Session History";
    if (sessionFilter === "evening") return "Evening Session History";
    return "Daily Production History";
  };

  const getDescription = () => {
    if (mode === "cattle") {
      return "View daily milk production records with trend indicators";
    }
    return "View daily production totals with trend analysis";
  };

  const getIcon = () => {
    if (sessionFilter === "morning") return <Sun className="h-5 w-5 text-warning" />;
    if (sessionFilter === "evening") return <Moon className="h-5 w-5 text-info" />;
    return <Droplets className="h-5 w-5 text-primary" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="30" onValueChange={(v) => setDays(parseInt(v))}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="7">7 Days</TabsTrigger>
            <TabsTrigger value="30">30 Days</TabsTrigger>
            <TabsTrigger value="90">90 Days</TabsTrigger>
          </TabsList>

          <TabsContent value={days.toString()} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                {mode === "cattle" ? (
                  cattleHistory.length > 0 ? (
                    <div>
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-2 pb-2 text-sm font-medium text-muted-foreground border-b sticky top-0 bg-background">
                        <div className="col-span-3">Date</div>
                        <div className="col-span-3">Morning</div>
                        <div className="col-span-3">Evening</div>
                        <div className="col-span-3">Total</div>
                      </div>
                      {cattleHistory.map((record) => (
                        <CattleHistoryRow key={record.date} record={record} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No milk production records found for this period.
                    </div>
                  )
                ) : (
                  dailyTotals.length > 0 ? (
                    <div>
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-2 pb-2 text-sm font-medium text-muted-foreground border-b sticky top-0 bg-background">
                        <div className="col-span-4">Date</div>
                        {sessionFilter === "total" ? (
                          <>
                            <div className="col-span-2">Morning</div>
                            <div className="col-span-2">Evening</div>
                            <div className="col-span-4">Total</div>
                          </>
                        ) : (
                          <div className="col-span-8">
                            {sessionFilter === "morning" ? "Morning Production" : "Evening Production"}
                          </div>
                        )}
                      </div>
                      {dailyTotals.map((record) => (
                        <DailyTotalRow 
                          key={record.date} 
                          record={record} 
                          showSession={sessionFilter}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No production records found for this period.
                    </div>
                  )
                )}
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary Stats */}
        {!loading && (
          <div className="flex gap-4 pt-2 border-t">
            {mode === "cattle" && cattleHistory.length > 0 && (
              <>
                <Badge variant="secondary" className="gap-1">
                  <Sun className="h-3 w-3" />
                  Avg Morning: {(cattleHistory.reduce((sum, r) => sum + (r.morning || 0), 0) / cattleHistory.filter(r => r.morning !== null).length || 0).toFixed(1)}L
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Moon className="h-3 w-3" />
                  Avg Evening: {(cattleHistory.reduce((sum, r) => sum + (r.evening || 0), 0) / cattleHistory.filter(r => r.evening !== null).length || 0).toFixed(1)}L
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Droplets className="h-3 w-3" />
                  Total: {cattleHistory.reduce((sum, r) => sum + r.total, 0).toFixed(1)}L
                </Badge>
              </>
            )}
            {mode === "daily" && dailyTotals.length > 0 && (
              <>
                <Badge variant="secondary" className="gap-1">
                  Avg Daily: {(dailyTotals.reduce((sum, r) => sum + r.total, 0) / dailyTotals.length).toFixed(1)}L
                </Badge>
                <Badge variant="outline" className="gap-1">
                  Total ({days} days): {dailyTotals.reduce((sum, r) => sum + r.total, 0).toFixed(1)}L
                </Badge>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
