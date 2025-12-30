import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "error" | "info" | "default" | "primary";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-success/10 text-success border-success/20 hover:bg-success/20",
  warning: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
  error: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
  info: "bg-info/10 text-info border-info/20 hover:bg-info/20",
  primary: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20",
  default: "bg-muted text-muted-foreground border-border hover:bg-muted/80",
};

const statusToVariant: Record<string, StatusVariant> = {
  active: "success",
  lactating: "success",
  delivered: "success",
  paid: "success",
  present: "success",
  dry: "warning",
  pending: "warning",
  partial: "warning",
  half_day: "warning",
  pregnant: "info",
  calving: "info",
  sold: "default",
  deceased: "error",
  missed: "error",
  overdue: "error",
  absent: "error",
  leave: "info",
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const resolvedVariant = variant || statusToVariant[status.toLowerCase()] || "default";
  
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize font-medium",
        variantStyles[resolvedVariant],
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
