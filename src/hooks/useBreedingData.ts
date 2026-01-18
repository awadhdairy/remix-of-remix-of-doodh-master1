import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";

export interface Cattle {
  id: string;
  tag_number: string;
  name: string | null;
  cattle_type: string;
  lactation_status: string | null;
}

export interface BreedingRecord {
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
  calf_details: unknown;
  notes: string | null;
  created_at: string;
  cattle?: Cattle;
}

export interface HealthRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  title: string;
  record_date: string;
  next_due_date: string | null;
}

export interface BreedingData {
  cattle: Cattle[];
  records: BreedingRecord[];
  healthRecords: HealthRecord[];
}

async function fetchBreedingData(): Promise<BreedingData> {
  const [cattleRes, recordsRes, healthRes] = await Promise.all([
    supabase
      .from("cattle")
      .select("id, tag_number, name, cattle_type, lactation_status")
      .eq("cattle_type", "cow")
      .eq("status", "active"),
    supabase
      .from("breeding_records")
      .select("*")
      .order("record_date", { ascending: false }),
    supabase
      .from("cattle_health")
      .select("id, cattle_id, record_type, title, record_date, next_due_date")
      .order("record_date", { ascending: false }),
  ]);

  return {
    cattle: cattleRes.data || [],
    records: recordsRes.data || [],
    healthRecords: healthRes.data || [],
  };
}

export interface CreateBreedingRecordInput {
  cattle_id: string;
  record_type: string;
  record_date: string;
  heat_cycle_day?: number | null;
  insemination_bull?: string | null;
  insemination_technician?: string | null;
  pregnancy_confirmed?: boolean | null;
  expected_calving_date?: string | null;
  actual_calving_date?: string | null;
  calf_details?: { gender?: string; weight?: number | null } | null;
  notes?: string | null;
}

export function useBreedingData() {
  return useQuery({
    queryKey: ["breeding-data"],
    queryFn: fetchBreedingData,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateBreedingRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateBreedingRecordInput) => {
      const record = {
        cattle_id: input.cattle_id,
        record_type: input.record_type,
        record_date: input.record_date,
        notes: input.notes || null,
        heat_cycle_day: null as number | null,
        insemination_bull: null as string | null,
        insemination_technician: null as string | null,
        pregnancy_confirmed: null as boolean | null,
        expected_calving_date: null as string | null,
        actual_calving_date: null as string | null,
        calf_details: null as { gender?: string; weight?: number | null } | null,
      };

      if (input.record_type === "heat_detection") {
        record.heat_cycle_day = input.heat_cycle_day ?? null;
      } else if (input.record_type === "artificial_insemination") {
        record.insemination_bull = input.insemination_bull || null;
        record.insemination_technician = input.insemination_technician || null;
        record.expected_calving_date = format(
          addDays(new Date(input.record_date), 283),
          "yyyy-MM-dd"
        );
      } else if (input.record_type === "pregnancy_check") {
        record.pregnancy_confirmed = input.pregnancy_confirmed ?? null;
        if (input.expected_calving_date) {
          record.expected_calving_date = input.expected_calving_date;
        }
      } else if (input.record_type === "calving") {
        record.actual_calving_date = input.actual_calving_date || input.record_date;
        record.calf_details = input.calf_details || null;
      }

      const { data, error } = await supabase
        .from("breeding_records")
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["breeding-data"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      toast({ title: "Success", description: "Breeding record added successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
