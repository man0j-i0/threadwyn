import { ProductGridSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * Geometry matches the real page exactly, so the swap causes no layout shift.
 */
export default function MarketplaceLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-10 w-80 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[248px_1fr] lg:gap-10">
        <aside className="hidden space-y-4 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2.5 border-b border-line pb-4">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </aside>

        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-11 flex-1 rounded-full" />
            <Skeleton className="h-11 w-44 rounded-full" />
          </div>
          <div className="mt-6">
            <ProductGridSkeleton count={9} />
          </div>
        </div>
      </div>
    </div>
  );
}
