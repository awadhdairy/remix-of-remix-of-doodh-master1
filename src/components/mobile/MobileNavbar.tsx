import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useCapacitor } from "@/hooks/useCapacitor";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  Truck,
  Users,
  Package,
  Menu,
  Beef,
  Droplets,
  Receipt,
  Stethoscope,
  Baby,
  Settings,
  X,
  LogOut,
  UserCircle,
  Shield,
  Milk,
  Wheat,
  Wallet,
  BarChart3,
  UsersRound,
  MapPin,
  DollarSign,
  Activity,
  Bell,
  Wrench,
  Sun,
  Moon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetClose,
} from "@/components/ui/sheet";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import awadhDairyLogo from "@/assets/awadh-dairy-logo.png";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
}

// Bottom nav items per role
const deliveryStaffNav: NavItem[] = [
  { title: "Home", href: "/dashboard", icon: LayoutDashboard },
  { title: "Cattle", href: "/cattle", icon: Beef },
  { title: "Production", href: "/production", icon: Droplets },
  { title: "Customers", href: "/customers", icon: Users },
];

const farmWorkerNav: NavItem[] = [
  { title: "Home", href: "/dashboard", icon: LayoutDashboard },
  { title: "Cattle", href: "/cattle", icon: Beef },
  { title: "Production", href: "/production", icon: Droplets },
  { title: "Health", href: "/health", icon: Stethoscope },
];

// Full menu items
const allMenuItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, section: "main" },
  { title: "Cattle", href: "/cattle", icon: Beef, section: "cattle" },
  { title: "Milk Production", href: "/production", icon: Droplets, section: "production" },
  { title: "Milk Procurement", href: "/milk-procurement", icon: Milk, section: "production" },
  { title: "Products", href: "/products", icon: Milk, section: "main" },
  { title: "Customers", href: "/customers", icon: Users, section: "customers" },
  { title: "Deliveries", href: "/deliveries", icon: Truck, section: "deliveries" },
  { title: "Routes", href: "/routes", icon: MapPin, section: "deliveries" },
  { title: "Billing", href: "/billing", icon: Receipt, section: "billing" },
  { title: "Bottles", href: "/bottles", icon: Package, section: "bottles" },
  { title: "Health Records", href: "/health", icon: Stethoscope, section: "health" },
  { title: "Breeding", href: "/breeding", icon: Baby, section: "health" },
  { title: "Feed & Inventory", href: "/inventory", icon: Wheat, section: "inventory" },
  { title: "Equipment", href: "/equipment", icon: Wrench, section: "inventory" },
  { title: "Expenses", href: "/expenses", icon: Wallet, section: "expenses" },
  { title: "Price Rules", href: "/price-rules", icon: DollarSign, section: "billing" },
  { title: "Reports", href: "/reports", icon: BarChart3, section: "reports" },
  { title: "Employees", href: "/employees", icon: UsersRound, section: "employees" },
  { title: "User Management", href: "/users", icon: UsersRound, section: "users" },
  { title: "Notifications", href: "/notifications", icon: Bell, section: "notifications" },
  { title: "Audit Logs", href: "/audit-logs", icon: Activity, section: "audit" },
];

// Define which sections each role can access
const roleSections: Record<string, string[]> = {
  super_admin: ["main", "cattle", "production", "customers", "deliveries", "billing", "bottles", "health", "inventory", "expenses", "reports", "settings", "users", "employees", "notifications", "audit"],
  manager: ["main", "cattle", "production", "customers", "deliveries", "billing", "bottles", "health", "inventory", "expenses", "reports", "settings", "employees", "notifications"],
  accountant: ["main", "billing", "expenses", "reports", "customers", "employees"],
  delivery_staff: ["main", "deliveries", "customers", "bottles"],
  farm_worker: ["main", "cattle", "production", "health", "inventory"],
  vet_staff: ["main", "cattle", "health"],
  auditor: ["main", "billing", "expenses", "reports", "audit"],
};

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  accountant: "Accountant",
  delivery_staff: "Delivery Staff",
  farm_worker: "Farm Worker",
  vet_staff: "Vet Staff",
  auditor: "Auditor",
};

export function MobileNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, userName } = useUserRole();
  const [open, setOpen] = useState(false);
  const { hapticSelection, hapticImpact, isNative } = useCapacitor();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  // Get sections this role can access
  const allowedSections = role ? roleSections[role] || [] : [];
  
  // Filter menu items based on role
  const visibleMenuItems = allMenuItems.filter(item => 
    item.section && allowedSections.includes(item.section)
  );

  const canAccessSettings = role === "super_admin" || role === "manager";

  // Get nav items based on role
  const getNavItems = () => {
    if (role === "delivery_staff") return deliveryStaffNav;
    if (role === "farm_worker") return farmWorkerNav;
    return deliveryStaffNav; // Default
  };

  const navItems = getNavItems();

  const handleNavClick = async () => {
    if (isNative) {
      await hapticSelection();
    }
  };

  const handleMenuItemClick = async (href: string) => {
    if (isNative) {
      await hapticSelection();
    }
    setOpen(false);
    navigate(href);
  };

  const handleLogout = async () => {
    if (isNative) {
      await hapticImpact("medium");
    }
    setOpen(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out successfully",
        description: "See you next time!",
      });
      navigate('/auth');
    }
  };

  const toggleTheme = async () => {
    if (isNative) {
      await hapticSelection();
    }
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t",
        "bg-background/95 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80",
        "md:hidden mobile-bottom-nav"
      )}>
        <div className="flex items-center justify-around py-1.5">
          {navItems.slice(0, 4).map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] transition-all rounded-xl touch-active",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground active:bg-muted/50"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110"
                )} />
                <span className="font-medium">{item.title}</span>
              </Link>
            );
          })}
          
          {/* More menu trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <button 
              onClick={() => {
                handleNavClick();
                setOpen(true);
              }}
              className="flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] text-muted-foreground rounded-xl touch-active active:bg-muted/50"
            >
              <Menu className="h-5 w-5" />
              <span className="font-medium">More</span>
            </button>

            <SheetContent 
              side="right" 
              hideCloseButton
              className="w-[85%] max-w-[320px] p-0 border-l border-border/50 bg-background"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <img 
                    src={awadhDairyLogo} 
                    alt="Awadh Dairy" 
                    className="h-10 w-10 object-contain"
                  />
                  <span className="text-lg font-semibold">Menu</span>
                </div>
                <SheetClose asChild>
                  <button className="p-2 -mr-2 rounded-full hover:bg-muted touch-active">
                    <X className="h-5 w-5" />
                  </button>
                </SheetClose>
              </div>
              
              <ScrollArea className="h-[calc(100vh-180px)]">
                <div className="px-4 py-3">
                  <AnimatePresence>
                    {visibleMenuItems.map((item, index) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <motion.button
                          key={item.href}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          onClick={() => handleMenuItemClick(item.href)}
                          className={cn(
                            "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl mb-1 transition-all touch-active",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "text-foreground hover:bg-muted active:bg-muted/80"
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="font-medium text-[15px]">{item.title}</span>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </ScrollArea>

              {/* Footer Section */}
              <div className="absolute bottom-0 left-0 right-0 border-t border-border/50 bg-background p-4 space-y-2">
                {/* Dark Mode Toggle */}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-border/80 transition-all touch-active hover:bg-muted active:bg-muted/80"
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                  <span className="font-medium text-[15px]">
                    {theme === "dark" ? "Light Mode" : "Dark Mode"}
                  </span>
                </button>

                {/* Settings */}
                {canAccessSettings && (
                  <button
                    onClick={() => handleMenuItemClick("/settings")}
                    className={cn(
                      "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all touch-active",
                      location.pathname === "/settings"
                        ? "bg-muted"
                        : "hover:bg-muted active:bg-muted/80"
                    )}
                  >
                    <Settings className="h-5 w-5" />
                    <span className="font-medium text-[15px]">Settings</span>
                  </button>
                )}

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all touch-active text-destructive hover:bg-destructive/10 active:bg-destructive/20"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium text-[15px]">Logout</span>
                </button>

                <Separator className="my-2" />

                {/* User Profile */}
                <div className="flex items-center gap-3 px-2 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <UserCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {userName || "User"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {role ? roleLabels[role] || role : "Loading..."}
                    </span>
                  </div>
                </div>

                {/* Safe area spacer */}
                <div className="h-[env(safe-area-inset-bottom)]" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Safe area spacer for iOS home indicator */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
