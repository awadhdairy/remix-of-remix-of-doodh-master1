import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface UserRoleData {
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  userName: string | null;
}

export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        // Fetch role from user_roles table
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (roleError) {
          setError(roleError.message);
          setLoading(false);
          return;
        }

        // Fetch user name from profiles_safe view (excludes pin_hash)
        const { data: profileData } = await supabase
          .from("profiles_safe")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        setRole(roleData?.role || null);
        setUserName(profileData?.full_name || null);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch user role");
        setLoading(false);
      }
    };

    fetchUserRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { role, loading, error, userName };
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
