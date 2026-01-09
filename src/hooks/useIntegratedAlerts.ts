import { useMemo } from "react";
import { differenceInDays, parseISO, addDays, isBefore, format } from "date-fns";

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  category: "breeding" | "health" | "inventory" | "payment" | "delivery" | "production";
  title: string;
  description: string;
  dueDate?: Date;
  daysUntil?: number;
  entityId?: string;
  entityType?: string;
  priority: number;
  actionLabel?: string;
  actionRoute?: string;
}

interface BreedingRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  record_date: string;
  expected_calving_date?: string | null;
  pregnancy_confirmed?: boolean | null;
}

interface HealthRecord {
  id: string;
  cattle_id: string;
  record_type: string;
  title: string;
  next_due_date?: string | null;
}

interface Cattle {
  id: string;
  tag_number: string;
  name?: string | null;
  status?: string | null;
  lactation_status?: string | null;
}

interface FeedInventory {
  id: string;
  name: string;
  current_stock: number | null;
  min_stock_level: number | null;
  unit: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  final_amount: number;
  paid_amount: number;
  payment_status: string;
  due_date?: string | null;
}

interface ProductionAnomaly {
  cattle_id: string;
  tag_number: string;
  date: string;
  expected: number;
  actual: number;
  deviation: number;
  type: "high" | "low";
}

/**
 * Integrated alert system that combines all module alerts
 * 
 * Alert Sources:
 * 1. Breeding: Calving, heat cycles, pregnancy checks
 * 2. Health: Vaccinations, treatments due
 * 3. Inventory: Low stock warnings
 * 4. Payments: Overdue invoices
 * 5. Production: Anomaly detection
 */
export function useIntegratedAlerts(
  breedingRecords: BreedingRecord[],
  healthRecords: HealthRecord[],
  cattle: Cattle[],
  feedInventory: FeedInventory[],
  invoices: Invoice[],
  productionAnomalies: ProductionAnomaly[] = []
) {
  const cattleMap = useMemo(() => {
    return new Map(cattle.map(c => [c.id, c]));
  }, [cattle]);

  const alerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertsList: Alert[] = [];

    // 1. BREEDING ALERTS
    breedingRecords.forEach(record => {
      const cattleInfo = cattleMap.get(record.cattle_id);
      if (!cattleInfo || cattleInfo.status !== "active") return;

      const cattleLabel = `${cattleInfo.tag_number}${cattleInfo.name ? ` (${cattleInfo.name})` : ""}`;

      // Calving alerts
      if (record.expected_calving_date && record.pregnancy_confirmed) {
        const calvingDate = parseISO(record.expected_calving_date);
        const daysUntil = differenceInDays(calvingDate, today);

        if (daysUntil >= -7 && daysUntil <= 14) {
          alertsList.push({
            id: `calving-${record.id}`,
            type: daysUntil <= 0 ? "critical" : daysUntil <= 7 ? "warning" : "info",
            category: "breeding",
            title: daysUntil <= 0 ? "Calving Overdue/Due" : "Upcoming Calving",
            description: `${cattleLabel} expected to calve ${
              daysUntil === 0 ? "today" : daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `in ${daysUntil} days`
            }`,
            dueDate: calvingDate,
            daysUntil,
            entityId: record.cattle_id,
            entityType: "cattle",
            priority: daysUntil <= 0 ? 1 : 2,
            actionLabel: "View Breeding",
            actionRoute: "/breeding",
          });
        }

        // Dry-off reminder (60 days before calving)
        const dryOffDate = addDays(calvingDate, -60);
        const daysUntilDryOff = differenceInDays(dryOffDate, today);

        if (daysUntilDryOff >= -3 && daysUntilDryOff <= 14 && cattleInfo.lactation_status === "lactating") {
          alertsList.push({
            id: `dryoff-${record.id}`,
            type: daysUntilDryOff <= 0 ? "critical" : "warning",
            category: "breeding",
            title: "Dry-Off Required",
            description: `${cattleLabel} should be dried off ${
              daysUntilDryOff === 0 ? "today" : daysUntilDryOff < 0 ? `${Math.abs(daysUntilDryOff)} days ago` : `in ${daysUntilDryOff} days`
            }`,
            dueDate: dryOffDate,
            daysUntil: daysUntilDryOff,
            entityId: record.cattle_id,
            entityType: "cattle",
            priority: daysUntilDryOff <= 0 ? 1 : 2,
          });
        }
      }

      // Heat cycle prediction
      if (record.record_type === "heat_detection" && !record.pregnancy_confirmed) {
        const lastHeatDate = parseISO(record.record_date);
        const nextHeatDate = addDays(lastHeatDate, 21);
        const daysUntil = differenceInDays(nextHeatDate, today);

        if (daysUntil >= -2 && daysUntil <= 5) {
          alertsList.push({
            id: `heat-${record.id}`,
            type: daysUntil <= 0 ? "warning" : "info",
            category: "breeding",
            title: daysUntil <= 0 ? "Heat Expected Now" : "Upcoming Heat",
            description: `${cattleLabel} expected in heat ${
              daysUntil === 0 ? "today" : daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `in ${daysUntil} days`
            }`,
            dueDate: nextHeatDate,
            daysUntil,
            entityId: record.cattle_id,
            entityType: "cattle",
            priority: daysUntil <= 0 ? 2 : 3,
            actionLabel: "Record AI",
            actionRoute: "/breeding",
          });
        }
      }
    });

    // 2. HEALTH ALERTS
    healthRecords.forEach(record => {
      if (!record.next_due_date) return;

      const cattleInfo = cattleMap.get(record.cattle_id);
      if (!cattleInfo || cattleInfo.status !== "active") return;

      const dueDate = parseISO(record.next_due_date);
      const daysUntil = differenceInDays(dueDate, today);

      if (daysUntil >= -7 && daysUntil <= 14) {
        alertsList.push({
          id: `health-${record.id}`,
          type: daysUntil <= 0 ? "critical" : daysUntil <= 3 ? "warning" : "info",
          category: "health",
          title: daysUntil <= 0 ? `${record.record_type} Overdue` : `${record.record_type} Due`,
          description: `${cattleInfo.tag_number}: ${record.title} ${
            daysUntil === 0 ? "due today" : daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : `due in ${daysUntil} days`
          }`,
          dueDate,
          daysUntil,
          entityId: record.cattle_id,
          entityType: "cattle",
          priority: daysUntil <= 0 ? 1 : 2,
          actionLabel: "Add Record",
          actionRoute: "/health",
        });
      }
    });

    // 3. INVENTORY ALERTS
    feedInventory.forEach(item => {
      const currentStock = item.current_stock || 0;
      const minLevel = item.min_stock_level || 0;

      if (minLevel > 0 && currentStock <= minLevel) {
        const stockPercentage = (currentStock / minLevel) * 100;
        
        alertsList.push({
          id: `inventory-${item.id}`,
          type: stockPercentage <= 25 ? "critical" : "warning",
          category: "inventory",
          title: stockPercentage <= 25 ? "Critical Low Stock" : "Low Stock Warning",
          description: `${item.name}: ${currentStock} ${item.unit} remaining (min: ${minLevel} ${item.unit})`,
          entityId: item.id,
          entityType: "feed",
          priority: stockPercentage <= 25 ? 1 : 2,
          actionLabel: "Reorder",
          actionRoute: "/inventory",
        });
      }
    });

    // 4. PAYMENT ALERTS
    invoices.forEach(invoice => {
      if (invoice.payment_status === "paid") return;

      const balance = invoice.final_amount - invoice.paid_amount;
      if (balance <= 0) return;

      const isOverdue = invoice.due_date && isBefore(parseISO(invoice.due_date), today);
      const daysUntil = invoice.due_date ? differenceInDays(parseISO(invoice.due_date), today) : null;

      if (isOverdue || (daysUntil !== null && daysUntil <= 7)) {
        alertsList.push({
          id: `payment-${invoice.id}`,
          type: isOverdue ? "critical" : "warning",
          category: "payment",
          title: isOverdue ? "Payment Overdue" : "Payment Due Soon",
          description: `${invoice.customer_name || "Customer"}: ₹${balance.toLocaleString()} ${
            isOverdue ? `overdue (${invoice.invoice_number})` : `due in ${daysUntil} days`
          }`,
          dueDate: invoice.due_date ? parseISO(invoice.due_date) : undefined,
          daysUntil: daysUntil ?? undefined,
          entityId: invoice.id,
          entityType: "invoice",
          priority: isOverdue ? 1 : 2,
          actionLabel: "Record Payment",
          actionRoute: "/billing",
        });
      }
    });

    // 5. PRODUCTION ALERTS
    productionAnomalies.forEach((anomaly, index) => {
      alertsList.push({
        id: `production-anomaly-${index}`,
        type: Math.abs(anomaly.deviation) > 50 ? "warning" : "info",
        category: "production",
        title: anomaly.type === "low" ? "Low Production Alert" : "Unusual High Production",
        description: `${anomaly.tag_number} on ${format(parseISO(anomaly.date), "dd MMM")}: ${
          anomaly.actual}L (expected ${anomaly.expected}L, ${anomaly.deviation > 0 ? "+" : ""}${anomaly.deviation}%)`,
        entityId: anomaly.cattle_id,
        entityType: "cattle",
        priority: anomaly.type === "low" && Math.abs(anomaly.deviation) > 50 ? 2 : 3,
        actionLabel: "View Details",
        actionRoute: "/production",
      });
    });

    // Sort by priority, then by daysUntil
    return alertsList.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const aUntil = a.daysUntil ?? 999;
      const bUntil = b.daysUntil ?? 999;
      return aUntil - bUntil;
    });
  }, [breedingRecords, healthRecords, cattleMap, feedInventory, invoices, productionAnomalies]);

  // Aggregate counts
  const criticalCount = alerts.filter(a => a.type === "critical").length;
  const warningCount = alerts.filter(a => a.type === "warning").length;
  const infoCount = alerts.filter(a => a.type === "info").length;

  // Group by category
  const alertsByCategory = useMemo(() => {
    const grouped: Record<string, Alert[]> = {};
    alerts.forEach(alert => {
      if (!grouped[alert.category]) {
        grouped[alert.category] = [];
      }
      grouped[alert.category].push(alert);
    });
    return grouped;
  }, [alerts]);

  return {
    alerts,
    criticalCount,
    warningCount,
    infoCount,
    totalCount: alerts.length,
    alertsByCategory,
  };
}
