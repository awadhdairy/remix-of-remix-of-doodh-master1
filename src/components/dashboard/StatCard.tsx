import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "info";
  className?: string;
  delay?: number;
}

const variantStyles = {
  default: "bg-card border-border hover:border-primary/30",
  primary: "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40",
  success: "bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:border-success/40",
  warning: "bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20 hover:border-warning/40",
  info: "bg-gradient-to-br from-info/10 to-info/5 border-info/20 hover:border-info/40",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-colored",
  success: "bg-gradient-to-br from-success to-success/80 text-success-foreground shadow-md",
  warning: "bg-gradient-to-br from-warning to-warning/80 text-warning-foreground shadow-md",
  info: "bg-gradient-to-br from-info to-info/80 text-info-foreground shadow-md",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
  delay = 0,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-5 shadow-soft transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
        variantStyles[variant],
        "animate-slide-up",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Animated background decoration */}
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br from-primary/8 to-transparent opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110" />
      <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-gradient-to-br from-accent/10 to-transparent opacity-0 transition-all duration-500 group-hover:opacity-100" style={{ transitionDelay: '100ms' }} />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-foreground transition-transform duration-300 group-hover:scale-105 origin-left">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1.5 pt-1">
              <div className={cn(
                "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                trend.isPositive 
                  ? "bg-success/15 text-success" 
                  : "bg-destructive/15 text-destructive"
              )}>
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.isPositive ? "+" : ""}{trend.value}%
              </div>
              <span className="text-xs text-muted-foreground">vs last week</span>
            </div>
          )}
        </div>
        <div className={cn(
          "rounded-xl p-3 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
          iconStyles[variant]
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
