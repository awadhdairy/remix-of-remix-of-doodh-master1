import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useExpenseAutomation } from "@/hooks/useExpenseAutomation";
import { format } from "date-fns";

export interface Equipment {
  id: string;
  name: string;
  category: string;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  warranty_expiry: string | null;
  status: string;
  location: string | null;
  notes: string | null;
}

export interface MaintenanceRecord {
  id: string;
  equipment_id: string;
  maintenance_type: string;
  maintenance_date: string;
  description: string | null;
  cost: number;
  performed_by: string | null;
  next_maintenance_date: string | null;
  notes: string | null;
}

interface EquipmentData {
  equipment: Equipment[];
  maintenance: MaintenanceRecord[];
}

async function fetchEquipmentData(): Promise<EquipmentData> {
  const [eqRes, maintRes] = await Promise.all([
    supabase.from("equipment").select("*").order("name"),
    supabase.from("maintenance_records").select("*").order("maintenance_date", { ascending: false }),
  ]);

  if (eqRes.error) throw eqRes.error;
  if (maintRes.error) throw maintRes.error;

  return {
    equipment: eqRes.data || [],
    maintenance: maintRes.data || [],
  };
}

export function useEquipmentData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logEquipmentPurchase, logMaintenanceExpense } = useExpenseAutomation();

  const equipmentQuery = useQuery({
    queryKey: ["equipment"],
    queryFn: fetchEquipmentData,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const createEquipmentMutation = useMutation({
    mutationFn: async (formData: {
      name: string;
      category: string;
      model?: string;
      serial_number?: string;
      purchase_date?: string;
      purchase_cost?: string;
      warranty_expiry?: string;
      location?: string;
      status: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("equipment")
        .insert({
          name: formData.name,
          category: formData.category,
          model: formData.model || null,
          serial_number: formData.serial_number || null,
          purchase_date: formData.purchase_date || null,
          purchase_cost: formData.purchase_cost ? parseFloat(formData.purchase_cost) : null,
          warranty_expiry: formData.warranty_expiry || null,
          location: formData.location || null,
          status: formData.status,
          notes: formData.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-create expense entry
      let expenseCreated = false;
      if (formData.purchase_cost && parseFloat(formData.purchase_cost) > 0 && data) {
        expenseCreated = await logEquipmentPurchase(
          formData.name,
          parseFloat(formData.purchase_cost),
          formData.purchase_date || format(new Date(), "yyyy-MM-dd"),
          data.id
        );
      }

      return { data, expenseCreated };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      const message = result?.expenseCreated ? "Equipment added & expense recorded" : "Equipment added";
      toast({ title: message });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding equipment", description: error.message, variant: "destructive" });
    },
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: async (formData: {
      equipment_id: string;
      maintenance_type: string;
      maintenance_date: string;
      description?: string;
      cost?: string;
      performed_by?: string;
      next_maintenance_date?: string;
    }) => {
      const { data, error } = await supabase
        .from("maintenance_records")
        .insert({
          equipment_id: formData.equipment_id,
          maintenance_type: formData.maintenance_type,
          maintenance_date: formData.maintenance_date,
          description: formData.description || null,
          cost: formData.cost ? parseFloat(formData.cost) : 0,
          performed_by: formData.performed_by || null,
          next_maintenance_date: formData.next_maintenance_date || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-create expense entry
      let expenseCreated = false;
      if (formData.cost && parseFloat(formData.cost) > 0 && data) {
        const equipment = equipmentQuery.data?.equipment.find((e) => e.id === formData.equipment_id);
        const equipmentName = equipment?.name || "Unknown Equipment";
        expenseCreated = await logMaintenanceExpense(
          equipmentName,
          formData.maintenance_type,
          parseFloat(formData.cost),
          formData.maintenance_date,
          data.id
        );
      }

      return { data, expenseCreated };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      const message = result?.expenseCreated ? "Maintenance record added & expense recorded" : "Maintenance record added";
      toast({ title: message });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding maintenance", description: error.message, variant: "destructive" });
    },
  });

  return {
    equipment: equipmentQuery.data?.equipment || [],
    maintenance: equipmentQuery.data?.maintenance || [],
    isLoading: equipmentQuery.isLoading,
    isError: equipmentQuery.isError,
    error: equipmentQuery.error,
    refetch: equipmentQuery.refetch,
    createEquipment: createEquipmentMutation.mutate,
    createMaintenance: createMaintenanceMutation.mutate,
    isCreatingEquipment: createEquipmentMutation.isPending,
    isCreatingMaintenance: createMaintenanceMutation.isPending,
  };
}
