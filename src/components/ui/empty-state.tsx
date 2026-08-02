import { cn } from "@/lib/utils";
import { WeaverMark } from "@/components/brand/weaver-mark";

/**
 * Empty states teach. Each one states what is missing, why, and gives exactly
 * one obvious way forward — never a bare "No results".
 */
export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  mood = "empty",
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  mood?: "empty" | "search" | "error" | "done";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20",
        className,
      )}
    >
      <WeaverMark mood={mood} className="mb-6 size-24 sm:size-28" />
      <h3 className="font-display text-xl font-medium text-balance text-ink sm:text-2xl">{title}</h3>
      <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-pretty text-muted">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
