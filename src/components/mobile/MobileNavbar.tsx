import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import {
  LayoutDashboard,
  Truck,
  Users,
  Package,
  Menu,
  Beef,
  Droplets,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const deliveryStaffNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Deliveries", href: "/deliveries", icon: Truck },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Bottles", href: "/bottles", icon: Package },
];

const farmWorkerNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Cattle", href: "/cattle", icon: Beef },
  { title: "Production", href: "/production", icon: Droplets },
  { title: "Health", href: "/health", icon: Users },
];

export function MobileNavbar() {
  const location = useLocation();
  const { role } = useUserRole();
  const [open, setOpen] = useState(false);

  // Get nav items based on role
  const getNavItems = () => {
    if (role === "delivery_staff") return deliveryStaffNav;
    if (role === "farm_worker") return farmWorkerNav;
    return deliveryStaffNav; // Default
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 4).map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className="font-medium">{item.title}</span>
              </Link>
            );
          })}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-1 px-3 py-2 text-xs text-muted-foreground">
                <Menu className="h-5 w-5" />
                <span className="font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto">
              <SheetHeader>
                <SheetTitle>Quick Actions</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-4 py-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                      location.pathname === item.href
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Add padding to content to account for bottom nav */}
      <div className="pb-20 md:pb-0" />
    </>
  );
}
