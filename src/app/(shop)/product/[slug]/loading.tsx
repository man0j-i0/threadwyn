import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <Skeleton className="mb-7 h-3 w-64" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
        <div>
          <Skeleton className="aspect-square w-full rounded-[var(--radius-xl)] sm:aspect-4/3" />
          <Skeleton className="mt-4 h-20 w-full rounded-[var(--radius-md)]" />
        </div>

        <div className="space-y-5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9 w-40" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 bg-surface p-4">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="size-11 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-[var(--radius-sm)]" />
          <Skeleton className="h-13 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
