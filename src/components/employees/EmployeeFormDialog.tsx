import { useState, useEffect } from "react";
import { externalSupabase as supabase } from "@/lib/external-supabase";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Save } from "lucide-react";

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

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null; // null = Add mode, Employee = Edit mode
  onSuccess: () => void;
}

const roles = [
  { value: "farm_worker", label: "Farm Worker" },
  { value: "delivery_staff", label: "Delivery Staff" },
  { value: "vet_staff", label: "Vet Staff" },
  { value: "accountant", label: "Accountant" },
  { value: "manager", label: "Manager" },
  { value: "auditor", label: "Auditor" },
];

type UserRole = "super_admin" | "manager" | "accountant" | "delivery_staff" | "farm_worker" | "vet_staff" | "auditor";

export function EmployeeFormDialog({ open, onOpenChange, employee, onSuccess }: EmployeeFormDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("farm_worker");
  const [salary, setSalary] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  const isEditMode = !!employee;

  // Populate form when editing
  useEffect(() => {
    if (employee) {
      setName(employee.name || "");
      setPhone(employee.phone || "");
      setRole((employee.role as UserRole) || "farm_worker");
      setSalary(employee.salary?.toString() || "");
      setJoiningDate(employee.joining_date || "");
      setAddress(employee.address || "");
      setIsActive(employee.is_active ?? true);
    } else {
      resetForm();
    }
  }, [employee, open]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setRole("farm_worker");
    setSalary("");
    setJoiningDate("");
    setAddress("");
    setIsActive(true);
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return false;
    }
    if (phone && !/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
      toast({ title: "Error", description: "Phone must be 10 digits", variant: "destructive" });
      return false;
    }
    if (salary && (isNaN(parseFloat(salary)) || parseFloat(salary) < 0)) {
      toast({ title: "Error", description: "Salary must be a positive number", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const employeeData = {
        name: name.trim(),
        phone: phone.trim() || null,
        role,
        salary: salary ? parseFloat(salary) : null,
        joining_date: joiningDate || null,
        address: address.trim() || null,
        is_active: isActive,
      };

      if (isEditMode && employee) {
        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq("id", employee.id);

        if (error) throw error;
        toast({ title: "Success", description: "Employee updated successfully" });
      } else {
        const { error } = await supabase
          .from("employees")
          .insert(employeeData);

        if (error) throw error;
        toast({ title: "Success", description: "Employee added successfully" });
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving employee:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to save employee", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            {isEditMode ? <Save className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {isEditMode ? "Edit Employee" : "Add Employee"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Employee full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit phone number"
              maxLength={10}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary">Monthly Salary (₹)</Label>
              <Input
                id="salary"
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="joiningDate">Joining Date</Label>
              <Input
                id="joiningDate"
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address (optional)"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="isActive" className="font-medium">Active Status</Label>
              <p className="text-sm text-muted-foreground">Employee can be assigned work</p>
            </div>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <ResponsiveDialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? "Update Employee" : "Add Employee"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
