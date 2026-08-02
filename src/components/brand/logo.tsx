import Link from "next/link";

import { cn } from "@/lib/utils";

/** The glyph: two warp threads crossed by a weft, enclosed. A woven "T". */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("shrink-0", className)}>
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="9.25" fill="var(--brand)" />
      <g stroke="var(--surface)" strokeWidth="1.9" strokeLinecap="round" strokeOpacity="0.35">
        <line x1="11" y1="8" x2="11" y2="24" />
        <line x1="21" y1="8" x2="21" y2="24" />
      </g>
      <g stroke="var(--surface)" strokeWidth="2.1" strokeLinecap="round">
        <line x1="8" y1="12.5" x2="24" y2="12.5" />
        <line x1="8" y1="19.5" x2="24" y2="19.5" />
      </g>
      <circle cx="16" cy="16" r="2.1" fill="var(--surface)" />
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  showWordmark = true,
  size = "md",
}: {
  href?: string;
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <Link
      href={href}
      aria-label="Threadwyn home"
      className={cn(
        "group inline-flex items-center gap-2.5 rounded-full transition-opacity hover:opacity-85",
        className,
      )}
    >
      <LogoGlyph className={size === "sm" ? "size-7" : "size-8"} />
      {showWordmark ? (
        <span
          className={cn(
            "font-display font-medium tracking-[-0.02em] text-ink",
            size === "sm" ? "text-[17px]" : "text-[19px]",
          )}
        >
          Threadwyn
        </span>
      ) : null}
    </Link>
  );
}
