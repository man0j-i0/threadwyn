import { cn } from "@/lib/utils";

/**
 * Stock state carries a word as well as a colour, so it survives greyscale and
 * colour-blindness. "Low stock" is the one a buyer must not miss.
 */
export function StockPill({
  stock,
  status,
  className,
}: {
  stock: number;
  status: string;
  className?: string;
}) {
  const state =
    status === "DRAFT"
      ? { label: "Draft", tone: "bg-sunken text-muted" }
      : status === "ARCHIVED"
        ? { label: "Archived", tone: "bg-sunken text-subtle" }
        : status === "OUT_OF_STOCK" || stock <= 0
          ? { label: "Out of stock", tone: "bg-danger-soft text-danger" }
          : stock < 400
            ? { label: `Low · ${stock}m`, tone: "bg-warn-soft text-warn" }
            : null;

  if (!state) return null;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 font-mono text-[10px] font-medium shadow-[var(--shadow-xs)]",
        "ring-1 ring-black/5 backdrop-blur-sm",
        state.tone,
        className,
      )}
    >
      {state.label}
    </span>
  );
}
