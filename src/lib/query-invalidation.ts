import { QueryClient } from "@tanstack/react-query";

export function invalidateProductionRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  queryClient.invalidateQueries({ queryKey: ["procurement-vs-production-chart"] });
  queryClient.invalidateQueries({ queryKey: ["month-comparison-chart"] });
}

export function invalidateDeliveryRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  queryClient.invalidateQueries({ queryKey: ["delivery-performance-chart"] });
}

export function invalidateBillingRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  queryClient.invalidateQueries({ queryKey: ["revenue-growth-chart"] });
  queryClient.invalidateQueries({ queryKey: ["month-comparison-chart"] });
}

export function invalidateCustomerRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  queryClient.invalidateQueries({ queryKey: ["customer-growth-chart"] });
}

export function invalidateCattleRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  queryClient.invalidateQueries({ queryKey: ["cattle-composition-chart"] });
}

export function invalidateExpenseRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  queryClient.invalidateQueries({ queryKey: ["expense-breakdown-chart"] });
  queryClient.invalidateQueries({ queryKey: ["month-comparison-chart"] });
}

export function invalidateProcurementRelated(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  queryClient.invalidateQueries({ queryKey: ["procurement-vs-production-chart"] });
}
