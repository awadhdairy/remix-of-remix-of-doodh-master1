import { useState, useEffect } from "react";
import { format, differenceInYears, differenceInMonths } from "date-fns";
import { externalSupabase } from "@/lib/external-supabase";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Beef, Heart, Baby, Droplets, Calendar, Stethoscope, Syringe, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import type { Cattle } from "@/hooks/useCattleData";

interface CattleDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cattle: Cattle | null;
  allCattle: Cattle[];
}

interface HealthRecord {
  id: string;
  record_date: string;
  record_type: string;
  title: string;
  description: string | null;
  vet_name: string | null;
  cost: number | null;
  next_due_date: string | null;
}

interface BreedingRecord {
  id: string;
  record_date: string;
  record_type: string;
  insemination_bull: string | null;
  insemination_technician: string | null;
  pregnancy_confirmed: boolean | null;
  expected_calving_date: string | null;
  actual_calving_date: string | null;
  calf_details: Record<string, unknown> | null;
  notes: string | null;
}

interface MilkRecord {
  production_date: string;
  session: string;
  quantity_liters: number;
  fat_percentage: number | null;
  snf_percentage: number | null;
}

function calculateAge(dob: string | null): string {
  if (!dob) return "Unknown";
  const birthDate = new Date(dob);
  const now = new Date();
  const years = differenceInYears(now, birthDate);
  const months = differenceInMonths(now, birthDate) % 12;
  if (years > 0) return `${years}y ${months}m`;
  return `${months}m`;
}

function getRecordTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case "vaccination": return <Syringe className="h-4 w-4 text-info" />;
    case "checkup": return <Stethoscope className="h-4 w-4 text-primary" />;
    case "disease": return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "treatment": return <Heart className="h-4 w-4 text-warning" />;
    default: return <Stethoscope className="h-4 w-4 text-muted-foreground" />;
  }
}

interface CattleExtra {
  lactation_number: number | null;
  notes: string | null;
  last_calving_date: string | null;
  expected_calving_date: string | null;
}

export function CattleDetailDialog({ open, onOpenChange, cattle, allCattle }: CattleDetailDialogProps) {
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [milkRecords, setMilkRecords] = useState<MilkRecord[]>([]);
  const [extra, setExtra] = useState<CattleExtra>({ lactation_number: null, notes: null, last_calving_date: null, expected_calving_date: null });
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingBreeding, setLoadingBreeding] = useState(false);
  const [loadingMilk, setLoadingMilk] = useState(false);

  useEffect(() => {
    if (!open || !cattle) {
      setHealthRecords([]);
      setBreedingRecords([]);
      setMilkRecords([]);
      setExtra({ lactation_number: null, notes: null, last_calving_date: null, expected_calving_date: null });
      return;
    }

    const cattleId = cattle.id;
    const thirtyDaysAgo = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

    // Fetch extra cattle fields
    externalSupabase
      .from("cattle")
      .select("lactation_number, notes, last_calving_date, expected_calving_date")
      .eq("id", cattleId)
      .single()
      .then(({ data }) => {
        if (data) setExtra(data as CattleExtra);
      });

    // Fetch all three in parallel
    setLoadingHealth(true);
    setLoadingBreeding(true);
    setLoadingMilk(true);

    externalSupabase
      .from("cattle_health")
      .select("id, record_date, record_type, title, description, vet_name, cost, next_due_date")
      .eq("cattle_id", cattleId)
      .order("record_date", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setHealthRecords((data as HealthRecord[]) || []);
        setLoadingHealth(false);
      });

    externalSupabase
      .from("breeding_records")
      .select("id, record_date, record_type, insemination_bull, insemination_technician, pregnancy_confirmed, expected_calving_date, actual_calving_date, calf_details, notes")
      .eq("cattle_id", cattleId)
      .order("record_date", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setBreedingRecords((data as BreedingRecord[]) || []);
        setLoadingBreeding(false);
      });

    externalSupabase
      .from("milk_production")
      .select("production_date, session, quantity_liters, fat_percentage, snf_percentage")
      .eq("cattle_id", cattleId)
      .gte("production_date", thirtyDaysAgo)
      .order("production_date", { ascending: false })
      .then(({ data }) => {
        setMilkRecords((data as MilkRecord[]) || []);
        setLoadingMilk(false);
      });
  }, [open, cattle]);

  if (!cattle) return null;

  const sire = cattle.sire_id ? allCattle.find((c) => c.id === cattle.sire_id) : null;
  const dam = cattle.dam_id ? allCattle.find((c) => c.id === cattle.dam_id) : null;

  // Aggregate milk data by date
  const milkByDate = milkRecords.reduce<Record<string, { morning: number; evening: number }>>((acc, r) => {
    if (!acc[r.production_date]) acc[r.production_date] = { morning: 0, evening: 0 };
    if (r.session === "morning") acc[r.production_date].morning += r.quantity_liters;
    else acc[r.production_date].evening += r.quantity_liters;
    return acc;
  }, {});

  const milkDates = Object.keys(milkByDate).sort((a, b) => b.localeCompare(a));
  const totalMilk30d = milkRecords.reduce((s, r) => s + r.quantity_liters, 0);
  const avgDaily = milkDates.length > 0 ? totalMilk30d / milkDates.length : 0;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Beef className="h-5 w-5 text-primary" />
            {cattle.tag_number}{cattle.name ? ` — ${cattle.name}` : ""}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {cattle.breed} • {cattle.cattle_type === "cow" ? "Cow" : "Buffalo"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1 text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="health" className="flex-1 text-xs sm:text-sm">Health</TabsTrigger>
            <TabsTrigger value="breeding" className="flex-1 text-xs sm:text-sm">Breeding</TabsTrigger>
            <TabsTrigger value="milk" className="flex-1 text-xs sm:text-sm">Milk</TabsTrigger>
          </TabsList>

          {/* ===== OVERVIEW TAB ===== */}
          <TabsContent value="overview" className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <InfoRow label="Tag #" value={cattle.tag_number} />
              <InfoRow label="Name" value={cattle.name || "—"} />
              <InfoRow label="Breed" value={cattle.breed} />
              <InfoRow label="Type" value={cattle.cattle_type === "cow" ? "Cow" : "Buffalo"} />
              <InfoRow label="Age" value={calculateAge(cattle.date_of_birth)} />
              <InfoRow label="DOB" value={cattle.date_of_birth ? format(new Date(cattle.date_of_birth), "dd MMM yyyy") : "—"} />
              <InfoRow label="Weight" value={cattle.weight ? `${cattle.weight} kg` : "—"} />
              <InfoRow label="Lactation #" value={extra.lactation_number?.toString() || "0"} />
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={cattle.status} />
              <StatusBadge status={cattle.lactation_status} />
            </div>

            {(sire || dam) && (
              <div className="border-t pt-3 space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Parentage</p>
                {sire && <p className="text-sm">Sire: <span className="font-medium text-primary">{sire.tag_number}</span> {sire.name ? `(${sire.name})` : ""}</p>}
                {dam && <p className="text-sm">Dam: <span className="font-medium text-primary">{dam.tag_number}</span> {dam.name ? `(${dam.name})` : ""}</p>}
              </div>
            )}

            {extra.notes && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{extra.notes}</p>
              </div>
            )}

            {extra.last_calving_date && (
              <div className="border-t pt-3">
                <InfoRow label="Last Calving" value={format(new Date(extra.last_calving_date), "dd MMM yyyy")} />
                {extra.expected_calving_date && (
                  <InfoRow label="Expected Calving" value={format(new Date(extra.expected_calving_date), "dd MMM yyyy")} />
                )}
              </div>
            )}
          </TabsContent>

          {/* ===== HEALTH TAB ===== */}
          <TabsContent value="health" className="max-h-[55vh] overflow-y-auto pr-1">
            {loadingHealth ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : healthRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No health records found.</p>
            ) : (
              <div className="space-y-2">
                {healthRecords.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getRecordTypeIcon(r.record_type)}
                        <span className="font-medium text-sm">{r.title}</span>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">{r.record_type}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span><Calendar className="inline h-3 w-3 mr-1" />{format(new Date(r.record_date), "dd MMM yyyy")}</span>
                      {r.vet_name && <span>Vet: {r.vet_name}</span>}
                      {r.cost != null && r.cost > 0 && <span>₹{r.cost.toLocaleString()}</span>}
                      {r.next_due_date && <span>Next: {format(new Date(r.next_due_date), "dd MMM yyyy")}</span>}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== BREEDING TAB ===== */}
          <TabsContent value="breeding" className="max-h-[55vh] overflow-y-auto pr-1">
            {loadingBreeding ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : breedingRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No breeding records found.</p>
            ) : (
              <div className="space-y-2">
                {breedingRecords.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Baby className="h-4 w-4 text-info" />
                        <span className="font-medium text-sm capitalize">{r.record_type.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(r.record_date), "dd MMM yyyy")}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {r.insemination_bull && <span>Bull: {r.insemination_bull}</span>}
                      {r.insemination_technician && <span>Tech: {r.insemination_technician}</span>}
                      {r.pregnancy_confirmed != null && (
                        <span className="flex items-center gap-1">
                          {r.pregnancy_confirmed ? <CheckCircle2 className="h-3 w-3 text-success" /> : <AlertTriangle className="h-3 w-3 text-warning" />}
                          {r.pregnancy_confirmed ? "Confirmed" : "Not confirmed"}
                        </span>
                      )}
                      {r.expected_calving_date && <span>Expected: {format(new Date(r.expected_calving_date), "dd MMM yyyy")}</span>}
                      {r.actual_calving_date && <span>Calved: {format(new Date(r.actual_calving_date), "dd MMM yyyy")}</span>}
                    </div>
                    {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                    {r.calf_details && Object.keys(r.calf_details).length > 0 && (
                      <p className="text-xs text-muted-foreground">Calf: {JSON.stringify(r.calf_details)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== MILK TAB ===== */}
          <TabsContent value="milk" className="max-h-[55vh] overflow-y-auto pr-1">
            {loadingMilk ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : milkRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No milk production data (last 30 days).</p>
            ) : (
              <div className="space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted rounded-lg p-2 text-center">
                    <p className="text-lg font-bold">{totalMilk30d.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Total (30d) L</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2 text-center">
                    <p className="text-lg font-bold">{avgDaily.toFixed(1)}</p>
                    <p className="text-[10px] text-muted-foreground">Avg Daily L</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2 text-center">
                    <p className="text-lg font-bold">{milkDates.length}</p>
                    <p className="text-[10px] text-muted-foreground">Days Recorded</p>
                  </div>
                </div>

                {/* Daily breakdown */}
                <div className="space-y-1">
                  {milkDates.slice(0, 15).map((date, idx) => {
                    const d = milkByDate[date];
                    const total = d.morning + d.evening;
                    const prevDate = milkDates[idx + 1];
                    const prevTotal = prevDate ? milkByDate[prevDate].morning + milkByDate[prevDate].evening : total;
                    const trend = total - prevTotal;
                    return (
                      <div key={date} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                        <span className="text-muted-foreground text-xs">{format(new Date(date), "dd MMM")}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs">AM: <span className="font-medium">{d.morning.toFixed(1)}</span></span>
                          <span className="text-xs">PM: <span className="font-medium">{d.evening.toFixed(1)}</span></span>
                          <span className="font-semibold">{total.toFixed(1)}L</span>
                          {trend > 0.1 && <TrendingUp className="h-3 w-3 text-success" />}
                          {trend < -0.1 && <TrendingDown className="h-3 w-3 text-destructive" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
