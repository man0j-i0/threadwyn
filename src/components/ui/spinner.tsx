import { cn } from "@/lib/utils";

/**
 * A drawn thread rather than a generic ring — the stroke traces round like a
 * needle pulling yarn. Pure SVG + CSS, no layout-affecting properties.
 */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-grid place-items-center", className)}>
      <svg viewBox="0 0 24 24" fill="none" className="size-full animate-spin [animation-duration:0.9s]">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}
