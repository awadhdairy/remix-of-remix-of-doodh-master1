import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";

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
  index?: number;
  delay?: number; // For backwards compatibility
}

const variantStyles = {
  default: "bg-card border-border hover:border-primary/30",
  primary: "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 hover:border-primary/40",
  success: "bg-gradient-to-br from-success/10 via-success/5 to-transparent border-success/20 hover:border-success/40",
  warning: "bg-gradient-to-br from-warning/10 via-warning/5 to-transparent border-warning/20 hover:border-warning/40",
  info: "bg-gradient-to-br from-info/10 via-info/5 to-transparent border-info/20 hover:border-info/40",
};

const iconStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25",
  success: "bg-gradient-to-br from-success to-success/80 text-success-foreground shadow-lg shadow-success/25",
  warning: "bg-gradient-to-br from-warning to-warning/80 text-warning-foreground shadow-lg shadow-warning/25",
  info: "bg-gradient-to-br from-info to-info/80 text-info-foreground shadow-lg shadow-info/25",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
  index = 0,
  delay = 0,
}: StatCardProps) {
  // Use delay if provided, otherwise calculate from index
  const animationDelay = delay > 0 ? delay / 1000 : index * 0.1;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay: animationDelay,
        ease: "easeOut"
      }}
      whileHover={{ 
        y: -4,
        transition: { duration: 0.2 }
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-5 shadow-soft transition-shadow duration-300 hover:shadow-xl",
        variantStyles[variant],
        className
      )}
    >
      {/* Animated background decoration */}
      <motion.div 
        className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br from-primary/8 to-transparent"
        initial={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.2, opacity: 1 }}
        transition={{ duration: 0.4 }}
      />
      <motion.div 
        className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-gradient-to-br from-accent/10 to-transparent"
        initial={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <motion.p 
            className="text-3xl font-bold tracking-tight text-foreground"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: animationDelay + 0.2 }}
          >
            {value}
          </motion.p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <motion.div 
              className="flex items-center gap-1.5 pt-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: animationDelay + 0.3 }}
            >
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
            </motion.div>
          )}
        </div>
        <motion.div 
          className={cn(
            "rounded-xl p-3 transition-all duration-300",
            iconStyles[variant]
          )}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ duration: 0.2 }}
        >
          <Icon className="h-5 w-5" />
        </motion.div>
      </div>
    </motion.div>
  );
}
