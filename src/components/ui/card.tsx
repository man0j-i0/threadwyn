import { cn } from "@/lib/utils";

/**
 * The double-bezel: an outer tray (canvas-veil + hairline) holding an inner
 * plate (surface + its own hairline + inset highlight), with concentric radii.
 * It reads as a machined object rather than a flat rectangle, and it gives
 * dense dashboards a physical hierarchy without resorting to heavy shadows.
 */
export function Bezel({
  className,
  innerClassName,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { innerClassName?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-[calc(var(--radius-xl)-7px)] border border-line bg-surface",
          "shadow-[var(--shadow-inset)]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Single-surface card for lighter contexts (list rows, compact tiles). */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-xs)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-4", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description ? <p className="text-[13px] leading-relaxed text-subtle">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

/** Section heading used across dashboards and marketing surfaces. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto")}>
        {eyebrow ? <p className="eyebrow text-accent">{eyebrow}</p> : null}
        <h2 className="font-display text-3xl leading-[1.08] font-medium text-balance text-ink sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="text-[15px] leading-relaxed text-pretty text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
