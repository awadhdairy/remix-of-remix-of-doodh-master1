import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Cattle {
  id: string;
  tag_number: string;
  name: string | null;
  breed: string;
  cattle_type: string;
  date_of_birth: string | null;
  status: string;
  lactation_status: string;
  weight: number | null;
  created_at: string;
  sire_id: string | null;
  dam_id: string | null;
}

export interface CattleFormData {
  tag_number: string;
  name: string;
  breed: string;
  cattle_type: string;
  date_of_birth: string;
  weight: string;
  status: string;
  lactation_status: string;
  notes: string;
  sire_id: string;
  dam_id: string;
}

async function fetchCattle(): Promise<Cattle[]> {
  const { data, error } = await supabase
    .from("cattle")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function createCattle(formData: CattleFormData) {
  const payload = {
    tag_number: formData.tag_number,
    name: formData.name || null,
    breed: formData.breed,
    cattle_type: formData.cattle_type,
    date_of_birth: formData.date_of_birth || null,
    weight: formData.weight ? parseFloat(formData.weight) : null,
    status: formData.status as "active" | "sold" | "deceased" | "dry",
    lactation_status: formData.lactation_status as "lactating" | "dry" | "pregnant" | "calving",
    notes: formData.notes || null,
    sire_id: formData.sire_id || null,
    dam_id: formData.dam_id || null,
  };

  const { error } = await supabase.from("cattle").insert(payload);
  if (error) throw error;
}

async function updateCattle(id: string, formData: CattleFormData) {
  const payload = {
    tag_number: formData.tag_number,
    name: formData.name || null,
    breed: formData.breed,
    cattle_type: formData.cattle_type,
    date_of_birth: formData.date_of_birth || null,
    weight: formData.weight ? parseFloat(formData.weight) : null,
    status: formData.status as "active" | "sold" | "deceased" | "dry",
    lactation_status: formData.lactation_status as "lactating" | "dry" | "pregnant" | "calving",
    notes: formData.notes || null,
    sire_id: formData.sire_id || null,
    dam_id: formData.dam_id || null,
  };

  const { error } = await supabase.from("cattle").update(payload).eq("id", id);
  if (error) throw error;
}

async function deleteCattle(id: string) {
  const { error } = await supabase.from("cattle").delete().eq("id", id);
  if (error) throw error;
}

export function useCattleData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cattleQuery = useQuery({
    queryKey: ["cattle"],
    queryFn: fetchCattle,
    staleTime: 5 * 60 * 1000, // 5 minutes for better performance
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false, // Reduce aggressive refetching
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const createMutation = useMutation({
    mutationFn: createCattle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cattle"] });
      toast({ title: "Cattle added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding cattle", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: CattleFormData }) =>
      updateCattle(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cattle"] });
      toast({ title: "Cattle updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error updating cattle", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCattle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cattle"] });
      toast({ title: "Cattle deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error deleting cattle", description: error.message, variant: "destructive" });
    },
  });

  return {
    cattle: cattleQuery.data || [],
    isLoading: cattleQuery.isLoading,
    isError: cattleQuery.isError,
    error: cattleQuery.error,
    refetch: cattleQuery.refetch,
    createCattle: createMutation.mutate,
    updateCattle: updateMutation.mutate,
    deleteCattle: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
