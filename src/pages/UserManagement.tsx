import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useSessionToken } from "@/contexts/StaffAuthContext";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Users, Shield, Phone, KeyRound, User, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { sanitizeError } from "@/lib/errors";
import { Switch } from "@/components/ui/switch";

interface UserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface RpcResponse {
  success: boolean;
  message?: string;
  error?: string;
  user_id?: string;
}

const roleOptions = [
  { value: "manager", label: "Manager" },
  { value: "accountant", label: "Accountant" },
  { value: "delivery_staff", label: "Delivery Staff" },
  { value: "farm_worker", label: "Farm Worker" },
  { value: "vet_staff", label: "Vet Staff" },
  { value: "auditor", label: "Auditor" },
];

const roleColors: Record<string, string> = {
  super_admin: "bg-role-admin/10 text-role-admin border-role-admin/20",
  manager: "bg-role-manager/10 text-role-manager border-role-manager/20",
  accountant: "bg-role-accountant/10 text-role-accountant border-role-accountant/20",
  delivery_staff: "bg-role-delivery/10 text-role-delivery border-role-delivery/20",
  farm_worker: "bg-role-farm/10 text-role-farm border-role-farm/20",
  vet_staff: "bg-role-vet/10 text-role-vet border-role-vet/20",
  auditor: "bg-role-auditor/10 text-role-auditor border-role-auditor/20",
};

export default function UserManagement() {
  const { role, loading: roleLoading } = useUserRole();
  const sessionToken = useSessionToken();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetPinDialogOpen, setResetPinDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newPin, setNewPin] = useState("");
  const [creating, setCreating] = useState(false);
  const [resettingPin, setResettingPin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  useEffect(() => {
    if (!roleLoading && role !== "super_admin") {
      navigate("/dashboard");
      toast.error("Access denied. Super Admin only.");
    }
  }, [role, roleLoading, navigate]);

  useEffect(() => {
    if (role === "super_admin") {
      fetchUsers();
    }
  }, [role]);

  const fetchUsers = async () => {
    try {
      // Use profiles_safe view to exclude pin_hash column
      const { data, error } = await supabase
        .from("profiles_safe")
        .select("id, full_name, phone, role, is_active, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!fullName || !phone || !pin || !selectedRole) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!/^\d{10}$/.test(phone)) {
      toast.error("Phone number must be 10 digits");
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      toast.error("PIN must be 6 digits");
      return;
    }

    if (!sessionToken) {
      toast.error("Not authenticated. Please login again.");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("admin_create_staff", {
        _session_token: sessionToken,
        _full_name: fullName,
        _phone: phone,
        _pin: pin,
        _role: selectedRole as "manager" | "accountant" | "delivery_staff" | "farm_worker" | "vet_staff" | "auditor",
      });

      if (error) {
        throw new Error(error.message);
      }

      const response = data as unknown as RpcResponse;

      if (!response?.success) {
        throw new Error(response?.error || "Failed to create user");
      }

      toast.success(response.message || "User created successfully");
      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setPin("");
    setSelectedRole("");
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    setTogglingUser(userId);
    try {
      const { data, error } = await supabase.rpc('admin_update_user_status', {
        _target_user_id: userId,
        _is_active: !currentStatus,
      });

      if (error) throw new Error(error.message);
      
      const result = data as unknown as RpcResponse;
      if (!result?.success) throw new Error(result?.error || 'Failed to update status');

      toast.success(result.message);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to update user status");
    } finally {
      setTogglingUser(null);
    }
  };

  const handleResetPin = async () => {
    if (!selectedUser || !newPin) {
      toast.error("Please enter a new PIN");
      return;
    }

    if (!/^\d{6}$/.test(newPin)) {
      toast.error("PIN must be exactly 6 digits");
      return;
    }

    setResettingPin(true);
    try {
      const { data, error } = await supabase.rpc('admin_reset_user_pin', {
        _target_user_id: selectedUser.id,
        _new_pin: newPin,
      });

      if (error) throw new Error(error.message);
      
      const result = data as unknown as RpcResponse;
      if (!result?.success) throw new Error(result?.error || 'Failed to reset PIN');

      toast.success(result.message);
      setResetPinDialogOpen(false);
      setSelectedUser(null);
      setNewPin("");
    } catch (error: any) {
      toast.error(error.message || "Failed to reset PIN");
    } finally {
      setResettingPin(false);
    }
  };

  const openResetPinDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setNewPin("");
    setResetPinDialogOpen(true);
  };

  const openDeleteDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || !sessionToken) {
      toast.error("Not authenticated");
      return;
    }

    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("admin_delete_staff_v2", {
        _session_token: sessionToken,
        _target_user_id: selectedUser.id,
      });

      if (error) {
        throw new Error(error.message);
      }

      const response = data as unknown as RpcResponse;

      if (!response?.success) {
        throw new Error(response?.error || "Failed to delete user");
      }

      toast.success(response.message || "User deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };


  const columns = [
    {
      key: "full_name",
      header: "Name",
      render: (user: UserProfile) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="font-medium">{user.full_name}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (user: UserProfile) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4" />
          {user.phone || "—"}
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user: UserProfile) => (
        <Badge variant="outline" className={roleColors[user.role] || ""}>
          <Shield className="mr-1 h-3 w-3" />
          {user.role.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
        </Badge>
      ),
    },
    {
      key: "is_active",
      header: "Status",
      render: (user: UserProfile) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={user.is_active}
            onCheckedChange={() => handleToggleStatus(user.id, user.is_active)}
            disabled={togglingUser === user.id || user.role === "super_admin"}
          />
          <span className={user.is_active ? "text-success" : "text-muted-foreground"}>
            {user.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (user: UserProfile) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => openResetPinDialog(user)}
            disabled={user.role === "super_admin"}
          >
            <RotateCcw className="h-3 w-3" />
            Reset PIN
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1"
            onClick={() => openDeleteDialog(user)}
            disabled={user.role === "super_admin"}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (roleLoading || role !== "super_admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Create and manage staff accounts"
        icon={Users}
      />

      <div className="flex justify-end gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add New User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create New User
              </DialogTitle>
              <DialogDescription>
                Create a new staff account with specific role permissions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  placeholder="10-digit phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin" className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  6-Digit PIN
                </Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="6-digit PIN for login"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Role
                </Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateUser} disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        searchable
        searchPlaceholder="Search users..."
      />

      {/* Reset PIN Dialog */}
      <Dialog open={resetPinDialogOpen} onOpenChange={setResetPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reset PIN
            </DialogTitle>
            <DialogDescription>
              Set a new 6-digit PIN for {selectedUser?.full_name}. They will use this PIN to log in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPin" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                New PIN
              </Label>
              <Input
                id="newPin"
                type="password"
                placeholder="6-digit PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                PIN must be exactly 6 digits
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPinDialogOpen(false);
                setSelectedUser(null);
                setNewPin("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleResetPin} disabled={resettingPin}>
              {resettingPin ? "Resetting..." : "Reset PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete User Permanently"
        description={`Are you sure you want to permanently delete "${selectedUser?.full_name}"? This action cannot be undone and will remove all associated data including their profile and login access.`}
        confirmText={deleting ? "Deleting..." : "Delete Permanently"}
        onConfirm={handleDeleteUser}
        variant="destructive"
      />

    </div>
  );
}
