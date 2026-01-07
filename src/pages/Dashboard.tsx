import { Calendar, Loader2, Shield } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { DeliveryDashboard } from "@/components/dashboard/DeliveryDashboard";
import { FarmDashboard } from "@/components/dashboard/FarmDashboard";
import { AccountantDashboard } from "@/components/dashboard/AccountantDashboard";
import { VetDashboard } from "@/components/dashboard/VetDashboard";
import { AuditorDashboard } from "@/components/dashboard/AuditorDashboard";
import { Badge } from "@/components/ui/badge";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  accountant: "Accountant",
  delivery_staff: "Delivery Staff",
  farm_worker: "Farm Worker",
  vet_staff: "Veterinary Staff",
  auditor: "Auditor",
};

const roleColors: Record<string, string> = {
  super_admin: "bg-role-admin text-white",
  manager: "bg-role-manager text-white",
  accountant: "bg-role-accountant text-white",
  delivery_staff: "bg-role-delivery text-white",
  farm_worker: "bg-role-farm text-white",
  vet_staff: "bg-role-vet text-white",
  auditor: "bg-role-auditor text-white",
};

export default function Dashboard() {
  const { role, loading, userName } = useUserRole();

  const today = new Date().toLocaleDateString('en-IN', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderDashboard = () => {
    switch (role) {
      case "super_admin":
      case "manager":
        return <AdminDashboard />;
      case "accountant":
        return <AccountantDashboard />;
      case "delivery_staff":
        return <DeliveryDashboard />;
      case "farm_worker":
        return <FarmDashboard />;
      case "vet_staff":
        return <VetDashboard />;
      case "auditor":
        return <AuditorDashboard />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">
              {userName ? `Welcome, ${userName}` : "Dashboard"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Calendar className="h-4 w-4" />
              <span>{today}</span>
            </div>
          </div>
          {role && (
            <Badge className={`${roleColors[role] || "bg-muted"} flex items-center gap-1.5 px-3 py-1.5`}>
              <Shield className="h-3.5 w-3.5" />
              {roleLabels[role] || role}
            </Badge>
          )}
        </div>
      </div>

      {/* Role-specific Dashboard Content */}
      {renderDashboard()}
    </div>
  );
}
