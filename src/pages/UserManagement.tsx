import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
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
import { UserPlus, Users, Shield, Phone, KeyRound, User, RotateCcw, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { sanitizeError } from "@/lib/errors";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

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
  error?: string;
  message?: string;
}

interface PhoneAvailability {
  available: boolean;
  reactivatable?: boolean;
  orphaned_auth?: boolean;
  auth_user_id?: string;
  user_id?: string;
  full_name?: string;
  previous_role?: string;
  error?: string;
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
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetPinDialogOpen, setResetPinDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newPin, setNewPin] = useState("");
  const [creating, setCreating] = useState(false);
  const [resettingPin, setResettingPin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [deleteType, setDeleteType] = useState<"soft" | "permanent">("soft");
  
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  // Reactivation state
  const [reactivationUser, setReactivationUser] = useState<{
    id: string;
    name: string;
    previousRole?: string;
  } | null>(null);

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
      const { data, error } = await supabase
        .from("profiles_safe")
        .select("id, full_name, phone, role, is_active, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: unknown) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const checkPhoneAvailability = async (phoneNumber: string): Promise<PhoneAvailability> => {
    const { data, error } = await supabase.rpc('check_phone_availability', {
      _phone: phoneNumber,
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    return data as unknown as PhoneAvailability;
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

    setCreating(true);
    
    // Save admin session tokens at the start
    let adminTokens: { access_token: string; refresh_token: string } | null = null;
    let sessionRestored = false;
    
    const restoreAdminSession = async () => {
      if (sessionRestored || !adminTokens) return true;
      
      try {
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: adminTokens.access_token,
          refresh_token: adminTokens.refresh_token,
        });
        
        if (restoreError) {
          console.error("Failed to restore admin session:", restoreError);
          toast.error("Session error. Please log in again.");
          navigate("/auth");
          return false;
        }
        sessionRestored = true;
        return true;
      } catch (err) {
        console.error("Session restore exception:", err);
        toast.error("Session error. Please log in again.");
        navigate("/auth");
        return false;
      }
    };

    try {
      // First check if phone is available or reactivatable
      const availability = await checkPhoneAvailability(phone);
      
      if (!availability.available) {
        if (availability.orphaned_auth && availability.auth_user_id) {
          toast.info("Cleaning up orphaned record...");
          const { data: cleanupData, error: cleanupError } = await (supabase.rpc as Function)('admin_cleanup_orphaned_auth', {
            _phone: phone,
          });
          
          if (cleanupError) {
            throw new Error(`Cleanup failed: ${cleanupError.message}`);
          }
          
          const cleanupResult = cleanupData as unknown as RpcResponse;
          if (!cleanupResult?.success) {
            throw new Error(cleanupResult?.error || "Failed to cleanup orphaned record");
          }
          
          toast.success("Orphaned record cleaned up, creating user...");
        } else if (availability.reactivatable && availability.user_id) {
          setReactivationUser({
            id: availability.user_id,
            name: availability.full_name || "Unknown",
            previousRole: availability.previous_role,
          });
          setDialogOpen(false);
          setReactivateDialogOpen(true);
          setCreating(false);
          return;
        } else {
          throw new Error(availability.error || "Phone number already in use");
        }
      }

      // Step 1: Save current admin session
      const { data: currentSession } = await supabase.auth.getSession();
      if (!currentSession.session) {
        throw new Error("Admin session not found. Please log in again.");
      }
      adminTokens = {
        access_token: currentSession.session.access_token,
        refresh_token: currentSession.session.refresh_token,
      };

      // Step 2: Create auth user (this switches session to new user)
      const email = `${phone}@awadhdairy.com`;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: pin,
        options: {
          data: {
            phone,
            full_name: fullName,
          },
        },
      });

      // Step 3: IMMEDIATELY restore admin session before ANY other operations
      const restored = await restoreAdminSession();
      if (!restored) {
        setCreating(false);
        return;
      }

      // Now check signUp result
      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (!signUpData?.user) {
        throw new Error("Failed to create user account");
      }

      const newUserId = signUpData.user.id;

      // Step 4: Set up profile and role via RPC (running as admin)
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_create_staff_user', {
        _user_id: newUserId,
        _full_name: fullName,
        _phone: phone,
        _role: selectedRole as UserRole,
        _pin: pin,
      });

      // Check for RPC errors - this is critical
      if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw new Error(`Failed to set user role: ${rpcError.message}`);
      }

      const result = rpcData as unknown as RpcResponse;
      if (!result) {
        throw new Error("No response from server. Please check if the database function exists.");
      }
      
      if (!result.success) {
        throw new Error(result.error || "Failed to set up user profile");
      }

      toast.success("User created successfully with role: " + selectedRole);
      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: unknown) {
      // Ensure admin session is restored even on error
      await restoreAdminSession();
      
      const message = error instanceof Error ? error.message : "Failed to create user";
      console.error("Create user error:", error);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleReactivateUser = async () => {
    if (!reactivationUser || !fullName || !pin || !selectedRole) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      toast.error("PIN must be 6 digits");
      return;
    }

    setReactivating(true);
    try {
      const { data, error } = await supabase.rpc('admin_reactivate_user', {
        _user_id: reactivationUser.id,
        _full_name: fullName,
        _role: selectedRole as UserRole,
        _pin: pin,
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = data as unknown as RpcResponse;
      if (result && !result.success) {
        throw new Error(result.error || "Failed to reactivate user");
      }

      toast.success(result?.message || "User reactivated successfully");
      setReactivateDialogOpen(false);
      setReactivationUser(null);
      resetForm();
      fetchUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reactivate user";
      toast.error(message);
    } finally {
      setReactivating(false);
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

      if (error) {
        throw new Error(error.message);
      }

      const result = data as unknown as RpcResponse;
      if (result && !result.success) {
        throw new Error(result.error || "Failed to update status");
      }

      toast.success(result?.message || `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update user status";
      toast.error(message);
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

      if (error) {
        throw new Error(error.message);
      }

      const result = data as unknown as RpcResponse;
      if (result && !result.success) {
        throw new Error(result.error || "Failed to reset PIN");
      }

      toast.success(result?.message || "PIN reset successfully");
      setResetPinDialogOpen(false);
      setSelectedUser(null);
      setNewPin("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to reset PIN";
      toast.error(message);
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
    setDeleteType("soft");
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setDeleting(true);
    try {
      if (deleteType === "permanent") {
        // Call database function for permanent deletion from auth.users
        // Note: RPC name not in types yet - will be after SQL migration is run
        const { data, error } = await (supabase.rpc as Function)('admin_permanent_delete_user', {
          _target_user_id: selectedUser.id
        });
        
        if (error) {
          throw new Error(error.message);
        }
        
        const result = data as unknown as RpcResponse;
        if (!result?.success) {
          throw new Error(result?.error || "Failed to permanently delete user");
        }
        
        toast.success("User permanently deleted");
      } else {
        // Soft delete via RPC
        const { data, error } = await supabase.rpc('admin_delete_user', {
          _target_user_id: selectedUser.id,
          _permanent: false,
        });

        if (error) {
          throw new Error(error.message);
        }

        const result = data as unknown as RpcResponse;
        if (result && !result.success) {
          throw new Error(result.error || "Failed to delete user");
        }

        toast.success(result?.message || "User deactivated successfully");
      }

      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete user";
      toast.error(message);
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

      {/* Delete User Dialog with Options */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Choose how to remove {selectedUser?.full_name} from the system.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={deleteType} onValueChange={(v) => setDeleteType(v as "soft" | "permanent")}>
              <div className="flex items-start space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="soft" id="soft" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="soft" className="font-medium cursor-pointer">
                    Deactivate (Recommended)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    User cannot log in but can be reactivated later. Data is preserved.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <RadioGroupItem value="permanent" id="permanent" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="permanent" className="font-medium cursor-pointer flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Permanent Delete
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Completely removes user from the system. This action cannot be undone.
                    Phone number can be reused for a new account.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser} 
              disabled={deleting}
            >
              {deleting ? "Deleting..." : deleteType === "permanent" ? "Permanently Delete" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate User Dialog */}
      <Dialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Reactivate Existing User
            </DialogTitle>
            <DialogDescription>
              A user with this phone number was previously deactivated. 
              Would you like to reactivate them instead?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/50 p-4 mb-4">
            <p className="text-sm">
              <strong>Previous Name:</strong> {reactivationUser?.name}
            </p>
            {reactivationUser?.previousRole && (
              <p className="text-sm">
                <strong>Previous Role:</strong> {reactivationUser.previousRole.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reactivateName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name
              </Label>
              <Input
                id="reactivateName"
                placeholder="Enter full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reactivatePin" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                New 6-Digit PIN
              </Label>
              <Input
                id="reactivatePin"
                type="password"
                placeholder="6-digit PIN for login"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reactivateRole" className="flex items-center gap-2">
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

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setReactivateDialogOpen(false);
                setReactivationUser(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleReactivateUser} disabled={reactivating}>
              {reactivating ? "Reactivating..." : "Reactivate User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
