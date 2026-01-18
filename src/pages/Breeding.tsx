import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Heart, Baby, Syringe, Calendar, AlertCircle, CalendarDays, List, Loader2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { BreedingCalendar } from "@/components/breeding/BreedingCalendar";
import { BreedingPageSkeleton } from "@/components/breeding/BreedingSkeleton";
import { useBreedingData, useCreateBreedingRecord, type BreedingRecord } from "@/hooks/useBreedingData";
import type { LucideIcon } from "lucide-react";

const recordTypeLabels: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  heat_detection: { label: "Heat Detection", color: "bg-breeding-heat", icon: Heart },
  artificial_insemination: { label: "Artificial Insemination", color: "bg-breeding-insemination", icon: Syringe },
  pregnancy_check: { label: "Pregnancy Check", color: "bg-breeding-pregnancy", icon: AlertCircle },
  calving: { label: "Calving", color: "bg-breeding-calving", icon: Baby },
};

export default function BreedingPage() {
  const { toast } = useToast();
  const { data, isLoading, error } = useBreedingData();
  const createRecord = useCreateBreedingRecord();
  
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

  const handleCreateRecord = async () => {
    if (!selectedCattle || !recordType || !recordDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }

    await createRecord.mutateAsync({
      cattle_id: selectedCattle,
      record_type: recordType,
      record_date: recordDate,
      heat_cycle_day: heatCycleDay ? parseInt(heatCycleDay) : null,
      insemination_bull: inseminationBull || null,
      insemination_technician: inseminationTech || null,
      pregnancy_confirmed: pregnancyConfirmed === "yes" ? true : pregnancyConfirmed === "no" ? false : null,
      expected_calving_date: expectedCalving || null,
      actual_calving_date: actualCalving || null,
      calf_details: recordType === "calving" ? { gender: calfGender, weight: calfWeight ? parseFloat(calfWeight) : null } : null,
      notes: notes || null,
    });

    setDialogOpen(false);
    resetForm();
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

  if (isLoading) {
    return <BreedingPageSkeleton viewMode={viewMode} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Failed to load breeding data</h2>
        <p className="text-muted-foreground mb-4">Please try refreshing the page</p>
        <Button onClick={() => window.location.reload()}>Refresh Page</Button>
      </div>
    );
  }

  const { cattle, records, healthRecords } = data!;

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
            <Badge className="bg-success">Confirmed</Badge>
          ) : (
            <Badge variant="destructive">Not Pregnant</Badge>
          );
        }
        if (row.record_type === "calving" && row.actual_calving_date) {
          return <Badge className="bg-success">Completed</Badge>;
        }
        return "-";
      }
    },
    { key: "notes" as const, header: "Notes", render: (row: BreedingRecord) => row.notes || "-" },
  ];

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

              <Button className="w-full" onClick={handleCreateRecord} disabled={createRecord.isPending}>
                {createRecord.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Record
              </Button>
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
            <Heart className="h-4 w-4 text-breeding-heat" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{heatRecords}</div>
            <p className="text-xs text-muted-foreground">total records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI Records</CardTitle>
            <Syringe className="h-4 w-4 text-breeding-insemination" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aiRecords}</div>
            <p className="text-xs text-muted-foreground">inseminations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Pregnant</CardTitle>
            <AlertCircle className="h-4 w-4 text-breeding-pregnancy" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pregnantCount}</div>
            <p className="text-xs text-muted-foreground">awaiting calving</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Calvings This Month</CardTitle>
            <Baby className="h-4 w-4 text-breeding-calving" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calvingsThisMonth}</div>
            <p className="text-xs text-muted-foreground">new calves</p>
          </CardContent>
        </Card>
      </div>

          {/* Upcoming Calvings */}
          {upcomingCalvings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Upcoming Calvings
            </CardTitle>
            <CardDescription>Expected calving dates in the coming weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingCalvings.map(record => {
                const daysLeft = differenceInDays(new Date(record.expected_calving_date!), new Date());
                return (
                  <div key={record.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                      <Baby className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{getCattleTag(record.cattle_id)}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(record.expected_calving_date!), "dd MMM yyyy")}
                      </p>
                    </div>
                    <Badge variant={daysLeft <= 7 ? "destructive" : daysLeft <= 14 ? "default" : "secondary"}>
                      {daysLeft} days
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
          )}

          {/* Records Table */}
          <DataTable
            data={records}
            columns={columns}
            searchPlaceholder="Search breeding records..."
          />
        </>
      )}
    </div>
  );
}
