import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { useToast } from "@/hooks/use-toast";
import { useExpenseAutomation } from "@/hooks/useExpenseAutomation";
import { invalidateExpenseRelated } from "@/lib/query-invalidation";
import { DateRange, SortOrder, getDateFilterValue } from "@/components/common/DataFilters";

interface Cattle {
  id: string;
  tag_number: string;
  name: string | null;
}

export interface HealthRecordWithCattle {
  id: string;
  cattle_id: string;
  record_date: string;
  record_type: string;
  title: string;
  description: string | null;
  vet_name: string | null;
  cost: number | null;
  next_due_date: string | null;
  created_at: string;
  cattle?: Cattle;
}

export interface HealthFormData {
  cattle_id: string;
  record_date: string;
  record_type: string;
  title: string;
  description: string;
  vet_name: string;
  cost: string;
  next_due_date: string;
}

interface HealthData {
  records: HealthRecordWithCattle[];
  cattle: Cattle[];
}

interface UseHealthDataOptions {
  dateRange?: DateRange;
  sortBy?: string;
  sortOrder?: SortOrder;
}

async function fetchHealthData(options: UseHealthDataOptions): Promise<HealthData> {
  const { dateRange = "90", sortBy = "record_date", sortOrder = "desc" } = options;
  const startDate = getDateFilterValue(dateRange);
  
  let recordsQuery = supabase
    .from("cattle_health")
    .select(`*, cattle:cattle_id (id, tag_number, name)`)
    .order(sortBy, { ascending: sortOrder === "asc" });
  
  if (startDate) {
    recordsQuery = recordsQuery.gte("record_date", startDate);
  }
  
  const [recordsRes, cattleRes] = await Promise.all([
    recordsQuery,
    supabase
      .from("cattle")
      .select("id, tag_number, name")
      .eq("status", "active")
      .order("tag_number"),
  ]);

  if (recordsRes.error) throw recordsRes.error;
  if (cattleRes.error) throw cattleRes.error;

  return {
    records: (recordsRes.data as HealthRecordWithCattle[]) || [],
    cattle: cattleRes.data || [],
  };
}

export function useHealthData(options: UseHealthDataOptions = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logHealthExpense } = useExpenseAutomation();
  
  const { dateRange = "90", sortBy = "record_date", sortOrder = "desc" } = options;

  const healthQuery = useQuery({
    queryKey: ["health-records", dateRange, sortBy, sortOrder],
    queryFn: () => fetchHealthData({ dateRange, sortBy, sortOrder }),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: async ({ formData, cattleList }: { formData: HealthFormData; cattleList: Cattle[] }) => {
      const { data, error } = await supabase
        .from("cattle_health")
        .insert({
          cattle_id: formData.cattle_id,
          record_date: formData.record_date,
          record_type: formData.record_type,
          title: formData.title,
          description: formData.description || null,
          vet_name: formData.vet_name || null,
          cost: formData.cost ? parseFloat(formData.cost) : null,
          next_due_date: formData.next_due_date || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-create expense entry
      let expenseCreated = false;
      if (formData.cost && parseFloat(formData.cost) > 0 && data) {
        const selectedCattle = cattleList.find((c) => c.id === formData.cattle_id);
        const cattleTag = selectedCattle ? selectedCattle.tag_number : "Unknown";
        expenseCreated = await logHealthExpense(
          cattleTag,
          formData.record_type,
          formData.title,
          parseFloat(formData.cost),
          formData.record_date,
          data.id
        );
      }

      return { data, expenseCreated };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["health-records"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      invalidateExpenseRelated(queryClient);
      const message = result?.expenseCreated ? "Health record added & expense recorded" : "Health record added";
      toast({ title: message });
    },
    onError: (error: Error) => {
      toast({ title: "Error saving record", description: error.message, variant: "destructive" });
    },
  });

  return {
    records: healthQuery.data?.records || [],
    cattle: healthQuery.data?.cattle || [],
    isLoading: healthQuery.isLoading,
    isError: healthQuery.isError,
    error: healthQuery.error,
    refetch: healthQuery.refetch,
    createRecord: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
