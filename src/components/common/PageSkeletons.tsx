import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { motion } from "framer-motion";

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3 },
};

export function StatsCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-4 w-28" />
      </CardContent>
    </Card>
  );
}

export function StatsCardsRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-5 flex-1" />
      ))}
    </div>
  );
}

export function DataTableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

export function AlertCardSkeleton() {
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-24" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TabsFilterSkeleton() {
  return (
    <div className="flex gap-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-md" />
      ))}
    </div>
  );
}

// Page-specific skeletons
export function CattlePageSkeleton() {
  return (
    <motion.div className="space-y-6" {...fadeIn}>
      <PageHeaderSkeleton />
      <StatsCardsRowSkeleton count={4} />
      <DataTableSkeleton rows={8} columns={8} />
    </motion.div>
  );
}

export function HealthPageSkeleton() {
  return (
    <motion.div className="space-y-6" {...fadeIn}>
      <PageHeaderSkeleton />
      <StatsCardsRowSkeleton count={4} />
      <AlertCardSkeleton />
      <TabsFilterSkeleton />
      <DataTableSkeleton rows={6} columns={7} />
    </motion.div>
  );
}

export function InventoryPageSkeleton() {
  return (
    <motion.div className="space-y-6" {...fadeIn}>
      <PageHeaderSkeleton />
      <StatsCardsRowSkeleton count={4} />
      <AlertCardSkeleton />
      <DataTableSkeleton rows={6} columns={6} />
    </motion.div>
  );
}

export function EquipmentPageSkeleton() {
  return (
    <motion.div className="space-y-6" {...fadeIn}>
      <PageHeaderSkeleton />
      <StatsCardsRowSkeleton count={4} />
      <div className="flex items-center justify-between">
        <TabsFilterSkeleton />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <DataTableSkeleton rows={6} columns={7} />
    </motion.div>
  );
}
