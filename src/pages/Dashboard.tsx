import { Calendar, Shield } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { DeliveryDashboard } from "@/components/dashboard/DeliveryDashboard";
import { FarmDashboard } from "@/components/dashboard/FarmDashboard";
import { AccountantDashboard } from "@/components/dashboard/AccountantDashboard";
import { VetDashboard } from "@/components/dashboard/VetDashboard";
import { AuditorDashboard } from "@/components/dashboard/AuditorDashboard";
import { CustomerAccountApprovals } from "@/components/customers/CustomerAccountApprovals";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/common/LoadingSkeleton";
import { motion } from "framer-motion";
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

function DashboardHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-2 mt-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
    </div>
  );
}

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
      <div className="space-y-6">
        <DashboardHeaderSkeleton />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
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

  const isAdminOrManager = role === 'super_admin' || role === 'manager';

  return (
    <div className="space-y-6">
      {/* Customer Account Approvals - Only for admins/managers */}
      {isAdminOrManager && (
        <CustomerAccountApprovals />
      )}

      {/* Header */}
      <motion.div
        className="flex flex-col gap-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <motion.h1 
              className="text-2xl font-bold text-foreground md:text-3xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {userName ? `Welcome, ${userName}` : "Dashboard"}
            </motion.h1>
            <motion.div 
              className="flex items-center gap-2 text-sm text-muted-foreground mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Calendar className="h-4 w-4" />
              <span>{today}</span>
            </motion.div>
          </div>
          {role && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
            >
              <Badge className={`${roleColors[role] || "bg-muted"} flex items-center gap-1.5 px-3 py-1.5`}>
                <Shield className="h-3.5 w-3.5" />
                {roleLabels[role] || role}
              </Badge>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Role-specific Dashboard Content */}
      {renderDashboard()}
    </div>
  );
}
