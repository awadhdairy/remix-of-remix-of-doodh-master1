import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { useCapacitor } from "@/hooks/useCapacitor";
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
  Calendar,
  Settings,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  { title: "Health", href: "/health", icon: Stethoscope },
];

const allQuickActions: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Cattle", href: "/cattle", icon: Beef },
  { title: "Production", href: "/production", icon: Droplets },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Deliveries", href: "/deliveries", icon: Truck },
  { title: "Billing", href: "/billing", icon: Receipt },
  { title: "Health", href: "/health", icon: Stethoscope },
  { title: "Bottles", href: "/bottles", icon: Package },
  { title: "Breeding", href: "/breeding", icon: Calendar },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function MobileNavbar() {
  const location = useLocation();
  const { role } = useUserRole();
  const [open, setOpen] = useState(false);
  const { hapticSelection, isNative } = useCapacitor();

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
            <SheetTrigger asChild>
              <button 
                onClick={handleNavClick}
                className="flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] text-muted-foreground rounded-xl touch-active active:bg-muted/50"
              >
                <Menu className="h-5 w-5" />
                <span className="font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
              {/* Swipe indicator */}
              <div className="swipe-indicator mb-2" />
              
              <SheetHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-lg">Quick Actions</SheetTitle>
                  <SheetClose asChild>
                    <button className="p-2 rounded-full hover:bg-muted touch-active">
                      <X className="h-5 w-5" />
                    </button>
                  </SheetClose>
                </div>
              </SheetHeader>
              
              <ScrollArea className="max-h-[60vh]">
                <div className="grid grid-cols-4 gap-3 py-4 px-1">
                  {allQuickActions.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => {
                        handleNavClick();
                        setOpen(false);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-3 transition-all touch-active",
                        location.pathname === item.href
                          ? "border-primary bg-primary/5 text-primary"
                          : "hover:bg-muted active:bg-muted/80"
                      )}
                    >
                      <item.icon className="h-6 w-6" />
                      <span className="text-xs font-medium text-center leading-tight">{item.title}</span>
                    </Link>
                  ))}
                </div>
              </ScrollArea>
              
              {/* Safe area spacer */}
              <div className="h-[env(safe-area-inset-bottom)]" />
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Safe area spacer for iOS home indicator */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
