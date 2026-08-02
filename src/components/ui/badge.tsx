import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "accent" | "positive" | "warn" | "danger" | "info" | "brass";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-muted border-line",
  brand: "bg-brand-soft text-brand-ink border-brand-line",
  accent: "bg-accent-soft text-accent border-accent-line",
  positive: "bg-positive-soft text-positive border-positive-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  danger: "bg-danger-soft text-danger border-danger-line",
  info: "bg-info-soft text-info border-info-line",
  brass: "bg-brass-soft text-brass border-brass/25",
};

export function Badge({
  tone = "neutral",
  className,
  icon,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; icon?: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "text-[11px] font-medium leading-none tracking-wide whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * Status pills carry a shape cue as well as a colour cue, so meaning survives
 * for colour-blind users and greyscale printing.
 */
export function StatusDot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  const fill: Record<Tone, string> = {
    neutral: "bg-subtle",
    brand: "bg-brand",
    accent: "bg-accent",
    positive: "bg-positive",
    warn: "bg-warn",
    danger: "bg-danger",
    info: "bg-info",
    brass: "bg-brass",
  };
  return <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", fill[tone], className)} />;
}

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("eyebrow text-subtle", className)}>{children}</p>;
}
