import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Droplets, Stethoscope, Truck, DollarSign, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

interface QuickAction {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  roles: string[];
}

const quickActions: QuickAction[] = [
  { 
    label: "Add Production", 
    icon: Droplets, 
    href: "/production", 
    roles: ["super_admin", "manager", "farm_worker"] 
  },
  { 
    label: "Health Record", 
    icon: Stethoscope, 
    href: "/health", 
    roles: ["super_admin", "manager", "farm_worker", "vet_staff"] 
  },
  { 
    label: "New Delivery", 
    icon: Truck, 
    href: "/deliveries", 
    roles: ["super_admin", "manager", "delivery_staff"] 
  },
  { 
    label: "Record Payment", 
    icon: DollarSign, 
    href: "/billing", 
    roles: ["super_admin", "manager", "accountant"] 
  },
];

export function QuickActionFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { role } = useUserRole();

  const availableActions = quickActions.filter(
    action => role && action.roles.includes(role)
  );

  if (availableActions.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 md:hidden">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-transform",
              open && "rotate-45"
            )}
          >
            {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 mb-2">
          {availableActions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={() => {
                if (action.href) navigate(action.href);
                if (action.onClick) action.onClick();
                setOpen(false);
              }}
              className="py-3"
            >
              <action.icon className="h-4 w-4 mr-3" />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
