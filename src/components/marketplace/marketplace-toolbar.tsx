"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FunnelSimple, MagnifyingGlass, X } from "@phosphor-icons/react";

import { cn, formatNumber, pluralise } from "@/lib/utils";
import { SORT_OPTIONS } from "@/lib/marketplace-params";
import { Drawer } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FilterPanel, type Facets } from "./filter-panel";

export function MarketplaceToolbar({
  total,
  activeCount,
  facets,
}: {
  total: number;
  activeCount: number;
  facets: Facets;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(currentQuery);

  useEffect(() => setQuery(currentQuery), [currentQuery]);

  // "/" focuses search from anywhere on the page, the way every catalogue
  // power-user already expects.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function push(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            push((p) => {
              if (query.trim()) p.set("q", query.trim());
              else p.delete("q");
              p.delete("ask");
            });
          }}
          className="relative flex-1"
        >
          <MagnifyingGlass
            size={16}
            weight="light"
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-subtle"
          />
          <label htmlFor="marketplace-search" className="sr-only">
            Search fabrics
          </label>
          <input
            id="marketplace-search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
            placeholder="Search by name, fibre, weave or use…"
            className={cn(
              "min-h-11 w-full rounded-full border border-line bg-surface pr-10 pl-10 text-[14px] text-ink",
              "placeholder:text-subtle/75",
              "transition-[border-color,box-shadow] duration-200",
              "focus:border-brand focus:shadow-[0_0_0_3px_var(--brand-soft)] focus:outline-none",
            )}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                push((p) => {
                  p.delete("q");
                  p.delete("ask");
                });
              }}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
            >
              <X size={12} weight="bold" />
            </button>
          ) : null}
        </form>

        <div className="flex items-center gap-2.5">
          <p aria-live="polite" className="hidden shrink-0 font-mono text-[12px] text-subtle tnum md:block">
            {formatNumber(total)} {pluralise(total, "fabric")}
          </p>

          <div className="relative">
            <label htmlFor="marketplace-sort" className="sr-only">
              Sort results
            </label>
            <select
              id="marketplace-sort"
              value={searchParams.get("sort") ?? "relevance"}
              onChange={(e) =>
                push((p) => {
                  if (e.target.value === "relevance") p.delete("sort");
                  else p.set("sort", e.target.value);
                })
              }
              className="min-h-11 cursor-pointer appearance-none rounded-full border border-line bg-surface py-2 pr-9 pl-4 text-[13px] text-muted transition-colors hover:border-line-strong focus:border-brand focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-subtle"
            >
              ▾
            </span>
          </div>

          <Button
            variant="secondary"
            onClick={() => setDrawerOpen(true)}
            icon={<FunnelSimple size={15} weight="light" />}
            className="lg:hidden"
          >
            Filters
            {activeCount > 0 ? (
              <span className="ml-0.5 grid size-5 place-items-center rounded-full bg-brand font-mono text-[10px] text-white">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
        side="left"
        footer={
          <Button fullWidth onClick={() => setDrawerOpen(false)}>
            Show {formatNumber(total)} {pluralise(total, "result")}
          </Button>
        }
      >
        <div className="px-5 py-3">
          <FilterPanel facets={facets} />
        </div>
      </Drawer>
    </>
  );
}
