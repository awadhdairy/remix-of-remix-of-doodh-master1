import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  itemsPerPage?: number;
}

// Maximum rows to animate for performance
const MAX_ANIMATED_ROWS = 20;

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  onRowClick,
  emptyMessage = "No data found",
  className,
  itemsPerPage = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const isMobile = useIsMobile();

  // Memoize filtered data for performance
  const filteredData = useMemo(() => {
    if (!searchable || !search.trim()) return data;
    const searchLower = search.toLowerCase();
    return data.filter((item) =>
      Object.values(item).some(
        (value) =>
          value &&
          value.toString().toLowerCase().includes(searchLower)
      )
    );
  }, [data, search, searchable]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className={cn("space-y-4", className)}>
      {searchable && (
        <div className="relative max-w-sm animate-slide-up">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-11"
          />
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-soft overflow-hidden animate-fade-in" style={{ animationDelay: '100ms' }}>
        <div className={cn(isMobile && "overflow-x-auto -webkit-overflow-scrolling-touch")}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b-2">
              {columns.map((column) => (
                <TableHead key={column.key} className={cn("font-semibold", column.className)}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="stagger-animation">
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="relative h-10 w-10">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
                    </div>
                    <span className="text-muted-foreground font-medium">Loading data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                      <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <span className="text-muted-foreground font-medium">{emptyMessage}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => {
                // Only animate first N rows on desktop for performance
                const shouldAnimate = !isMobile && index < MAX_ANIMATED_ROWS;
                return (
                  <TableRow
                    key={item.id}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "group",
                      shouldAnimate && "animate-slide-up",
                      onRowClick && "cursor-pointer"
                    )}
                    style={shouldAnimate ? { animationDelay: `${index * 40}ms` } : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.key} className={cn("transition-colors", column.className)}>
                        {column.render
                          ? column.render(item)
                          : (item as Record<string, unknown>)[column.key]?.toString() || "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <p className="text-sm text-muted-foreground">
            {isMobile ? (
              <span>{(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}</span>
            ) : (
              <>
                Showing <span className="font-medium text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                <span className="font-medium text-foreground">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of{" "}
                <span className="font-medium text-foreground">{filteredData.length}</span> entries
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "ghost"}
                    size="sm"
                    className={cn("w-9 h-9 p-0", currentPage === pageNum && "shadow-sm")}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="gap-1"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
