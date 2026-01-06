import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Heart, Baby, Syringe, Calendar, Loader2, AlertCircle, CalendarDays, List } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import { BreedingCalendar } from "@/components/breeding/BreedingCalendar";

interface Cattle {
  id: string;
  tag_number: string;
  name: string | null;
  cattle_type: string;
  lactation_status: string | null;
}

interface BreedingRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  record_date: string;
  heat_cycle_day: number | null;
  insemination_bull: string | null;
  insemination_technician: string | null;
  pregnancy_confirmed: boolean | null;
  expected_calving_date: string | null;
  actual_calving_date: string | null;
  calf_details: any;
  notes: string | null;
  created_at: string;
  cattle?: Cattle;
}

const recordTypeLabels: Record<string, { label: string; color: string; icon: any }> = {
  heat_detection: { label: "Heat Detection", color: "bg-pink-500", icon: Heart },
  artificial_insemination: { label: "Artificial Insemination", color: "bg-blue-500", icon: Syringe },
  pregnancy_check: { label: "Pregnancy Check", color: "bg-purple-500", icon: AlertCircle },
  calving: { label: "Calving", color: "bg-green-500", icon: Baby },
};

interface HealthRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  title: string;
  record_date: string;
  next_due_date: string | null;
}

export default function BreedingPage() {
  const { toast } = useToast();
  const [cattle, setCattle] = useState<Cattle[]>([]);
  const [records, setRecords] = useState<BreedingRecord[]>([]);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  
  // Form states
  const [selectedCattle, setSelectedCattle] = useState("");
  const [recordType, setRecordType] = useState("heat_detection");
  const [recordDate, setRecordDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [heatCycleDay, setHeatCycleDay] = useState("");
  const [inseminationBull, setInseminationBull] = useState("");
  const [inseminationTech, setInseminationTech] = useState("");
  const [pregnancyConfirmed, setPregnancyConfirmed] = useState<string>("");
  const [expectedCalving, setExpectedCalving] = useState("");
  const [actualCalving, setActualCalving] = useState("");
  const [calfGender, setCalfGender] = useState("");
  const [calfWeight, setCalfWeight] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cattleRes, recordsRes, healthRes] = await Promise.all([
        supabase.from("cattle").select("id, tag_number, name, cattle_type, lactation_status").eq("cattle_type", "cow").eq("status", "active"),
        supabase.from("breeding_records").select("*").order("record_date", { ascending: false }),
        supabase.from("cattle_health").select("id, cattle_id, record_type, title, record_date, next_due_date").order("record_date", { ascending: false }),
      ]);

      if (cattleRes.data) setCattle(cattleRes.data);
      if (recordsRes.data) setRecords(recordsRes.data);
      if (healthRes.data) setHealthRecords(healthRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecord = async () => {
    if (!selectedCattle || !recordType || !recordDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }

    const record: any = {
      cattle_id: selectedCattle,
      record_type: recordType,
      record_date: recordDate,
      notes: notes || null,
    };

    if (recordType === "heat_detection") {
      record.heat_cycle_day = heatCycleDay ? parseInt(heatCycleDay) : null;
    } else if (recordType === "artificial_insemination") {
      record.insemination_bull = inseminationBull || null;
      record.insemination_technician = inseminationTech || null;
      // Calculate expected calving (283 days from insemination)
      record.expected_calving_date = format(addDays(new Date(recordDate), 283), "yyyy-MM-dd");
    } else if (recordType === "pregnancy_check") {
      record.pregnancy_confirmed = pregnancyConfirmed === "yes";
      if (expectedCalving) record.expected_calving_date = expectedCalving;
    } else if (recordType === "calving") {
      record.actual_calving_date = actualCalving || recordDate;
      record.calf_details = {
        gender: calfGender,
        weight: calfWeight ? parseFloat(calfWeight) : null,
      };
    }

    const { error } = await supabase.from("breeding_records").insert(record);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Breeding record added" });
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
  };

  const resetForm = () => {
    setSelectedCattle("");
    setRecordType("heat_detection");
    setRecordDate(format(new Date(), "yyyy-MM-dd"));
    setHeatCycleDay("");
    setInseminationBull("");
    setInseminationTech("");
    setPregnancyConfirmed("");
    setExpectedCalving("");
    setActualCalving("");
    setCalfGender("");
    setCalfWeight("");
    setNotes("");
  };

  const getCattleTag = (cattleId: string) => {
    const c = cattle.find(c => c.id === cattleId);
    return c ? `${c.tag_number}${c.name ? ` - ${c.name}` : ""}` : "Unknown";
  };

  // Stats
  const heatRecords = records.filter(r => r.record_type === "heat_detection").length;
  const aiRecords = records.filter(r => r.record_type === "artificial_insemination").length;
  const pregnantCount = records.filter(r => r.record_type === "pregnancy_check" && r.pregnancy_confirmed).length;
  const calvingsThisMonth = records.filter(r => {
    if (r.record_type !== "calving") return false;
    const date = new Date(r.record_date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  // Upcoming calvings
  const upcomingCalvings = records
    .filter(r => r.expected_calving_date && !r.actual_calving_date)
    .sort((a, b) => new Date(a.expected_calving_date!).getTime() - new Date(b.expected_calving_date!).getTime())
    .slice(0, 5);

  const columns = [
    { 
      key: "record_date" as const, 
      header: "Date", 
      render: (row: BreedingRecord) => format(new Date(row.record_date), "dd MMM yyyy") 
    },
    { 
      key: "cattle_id" as const, 
      header: "Cattle", 
      render: (row: BreedingRecord) => getCattleTag(row.cattle_id) 
    },
    { 
      key: "record_type" as const, 
      header: "Type", 
      render: (row: BreedingRecord) => {
        const typeInfo = recordTypeLabels[row.record_type] || { label: row.record_type, color: "bg-gray-500", icon: AlertCircle };
        return (
          <Badge className={`${typeInfo.color} text-white`}>
            {typeInfo.label}
          </Badge>
        );
      }
    },
    { 
      key: "expected_calving_date" as const, 
      header: "Expected Calving", 
      render: (row: BreedingRecord) => row.expected_calving_date ? format(new Date(row.expected_calving_date), "dd MMM yyyy") : "-" 
    },
    { 
      key: "pregnancy_confirmed" as const, 
      header: "Status", 
      render: (row: BreedingRecord) => {
        if (row.record_type === "pregnancy_check") {
          return row.pregnancy_confirmed ? (
            <Badge className="bg-green-500">Confirmed</Badge>
          ) : (
            <Badge variant="destructive">Not Pregnant</Badge>
          );
        }
        if (row.record_type === "calving" && row.actual_calving_date) {
          return <Badge className="bg-green-500">Completed</Badge>;
        }
        return "-";
      }
    },
    { key: "notes" as const, header: "Notes", render: (row: BreedingRecord) => row.notes || "-" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Breeding Management"
        description="Track heat cycles, inseminations, pregnancies, and calvings"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border p-1">
            <Button 
              variant={viewMode === "calendar" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="mr-2 h-4 w-4" /> Calendar
            </Button>
            <Button 
              variant={viewMode === "list" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="mr-2 h-4 w-4" /> List
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Record</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Breeding Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Cattle *</Label>
                <Select value={selectedCattle} onValueChange={setSelectedCattle}>
                  <SelectTrigger><SelectValue placeholder="Select cattle" /></SelectTrigger>
                  <SelectContent>
                    {cattle.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.tag_number} {c.name && `- ${c.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Record Type *</Label>
                <Select value={recordType} onValueChange={setRecordType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heat_detection">Heat Detection</SelectItem>
                    <SelectItem value="artificial_insemination">Artificial Insemination</SelectItem>
                    <SelectItem value="pregnancy_check">Pregnancy Check</SelectItem>
                    <SelectItem value="calving">Calving</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} />
              </div>

              {recordType === "heat_detection" && (
                <div className="space-y-2">
                  <Label>Heat Cycle Day</Label>
                  <Input type="number" value={heatCycleDay} onChange={e => setHeatCycleDay(e.target.value)} placeholder="e.g., 21" />
                </div>
              )}

              {recordType === "artificial_insemination" && (
                <>
                  <div className="space-y-2">
                    <Label>Bull/Semen ID</Label>
                    <Input value={inseminationBull} onChange={e => setInseminationBull(e.target.value)} placeholder="Bull name or semen batch" />
                  </div>
                  <div className="space-y-2">
                    <Label>Technician</Label>
                    <Input value={inseminationTech} onChange={e => setInseminationTech(e.target.value)} placeholder="AI technician name" />
                  </div>
                  <p className="text-sm text-muted-foreground">Expected calving will be calculated automatically (283 days)</p>
                </>
              )}

              {recordType === "pregnancy_check" && (
                <>
                  <div className="space-y-2">
                    <Label>Pregnancy Confirmed?</Label>
                    <Select value={pregnancyConfirmed} onValueChange={setPregnancyConfirmed}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - Pregnant</SelectItem>
                        <SelectItem value="no">No - Not Pregnant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {pregnancyConfirmed === "yes" && (
                    <div className="space-y-2">
                      <Label>Expected Calving Date</Label>
                      <Input type="date" value={expectedCalving} onChange={e => setExpectedCalving(e.target.value)} />
                    </div>
                  )}
                </>
              )}

              {recordType === "calving" && (
                <>
                  <div className="space-y-2">
                    <Label>Actual Calving Date</Label>
                    <Input type="date" value={actualCalving} onChange={e => setActualCalving(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Calf Gender</Label>
                      <Select value={calfGender} onValueChange={setCalfGender}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Calf Weight (kg)</Label>
                      <Input type="number" value={calfWeight} onChange={e => setCalfWeight(e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." />
              </div>

              <Button className="w-full" onClick={handleCreateRecord}>Save Record</Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {viewMode === "calendar" ? (
        <BreedingCalendar 
          breedingRecords={records} 
          healthRecords={healthRecords} 
          cattle={cattle} 
        />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Heat Detections</CardTitle>
            <Heart className="h-4 w-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{heatRecords}</div>
            <p className="text-xs text-muted-foreground">total records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI Records</CardTitle>
            <Syringe className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aiRecords}</div>
            <p className="text-xs text-muted-foreground">inseminations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Pregnant</CardTitle>
            <AlertCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pregnantCount}</div>
            <p className="text-xs text-muted-foreground">awaiting calving</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Calvings This Month</CardTitle>
            <Baby className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calvingsThisMonth}</div>
            <p className="text-xs text-muted-foreground">new calves</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming Calvings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Calvings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingCalvings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming calvings</p>
            ) : (
              <div className="space-y-3">
                {upcomingCalvings.map(record => {
                  const daysLeft = differenceInDays(new Date(record.expected_calving_date!), new Date());
                  return (
                    <div key={record.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{getCattleTag(record.cattle_id)}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(record.expected_calving_date!), "dd MMM yyyy")}
                        </p>
                      </div>
                      <Badge variant={daysLeft <= 7 ? "destructive" : daysLeft <= 30 ? "secondary" : "outline"}>
                        {daysLeft > 0 ? `${daysLeft} days` : "Due!"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Records */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>All Breeding Records</CardTitle>
              <CardDescription>Complete breeding history</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={records} columns={columns} searchable searchPlaceholder="Search records..." />
            </CardContent>
          </Card>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
