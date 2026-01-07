import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isSameMonth, addDays, differenceInDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  Heart, 
  Syringe, 
  Baby, 
  AlertCircle, 
  Stethoscope,
  Pill,
  Calendar as CalendarIcon,
  Filter,
  Clock,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBreedingAlerts } from "@/hooks/useBreedingAlerts";
import { BreedingAlertsPanel } from "./BreedingAlertsPanel";

interface Cattle {
  id: string;
  tag_number: string;
  name: string | null;
  expected_calving_date?: string | null;
  lactation_status?: string | null;
}

interface BreedingRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  record_date: string;
  heat_cycle_day?: number | null;
  expected_calving_date?: string | null;
  actual_calving_date?: string | null;
  pregnancy_confirmed?: boolean | null;
  notes?: string | null;
}

interface HealthRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  title: string;
  record_date: string;
  next_due_date?: string | null;
}

interface CalendarEvent {
  id: string;
  date: string;
  type: 'heat' | 'insemination' | 'pregnancy_check' | 'calving' | 'expected_calving' | 'vaccination' | 'health_check' | 'dry_off' | 'heat_expected';
  title: string;
  cattleId: string;
  cattleTag: string;
  details?: string;
  color: string;
  icon: any;
  priority: number;
}

interface BreedingCalendarProps {
  cattle: Cattle[];
  breedingRecords: BreedingRecord[];
  healthRecords: HealthRecord[];
}

const eventTypeConfig = {
  heat: { label: "Heat Detection", color: "bg-breeding-heat", icon: Heart, priority: 1 },
  heat_expected: { label: "Expected Heat", color: "bg-breeding-heat/60", icon: Heart, priority: 2 },
  insemination: { label: "AI/Insemination", color: "bg-breeding-insemination", icon: Syringe, priority: 1 },
  pregnancy_check: { label: "Pregnancy Check", color: "bg-breeding-pregnancy", icon: AlertCircle, priority: 1 },
  expected_calving: { label: "Expected Calving", color: "bg-warning", icon: Baby, priority: 1 },
  calving: { label: "Calving", color: "bg-breeding-calving", icon: Baby, priority: 1 },
  vaccination: { label: "Vaccination", color: "bg-health-vaccination", icon: Pill, priority: 2 },
  health_check: { label: "Health Check", color: "bg-health-checkup", icon: Stethoscope, priority: 2 },
  dry_off: { label: "Dry Off", color: "bg-role-delivery", icon: Clock, priority: 2 },
};

export function BreedingCalendar({ cattle, breedingRecords, healthRecords }: BreedingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [showAlerts, setShowAlerts] = useState(false);

  // Use the breeding alerts hook
  const { alerts, criticalCount, warningCount, upcomingCount } = useBreedingAlerts(
    breedingRecords,
    healthRecords,
    cattle.map(c => ({
      id: c.id,
      tag_number: c.tag_number,
      name: c.name,
      status: c.lactation_status === "lactating" ? "active" : "active",
      lactation_status: c.lactation_status || null,
    }))
  );

  const getCattleTag = (cattleId: string) => {
    const c = cattle.find(c => c.id === cattleId);
    return c ? `${c.tag_number}${c.name ? ` - ${c.name}` : ""}` : "Unknown";
  };

  // Generate all calendar events
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    // Process breeding records
    breedingRecords.forEach(record => {
      const cattleTag = getCattleTag(record.cattle_id);

      if (record.record_type === "heat_detection") {
        events.push({
          id: `heat-${record.id}`,
          date: record.record_date,
          type: "heat",
          title: "Heat Detected",
          cattleId: record.cattle_id,
          cattleTag,
          details: record.heat_cycle_day ? `Cycle Day ${record.heat_cycle_day}` : undefined,
          ...eventTypeConfig.heat,
        });

        // Calculate next expected heat (21 days cycle)
        const nextHeatDate = addDays(new Date(record.record_date), 21);
        if (nextHeatDate > new Date() && !record.actual_calving_date) {
          events.push({
            id: `heat-expected-${record.id}`,
            date: format(nextHeatDate, "yyyy-MM-dd"),
            type: "heat_expected",
            title: "Expected Heat",
            cattleId: record.cattle_id,
            cattleTag,
            details: "Based on 21-day cycle",
            ...eventTypeConfig.heat_expected,
          });
        }
      }

      if (record.record_type === "artificial_insemination") {
        events.push({
          id: `ai-${record.id}`,
          date: record.record_date,
          type: "insemination",
          title: "Artificial Insemination",
          cattleId: record.cattle_id,
          cattleTag,
          details: record.notes || undefined,
          ...eventTypeConfig.insemination,
        });
      }

      if (record.record_type === "pregnancy_check") {
        events.push({
          id: `preg-${record.id}`,
          date: record.record_date,
          type: "pregnancy_check",
          title: record.pregnancy_confirmed ? "Pregnancy Confirmed" : "Not Pregnant",
          cattleId: record.cattle_id,
          cattleTag,
          ...eventTypeConfig.pregnancy_check,
        });
      }

      if (record.record_type === "calving") {
        events.push({
          id: `calving-${record.id}`,
          date: record.actual_calving_date || record.record_date,
          type: "calving",
          title: "Calving Completed",
          cattleId: record.cattle_id,
          cattleTag,
          details: record.notes || undefined,
          ...eventTypeConfig.calving,
        });
      }

      // Expected calving dates
      if (record.expected_calving_date && !record.actual_calving_date) {
        events.push({
          id: `expected-calving-${record.id}`,
          date: record.expected_calving_date,
          type: "expected_calving",
          title: "Expected Calving",
          cattleId: record.cattle_id,
          cattleTag,
          ...eventTypeConfig.expected_calving,
        });

        // Calculate dry-off date (60 days before expected calving)
        const dryOffDate = addDays(new Date(record.expected_calving_date), -60);
        if (dryOffDate > new Date()) {
          events.push({
            id: `dryoff-${record.id}`,
            date: format(dryOffDate, "yyyy-MM-dd"),
            type: "dry_off",
            title: "Recommended Dry-Off",
            cattleId: record.cattle_id,
            cattleTag,
            details: "60 days before expected calving",
            ...eventTypeConfig.dry_off,
          });
        }
      }
    });

    // Process health records
    healthRecords.forEach(record => {
      const cattleTag = getCattleTag(record.cattle_id);

      if (record.record_type === "vaccination") {
        events.push({
          id: `vac-${record.id}`,
          date: record.record_date,
          type: "vaccination",
          title: record.title,
          cattleId: record.cattle_id,
          cattleTag,
          ...eventTypeConfig.vaccination,
        });

        if (record.next_due_date) {
          events.push({
            id: `vac-due-${record.id}`,
            date: record.next_due_date,
            type: "vaccination",
            title: `${record.title} Due`,
            cattleId: record.cattle_id,
            cattleTag,
            details: "Follow-up vaccination",
            ...eventTypeConfig.vaccination,
          });
        }
      } else {
        events.push({
          id: `health-${record.id}`,
          date: record.record_date,
          type: "health_check",
          title: record.title,
          cattleId: record.cattle_id,
          cattleTag,
          ...eventTypeConfig.health_check,
        });

        if (record.next_due_date) {
          events.push({
            id: `health-due-${record.id}`,
            date: record.next_due_date,
            type: "health_check",
            title: `${record.title} Due`,
            cattleId: record.cattle_id,
            cattleTag,
            ...eventTypeConfig.health_check,
          });
        }
      }
    });

    return events;
  }, [breedingRecords, healthRecords, cattle]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filterType === "all") return allEvents;
    return allEvents.filter(e => e.type === filterType);
  }, [allEvents, filterType]);

  // Calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get start day offset for proper calendar alignment
  const startDayOffset = monthStart.getDay();

  // Events for selected date
  const selectedDateEvents = selectedDate 
    ? filteredEvents.filter(e => isSameDay(new Date(e.date), selectedDate))
    : [];

  // Upcoming events (next 14 days)
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    const twoWeeksLater = addDays(today, 14);
    return filteredEvents
      .filter(e => {
        const eventDate = new Date(e.date);
        return eventDate >= today && eventDate <= twoWeeksLater;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [filteredEvents]);

  // Stats for current month
  const monthStats = useMemo(() => {
    const monthEvents = filteredEvents.filter(e => isSameMonth(new Date(e.date), currentDate));
    return {
      total: monthEvents.length,
      heat: monthEvents.filter(e => e.type === "heat" || e.type === "heat_expected").length,
      calvings: monthEvents.filter(e => e.type === "calving" || e.type === "expected_calving").length,
      health: monthEvents.filter(e => e.type === "vaccination" || e.type === "health_check").length,
    };
  }, [filteredEvents, currentDate]);

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(e => isSameDay(new Date(e.date), day));
  };

  return (
    <div className="space-y-4">
      {/* Alerts Banner */}
      {(criticalCount > 0 || warningCount > 0) && (
        <Card className={cn(
          "border-l-4",
          criticalCount > 0 ? "border-l-destructive bg-destructive/5" : "border-l-warning bg-warning/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className={cn("h-5 w-5", criticalCount > 0 ? "text-destructive" : "text-warning")} />
                <div>
                  <p className="font-medium">
                    {criticalCount > 0 ? `${criticalCount} critical alert${criticalCount > 1 ? 's' : ''} require attention` : `${warningCount} upcoming reminder${warningCount > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Heat cycles, vaccinations, and calvings that need your attention
                  </p>
                </div>
              </div>
              <Button variant={showAlerts ? "default" : "outline"} size="sm" onClick={() => setShowAlerts(!showAlerts)}>
                {showAlerts ? "Hide Alerts" : "View Alerts"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts Panel (collapsible) */}
      {showAlerts && (
        <BreedingAlertsPanel
          alerts={alerts}
          criticalCount={criticalCount}
          warningCount={warningCount}
          upcomingCount={upcomingCount}
          maxItems={15}
        />
      )}

      {/* Month Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{monthStats.total}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
        <Card className="bg-breeding-heat/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-breeding-heat">{monthStats.heat}</p>
            <p className="text-xs text-muted-foreground">Heat Events</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">{monthStats.calvings}</p>
            <p className="text-xs text-muted-foreground">Calvings</p>
          </CardContent>
        </Card>
        <Card className="bg-health-checkup/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-health-checkup">{monthStats.health}</p>
            <p className="text-xs text-muted-foreground">Health Tasks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-lg">
                  {format(currentDate, "MMMM yyyy")}
                </CardTitle>
                <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="heat">Heat Detection</SelectItem>
                    <SelectItem value="heat_expected">Expected Heat</SelectItem>
                    <SelectItem value="insemination">Insemination</SelectItem>
                    <SelectItem value="pregnancy_check">Pregnancy Check</SelectItem>
                    <SelectItem value="expected_calving">Expected Calving</SelectItem>
                    <SelectItem value="calving">Calving</SelectItem>
                    <SelectItem value="vaccination">Vaccination</SelectItem>
                    <SelectItem value="health_check">Health Check</SelectItem>
                    <SelectItem value="dry_off">Dry Off</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                  Today
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset */}
              {Array.from({ length: startDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square p-1" />
              ))}
              
              {/* Days */}
              {days.map(day => {
                const dayEvents = getEventsForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const hasEvents = dayEvents.length > 0;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square p-1 rounded-lg transition-all relative group hover:bg-muted",
                      isToday(day) && "ring-2 ring-primary",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                      !isSameMonth(day, currentDate) && "text-muted-foreground opacity-50"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium",
                      isSelected && "text-primary-foreground"
                    )}>
                      {format(day, "d")}
                    </span>
                    
                    {/* Event indicators */}
                    {hasEvents && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((event, i) => (
                          <span
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              event.color,
                              isSelected && "ring-1 ring-primary-foreground"
                            )}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              {Object.entries(eventTypeConfig).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className={cn("w-2 h-2 rounded-full", config.color)} />
                  <span className="text-muted-foreground">{config.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Selected Date Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate ? format(selectedDate, "EEEE, MMM d, yyyy") : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {selectedDate ? (
                  selectedDateEvents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDateEvents.map(event => {
                        const Icon = event.icon;
                        return (
                          <div
                            key={event.id}
                            className="flex items-start gap-2 p-2 rounded-lg border bg-card"
                          >
                            <div className={cn("p-1.5 rounded-md", event.color)}>
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{event.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{event.cattleTag}</p>
                              {event.details && (
                                <p className="text-xs text-muted-foreground mt-0.5">{event.details}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No events on this date
                    </p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Click on a date to view events
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Upcoming (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[280px]">
                {upcomingEvents.length > 0 ? (
                  <div className="space-y-2">
                    {upcomingEvents.map(event => {
                      const Icon = event.icon;
                      const daysFromNow = differenceInDays(new Date(event.date), new Date());
                      return (
                        <div
                          key={event.id}
                          className="flex items-start gap-2 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedDate(new Date(event.date))}
                        >
                          <div className={cn("p-1.5 rounded-md shrink-0", event.color)}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{event.title}</p>
                              <Badge variant={daysFromNow === 0 ? "destructive" : daysFromNow <= 3 ? "secondary" : "outline"} className="shrink-0 text-xs">
                                {daysFromNow === 0 ? "Today" : daysFromNow === 1 ? "Tomorrow" : `${daysFromNow}d`}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{event.cattleTag}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(event.date), "EEE, MMM d")}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No upcoming events
                  </p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
