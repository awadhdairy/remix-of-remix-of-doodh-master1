import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, differenceInDays, parseISO } from "date-fns";

interface CattleUpdate {
  cattle_id: string;
  tag_number: string;
  update_type: "lactation_status" | "status";
  old_value: string | null;
  new_value: string;
  reason: string;
}

interface AutomationResult {
  updated: number;
  updates: CattleUpdate[];
  errors: string[];
}

/**
 * Cattle status automation based on breeding and production data
 * 
 * Status Rules:
 * 1. After calving → lactation_status = "lactating"
 * 2. 60 days before expected calving → lactation_status = "dry"
 * 3. After pregnancy confirmation → lactation_status = "pregnant" (if not already lactating)
 * 4. No milk production for 30+ days → lactation_status = "dry"
 */
export function useCattleStatusAutomation() {
  /**
   * Run all status checks and update cattle accordingly
   */
  const runAutomation = useCallback(async (): Promise<AutomationResult> => {
    const result: AutomationResult = { updated: 0, updates: [], errors: [] };
    const today = new Date();

    try {
      // Fetch all active cattle with their breeding records
      const { data: cattle, error: cattleError } = await supabase
        .from("cattle")
        .select("id, tag_number, lactation_status, status")
        .eq("status", "active")
        .eq("cattle_type", "cow");

      if (cattleError) {
        result.errors.push(`Failed to fetch cattle: ${cattleError.message}`);
        return result;
      }

      // Fetch breeding records
      const { data: breedingRecords } = await supabase
        .from("breeding_records")
        .select("*")
        .order("record_date", { ascending: false });

      // Fetch recent milk production (last 30 days)
      const thirtyDaysAgo = addDays(today, -30).toISOString().split("T")[0];
      const { data: production } = await supabase
        .from("milk_production")
        .select("cattle_id, production_date")
        .gte("production_date", thirtyDaysAgo);

      const productionByCattle = new Map<string, Date>();
      production?.forEach(p => {
        const existing = productionByCattle.get(p.cattle_id);
        const recordDate = parseISO(p.production_date);
        if (!existing || recordDate > existing) {
          productionByCattle.set(p.cattle_id, recordDate);
        }
      });

      // Build breeding status map
      const breedingByCattle = new Map<string, {
        hasCalved: boolean;
        lastCalvingDate?: Date;
        isPregnant: boolean;
        expectedCalvingDate?: Date;
        needsDryOff: boolean;
      }>();

      breedingRecords?.forEach(record => {
        const existing = breedingByCattle.get(record.cattle_id) || {
          hasCalved: false,
          isPregnant: false,
          needsDryOff: false,
        };

        if (record.record_type === "calving" && record.actual_calving_date) {
          const calvingDate = parseISO(record.actual_calving_date);
          if (!existing.lastCalvingDate || calvingDate > existing.lastCalvingDate) {
            existing.hasCalved = true;
            existing.lastCalvingDate = calvingDate;
          }
        }

        if (record.record_type === "pregnancy_check" && record.pregnancy_confirmed) {
          existing.isPregnant = true;
          if (record.expected_calving_date) {
            existing.expectedCalvingDate = parseISO(record.expected_calving_date);
            // Check if within 60 days of calving
            const daysUntilCalving = differenceInDays(existing.expectedCalvingDate, today);
            if (daysUntilCalving <= 60 && daysUntilCalving > 0) {
              existing.needsDryOff = true;
            }
          }
        }

        breedingByCattle.set(record.cattle_id, existing);
      });

      // Determine status updates
      for (const cow of cattle || []) {
        const breeding = breedingByCattle.get(cow.id);
        const lastProductionDate = productionByCattle.get(cow.id);
        let newLactationStatus: string | null = null;
        let reason = "";

        // Rule 1: Dry-off required (60 days before calving)
        if (breeding?.needsDryOff && cow.lactation_status === "lactating") {
          newLactationStatus = "dry";
          reason = "60 days before expected calving - dry-off required";
        }
        // Rule 2: Recent calving (within 7 days) → lactating
        else if (breeding?.lastCalvingDate) {
          const daysSinceCalving = differenceInDays(today, breeding.lastCalvingDate);
          if (daysSinceCalving <= 7 && daysSinceCalving >= 0 && cow.lactation_status !== "lactating") {
            newLactationStatus = "lactating";
            reason = "Recent calving - now lactating";
          }
        }
        // Rule 3: Pregnant confirmation (update if not lactating)
        else if (breeding?.isPregnant && !cow.lactation_status) {
          newLactationStatus = "pregnant";
          reason = "Pregnancy confirmed";
        }
        // Rule 4: No production for 30+ days → dry
        else if (cow.lactation_status === "lactating") {
          if (!lastProductionDate || differenceInDays(today, lastProductionDate) > 30) {
            newLactationStatus = "dry";
            reason = "No milk production recorded for 30+ days";
          }
        }

        if (newLactationStatus && newLactationStatus !== cow.lactation_status) {
          const { error } = await supabase
            .from("cattle")
            .update({ lactation_status: newLactationStatus as any })
            .eq("id", cow.id);

          if (error) {
            result.errors.push(`Failed to update ${cow.tag_number}: ${error.message}`);
          } else {
            result.updated++;
            result.updates.push({
              cattle_id: cow.id,
              tag_number: cow.tag_number,
              update_type: "lactation_status",
              old_value: cow.lactation_status,
              new_value: newLactationStatus,
              reason,
            });
          }
        }
      }

      return result;
    } catch (error: any) {
      result.errors.push(`Unexpected error: ${error.message}`);
      return result;
    }
  }, []);

  return { runAutomation };
}
