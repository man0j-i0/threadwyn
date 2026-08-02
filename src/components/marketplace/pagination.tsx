import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

/**
 * Real links, not buttons — so a page is bookmarkable, opens in a new tab, and
 * works before hydration.
 */
export function Pagination({
  page,
  pageCount,
  makeHref,
}: {
  page: number;
  pageCount: number;
  makeHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const pages = pageWindow(page, pageCount);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5">
      <PageLink href={makeHref(page - 1)} disabled={page <= 1} label="Previous page">
        <CaretLeft size={13} weight="bold" />
      </PageLink>

      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} aria-hidden className="px-1.5 text-[13px] text-subtle">
            …
          </span>
        ) : (
          <PageLink key={p} href={makeHref(p)} current={p === page} label={`Page ${p}`}>
            <span className="font-mono text-[12.5px] tnum">{p}</span>
          </PageLink>
        ),
      )}

      <PageLink href={makeHref(page + 1)} disabled={page >= pageCount} label="Next page">
        <CaretRight size={13} weight="bold" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  current,
  disabled,
  label,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const classes = cn(
    "grid size-10 place-items-center rounded-full border text-[13px]",
    "transition-[background-color,border-color,color] duration-200",
    current
      ? "border-brand bg-brand font-medium text-white dark:text-[#08110d]"
      : "border-line bg-surface text-muted hover:border-line-strong hover:bg-canvas-veil hover:text-ink",
  );

  if (disabled) {
    return (
      <span aria-disabled className={cn(classes, "pointer-events-none opacity-35")} aria-label={label}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      scroll
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={classes}
    >
      {children}
    </Link>
  );
}

function pageWindow(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);

  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);

  return out;
}
