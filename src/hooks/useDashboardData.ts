import { useQuery } from "@tanstack/react-query";
import { externalSupabase as supabase } from "@/lib/external-supabase";
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
  lastProductionDate: string | null;
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

  // Fetch all data in parallel
  const productionPromise = supabase
    .from("milk_production")
    .select("session, quantity_liters, production_date")
    .eq("production_date", todayStr);

  const lastProductionPromise = supabase
    .from("milk_production")
    .select("production_date")
    .order("production_date", { ascending: false })
    .limit(1);

  const cattlePromise = supabase
    .from("cattle")
    .select("id, tag_number, name, status, lactation_status");

  const customersPromise = supabase
    .from("customers")
    .select("is_active, credit_balance");

  // This month's invoices for revenue calculation — filtered by billing_period_start
  // so invoices are attributed to the period they cover, not when they were created.
  const invoicesPromise = supabase
    .from("invoices")
    .select("final_amount")
    .gte("billing_period_start", monthStart)
    .lte("billing_period_start", monthEnd);

  // Ledger-accurate pending: sum positive credit_balance values from customers table.
  // customers.credit_balance is kept in sync by the update_customer_balance_from_ledger trigger.
  // A positive credit_balance means the customer owes money (total debits > total credits).
  // This avoids the capped invoices.paid_amount limitation and accounts for overpayments.
  const pendingPromise = supabase
    .from("customers")
    .select("credit_balance")
    .eq("is_active", true);

  const breedingPromise = supabase
    .from("breeding_records")
    .select("id, cattle_id, record_type, record_date, expected_calving_date, heat_cycle_day, pregnancy_confirmed");

  const healthPromise = supabase
    .from("cattle_health")
    .select("id, cattle_id, record_type, title, next_due_date");

  const [
    productionRes,
    lastProductionRes,
    cattleRes,
    customersRes,
    invoicesRes,
    pendingRes,
    breedingRes,
    healthRes,
  ] = await Promise.all([
    productionPromise,
    lastProductionPromise,
    cattlePromise,
    customersPromise,
    invoicesPromise,
    pendingPromise,
    breedingPromise,
    healthPromise,
  ]);

  const production = productionRes.data || [];
  const lastProduction = lastProductionRes.data || [];
  const cattleData = cattleRes.data || [];
  const customers = customersRes.data || [];
  const invoices = invoicesRes.data || [];
  const pendingCustomers = pendingRes.data || [];
  const breedingData = breedingRes.data || [];
  const healthData = healthRes.data || [];

  const morningProduction = production
    .filter(p => p.session === "morning")
    .reduce((sum, p) => sum + Number(p.quantity_liters), 0);
  
  const eveningProduction = production
    .filter(p => p.session === "evening")
    .reduce((sum, p) => sum + Number(p.quantity_liters), 0);

  const activeCattle = cattleData.filter(c => c.status === "active");
  
  // Get last production date if no production today
  const lastProductionDate = production.length === 0 && lastProduction.length > 0
    ? lastProduction[0].production_date
    : null;
  
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
    // Ledger-accurate pending: sum positive credit_balance across all active customers.
    // credit_balance is synced by DB trigger from customer_ledger, handling overpayments correctly.
    pendingAmount: pendingCustomers.reduce((sum, c) => sum + Math.max(0, Number(c.credit_balance || 0)), 0),
    lastProductionDate,
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
    staleTime: 1 * 60 * 1000, // 1 minute for real-time sync
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export type { DashboardStats, Cattle, BreedingRecord, HealthRecord };
