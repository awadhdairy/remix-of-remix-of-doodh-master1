import { Button } from "@/components/ui/button";
import { Plus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  action,
  className,
  children,
}: PageHeaderProps) {
  const ActionIcon = action?.icon || Plus;

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-4 animate-slide-up">
        {Icon && (
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-colored transition-transform duration-300 hover:scale-105">
            <Icon className="h-6 w-6 text-primary-foreground" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent to-white/20" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '100ms' }}>
        {children}
        {action && (
          <Button onClick={action.onClick} className="gap-2 shadow-colored">
            <ActionIcon className="h-4 w-4" />
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
