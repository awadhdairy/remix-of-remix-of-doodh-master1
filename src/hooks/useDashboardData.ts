import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface DashboardStats {
  todayProduction: number;
  morningProduction: number;
  eveningProduction: number;
  totalCattle: number;
  lactatingCattle: number;
  dryCattle: number;
  totalCustomers: number;
  activeCustomers: number;
  monthlyRevenue: number;
  pendingAmount: number;
}

interface Cattle {
  id: string;
  tag_number: string;
  name: string | null;
  status: string | null;
  lactation_status: string | null;
}

interface BreedingRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  record_date: string;
  expected_calving_date: string | null;
  heat_cycle_day: number | null;
  pregnancy_confirmed: boolean | null;
}

interface HealthRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  title: string;
  next_due_date: string | null;
}

async function fetchDashboardData() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [
    productionRes,
    cattleRes,
    customersRes,
    invoicesRes,
    breedingRes,
    healthRes,
  ] = await Promise.all([
    supabase
      .from("milk_production")
      .select("session, quantity_liters")
      .eq("production_date", todayStr),
    supabase
      .from("cattle")
      .select("id, tag_number, name, status, lactation_status"),
    supabase
      .from("customers")
      .select("is_active"),
    supabase
      .from("invoices")
      .select("final_amount, paid_amount")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd),
    supabase
      .from("breeding_records")
      .select("id, cattle_id, record_type, record_date, expected_calving_date, heat_cycle_day, pregnancy_confirmed"),
    supabase
      .from("cattle_health")
      .select("id, cattle_id, record_type, title, next_due_date"),
  ]);

  const production = productionRes.data || [];
  const cattleData = cattleRes.data || [];
  const customers = customersRes.data || [];
  const invoices = invoicesRes.data || [];
  const breedingData = breedingRes.data || [];
  const healthData = healthRes.data || [];

  const morningProduction = production
    .filter(p => p.session === "morning")
    .reduce((sum, p) => sum + Number(p.quantity_liters), 0);
  
  const eveningProduction = production
    .filter(p => p.session === "evening")
    .reduce((sum, p) => sum + Number(p.quantity_liters), 0);

  const activeCattle = cattleData.filter(c => c.status === "active");
  
  const stats: DashboardStats = {
    todayProduction: morningProduction + eveningProduction,
    morningProduction,
    eveningProduction,
    totalCattle: activeCattle.length,
    lactatingCattle: cattleData.filter(c => c.lactation_status === "lactating").length,
    dryCattle: cattleData.filter(c => c.lactation_status === "dry").length,
    totalCustomers: customers.length,
    activeCustomers: customers.filter(c => c.is_active).length,
    monthlyRevenue: invoices.reduce((sum, i) => sum + Number(i.final_amount), 0),
    pendingAmount: invoices.reduce((sum, i) => sum + (Number(i.final_amount) - Number(i.paid_amount)), 0),
  };

  return {
    stats,
    cattle: cattleData,
    breedingRecords: breedingData,
    healthRecords: healthData,
  };
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard-data"],
    queryFn: fetchDashboardData,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
  });
}

export type { DashboardStats, Cattle, BreedingRecord, HealthRecord };
