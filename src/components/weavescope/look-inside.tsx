"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The entry point into WeaveScope.
 *
 * It stays out of the way until you hover the card, then resolves as a small
 * reticle — the mark on a loupe, not a generic "info" glyph. On touch, where
 * there is no hover, it is permanently visible at lower opacity: a control that
 * only exists on hover is a control half the users never find.
 *
 * Sits above the card's stretched link and stops propagation, so it navigates
 * to WeaveScope rather than the product page underneath.
 */
export function LookInside({
  slug,
  productName,
  className,
  variant = "overlay",
}: {
  slug: string;
  productName: string;
  className?: string;
  variant?: "overlay" | "inline";
}) {
  if (variant === "inline") {
    return (
      <Link
        href={`/weavescope/${slug}`}
        className={cn(
          "group/li inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full",
          "border border-brand-line bg-brand-soft px-4 text-[13px] font-medium text-brand-ink",
          "transition-[background-color,border-color,transform] duration-300 ease-[var(--ease-spring)]",
          "hover:bg-brand-soft-hover active:scale-[0.98]",
          className,
        )}
      >
        <Reticle className="size-4" />
        Look inside
      </Link>
    );
  }

  return (
    <Link
      href={`/weavescope/${slug}`}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Look inside ${productName} — magnify the weave and fibre`}
      className={cn(
        "group/li absolute top-2 left-2 z-20 flex cursor-pointer items-center gap-0 overflow-hidden",
        "rounded-full border border-white/25 bg-[#14120f]/55 text-white backdrop-blur-md",
        "transition-[gap,padding,background-color,opacity] duration-400 ease-[var(--ease-spring)]",
        // Visible by default where there is no hover; hover-revealed where there is.
        "opacity-80 md:opacity-0 md:group-hover:opacity-100",
        "focus-visible:opacity-100",
        "p-1.5 hover:bg-[#14120f]/80 hover:gap-1.5 hover:pr-3",
        className,
      )}
    >
      <Reticle className="size-4 shrink-0" />
      <span className="max-w-0 overflow-hidden text-[11.5px] font-medium whitespace-nowrap transition-[max-width] duration-400 ease-[var(--ease-spring)] group-hover/li:max-w-32">
        Look inside
      </span>
    </Link>
  );
}

/** A loupe reticle: concentric rings with crosshair ticks, quietly pulsing. */
function Reticle({ className }: { className?: string }) {
  return (
    <span className={cn("relative grid place-items-center", className)}>
      <span className="absolute inset-0 rounded-full border border-current opacity-40 motion-safe:animate-ping motion-safe:[animation-duration:2.4s]" />
      <svg viewBox="0 0 16 16" fill="none" className="relative size-full">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.7" />
        <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
          <line x1="8" y1="0.75" x2="8" y2="2.6" />
          <line x1="8" y1="13.4" x2="8" y2="15.25" />
          <line x1="0.75" y1="8" x2="2.6" y2="8" />
          <line x1="13.4" y1="8" x2="15.25" y2="8" />
        </g>
      </svg>
    </span>
  );
}
