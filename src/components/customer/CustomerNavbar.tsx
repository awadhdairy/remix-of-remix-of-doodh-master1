import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Package, ShoppingBag, Calendar, Receipt, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCapacitor } from '@/hooks/useCapacitor';

const navItems = [
  { path: '/customer/dashboard', label: 'Home', icon: Home },
  { path: '/customer/subscription', label: 'Plan', icon: Package },
  { path: '/customer/products', label: 'Shop', icon: ShoppingBag },
  { path: '/customer/deliveries', label: 'Orders', icon: Calendar },
  { path: '/customer/billing', label: 'Bills', icon: Receipt },
  { path: '/customer/profile', label: 'Me', icon: User },
];

export function CustomerNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hapticSelection, isNative } = useCapacitor();

  const handleNavClick = async (path: string) => {
    if (isNative) {
      await hapticSelection();
    }
    navigate(path);
  };

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border",
      "supports-[backdrop-filter]:bg-background/80",
      "mobile-bottom-nav"
    )}>
      <div className="flex items-center justify-around py-1.5 px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl transition-all duration-200 min-w-[52px] touch-active",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground active:bg-muted/50"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe area spacer for iOS home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
