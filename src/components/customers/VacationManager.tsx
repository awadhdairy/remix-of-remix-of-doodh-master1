import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, isWithinInterval, parseISO, isBefore } from "date-fns";
import { Calendar, Trash2, Plus, Loader2, Palmtree } from "lucide-react";

interface Vacation {
  id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
}

interface VacationManagerProps {
  customerId: string;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VacationManager({
  customerId,
  customerName,
  open,
  onOpenChange,
}: VacationManagerProps) {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && customerId) {
      fetchVacations();
    }
  }, [open, customerId]);

  const fetchVacations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_vacations")
      .select("*")
      .eq("customer_id", customerId)
      .order("start_date", { ascending: false });

    if (error) {
      toast({
        title: "Error fetching vacations",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setVacations(data || []);
    }
    setLoading(false);
  };

  const handleAddVacation = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Validation Error",
        description: "Start and end dates are required",
        variant: "destructive",
      });
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast({
        title: "Validation Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("customer_vacations").insert({
      customer_id: customerId,
      start_date: startDate,
      end_date: endDate,
      reason: reason || null,
    });

    setSaving(false);

    if (error) {
      toast({
        title: "Error adding vacation",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Vacation added",
        description: `Pause scheduled from ${format(parseISO(startDate), "MMM dd")} to ${format(parseISO(endDate), "MMM dd")}`,
      });
      setStartDate("");
      setEndDate("");
      setReason("");
      fetchVacations();
    }
  };

  const handleDeleteVacation = async (id: string) => {
    const { error } = await supabase
      .from("customer_vacations")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error deleting vacation",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Vacation removed" });
      fetchVacations();
    }
  };

  const getVacationStatus = (vacation: Vacation) => {
    const today = new Date();
    const start = parseISO(vacation.start_date);
    const end = parseISO(vacation.end_date);

    if (isWithinInterval(today, { start, end })) {
      return { label: "Active", variant: "default" as const };
    } else if (isBefore(end, today)) {
      return { label: "Completed", variant: "secondary" as const };
    } else {
      return { label: "Upcoming", variant: "outline" as const };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palmtree className="h-5 w-5" />
            Vacation/Pause Management - {customerName}
          </DialogTitle>
        </DialogHeader>

        {/* Add New Vacation Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Schedule New Pause</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Out of town, Festival..."
                rows={2}
              />
            </div>
            <Button
              className="mt-4 w-full"
              onClick={handleAddVacation}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Pause Period
            </Button>
          </CardContent>
        </Card>

        {/* Existing Vacations List */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Scheduled Pauses ({vacations.length})
          </h4>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : vacations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No vacation/pause periods scheduled
            </div>
          ) : (
            vacations.map((vacation) => {
              const status = getVacationStatus(vacation);
              return (
                <Card key={vacation.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {format(parseISO(vacation.start_date), "MMM dd, yyyy")}
                            </span>
                            <span className="text-muted-foreground">to</span>
                            <span className="font-medium">
                              {format(parseISO(vacation.end_date), "MMM dd, yyyy")}
                            </span>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          {vacation.reason && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {vacation.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteVacation(vacation.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
