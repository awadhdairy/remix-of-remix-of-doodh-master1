import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Package, Calendar, Receipt, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/customer/dashboard', label: 'Home', icon: Home },
  { path: '/customer/subscription', label: 'Subscription', icon: Package },
  { path: '/customer/deliveries', label: 'Deliveries', icon: Calendar },
  { path: '/customer/billing', label: 'Billing', icon: Receipt },
  { path: '/customer/profile', label: 'Profile', icon: User },
];

export function CustomerNavbar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
