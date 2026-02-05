import { useState } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { AlertTriangle } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  salary: number | null;
  joining_date: string | null;
  is_active: boolean;
  address: string | null;
}

interface DeleteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSuccess: () => void;
}

export function DeleteEmployeeDialog({ 
  open, 
  onOpenChange, 
  employee, 
  onSuccess 
}: DeleteEmployeeDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!employee) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", employee.id);

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: `${employee.name} has been removed` 
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete employee. They may have associated records.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${employee.name}?`}
      description={`This will permanently remove ${employee.name} and all their associated records including attendance history, payroll records, and shift assignments. This action cannot be undone.`}
      confirmText={loading ? "Deleting..." : "Delete Employee"}
      cancelText="Cancel"
      onConfirm={handleDelete}
      variant="destructive"
    />
  );
}
