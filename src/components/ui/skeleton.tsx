import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton rounded-[var(--radius-sm)]", className)} {...props} />;
}

/**
 * Product-card skeleton. Its geometry matches the real card exactly so the
 * swap causes zero layout shift.
 */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-2">
      <Skeleton className="aspect-4/5 w-full rounded-[calc(var(--radius-lg)-6px)]" />
      <div className="space-y-2.5 px-2 pt-3.5 pb-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center justify-between pt-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-2/5" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="mt-4 h-8 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}
