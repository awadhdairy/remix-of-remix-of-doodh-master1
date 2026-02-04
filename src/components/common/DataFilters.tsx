import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown, Calendar, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DateRange = "30" | "60" | "90" | "all";
export type SortOrder = "asc" | "desc";

export interface SortOption {
  value: string;
  label: string;
}

interface DataFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  sortBy?: string;
  sortOptions?: SortOption[];
  onSortChange?: (field: string) => void;
  sortOrder?: SortOrder;
  onSortOrderChange?: (order: SortOrder) => void;
  showWarningOnAll?: boolean;
  className?: string;
}

const dateRangeOptions: { value: DateRange; label: string; shortLabel: string }[] = [
  { value: "30", label: "Last 30 Days", shortLabel: "30d" },
  { value: "60", label: "Last 60 Days", shortLabel: "60d" },
  { value: "90", label: "Last 90 Days", shortLabel: "90d" },
  { value: "all", label: "All Time", shortLabel: "All" },
];

export function DataFilters({
  dateRange,
  onDateRangeChange,
  sortBy,
  sortOptions,
  onSortChange,
  sortOrder = "desc",
  onSortOrderChange,
  showWarningOnAll = true,
  className,
}: DataFiltersProps) {
  const showSorting = sortOptions && sortOptions.length > 0 && onSortChange;

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      {/* Date Range Buttons */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
        <div className="flex rounded-lg border bg-muted/50 p-1">
          {dateRangeOptions.map((option) => (
            <Button
              key={option.value}
              variant={dateRange === option.value ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-2 sm:px-3 text-xs sm:text-sm",
                dateRange === option.value && option.value === "all" && showWarningOnAll && "bg-warning text-warning-foreground hover:bg-warning/90"
              )}
              onClick={() => onDateRangeChange(option.value)}
            >
              <span className="sm:hidden">{option.shortLabel}</span>
              <span className="hidden sm:inline">{option.label}</span>
            </Button>
          ))}
        </div>
        {dateRange === "all" && showWarningOnAll && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3 w-3" />
            <span>May load slowly</span>
          </div>
        )}
      </div>

      {/* Sort Controls */}
      {showSorting && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Sort by:</span>
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="h-8 w-[140px] sm:w-[160px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onSortOrderChange && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
              title={sortOrder === "asc" ? "Ascending (oldest first)" : "Descending (newest first)"}
            >
              {sortOrder === "asc" ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to get date filter string for Supabase queries
export function getDateFilterValue(dateRange: DateRange): string | null {
  if (dateRange === "all") return null;
  const days = parseInt(dateRange);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}
