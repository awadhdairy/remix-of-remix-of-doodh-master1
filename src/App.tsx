import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CattlePage from "./pages/Cattle";
import ProductionPage from "./pages/Production";
import ProductsPage from "./pages/Products";
import CustomersPage from "./pages/Customers";
import DeliveriesPage from "./pages/Deliveries";
import BillingPage from "./pages/Billing";
import BottlesPage from "./pages/Bottles";
import HealthPage from "./pages/Health";
import InventoryPage from "./pages/Inventory";
import ExpensesPage from "./pages/Expenses";
import ReportsPage from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import EmployeesPage from "./pages/Employees";
import BreedingPage from "./pages/Breeding";
import EquipmentPage from "./pages/Equipment";
import RoutesPage from "./pages/Routes";
import PriceRulesPage from "./pages/PriceRules";
import AuditLogsPage from "./pages/AuditLogs";
import NotificationsPage from "./pages/Notifications";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/cattle" element={<CattlePage />} />
            <Route path="/production" element={<ProductionPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/deliveries" element={<DeliveriesPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/bottles" element={<BottlesPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/breeding" element={<BreedingPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/price-rules" element={<PriceRulesPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
