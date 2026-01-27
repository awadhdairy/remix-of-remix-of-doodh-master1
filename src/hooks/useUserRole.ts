import { useStaffAuth } from '@/contexts/StaffAuthContext';
import { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface UserRoleData {
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  userName: string | null;
}

export function useUserRole(): UserRoleData {
  const { user, loading } = useStaffAuth();
  
  return {
    role: (user?.role as UserRole) || null,
    loading,
    error: null,
    userName: user?.full_name || null,
  };
}

// Role-based permission checks
export const rolePermissions = {
  super_admin: {
    canAccessAll: true,
    dashboardType: "admin" as const,
    navSections: ["main", "management", "settings"],
  },
  manager: {
    canAccessAll: true,
    dashboardType: "admin" as const,
    navSections: ["main", "management", "settings"],
  },
  accountant: {
    canAccessAll: false,
    dashboardType: "accountant" as const,
    navSections: ["billing", "expenses", "reports"],
  },
  delivery_staff: {
    canAccessAll: false,
    dashboardType: "delivery" as const,
    navSections: ["deliveries", "customers", "bottles"],
  },
  farm_worker: {
    canAccessAll: false,
    dashboardType: "farm" as const,
    navSections: ["cattle", "production", "health", "inventory"],
  },
  vet_staff: {
    canAccessAll: false,
    dashboardType: "vet" as const,
    navSections: ["cattle", "health"],
  },
  auditor: {
    canAccessAll: false,
    dashboardType: "auditor" as const,
    navSections: ["reports", "expenses", "billing"],
  },
};
