import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";

import { getFacets, searchProducts } from "@/server/services/product-service";
import { parseSearchParams, filtersToParams, countActiveFilters, type RawSearchParams } from "@/lib/marketplace-params";
import { describeFilters, parseQuery } from "@/lib/ai/nl-filters";
import { serialize } from "@/lib/serialize";
import { formatNumber, pluralise } from "@/lib/utils";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { FilterPanel, ActiveFilters } from "@/components/marketplace/filter-panel";
import { MarketplaceToolbar } from "@/components/marketplace/marketplace-toolbar";
import { Pagination } from "@/components/marketplace/pagination";
import { AssistantDock } from "@/components/ai/assistant-dock";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Search 60 live fabrics from verified Indian mills. Filter on composition, weight, price, MOQ, lead time and certification.",
};

type PageProps = { searchParams: Promise<RawSearchParams> };

export default async function MarketplacePage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const askedIn = typeof raw.ask === "string" ? raw.ask : null;

  // `?ask=` is a plain-English request. It is parsed into ordinary filters
  // right here, on the server, and then flows through the exact same query as
  // a hand-clicked filter set — the assistant gets no private search path.
  const interpreted = askedIn ? parseQuery(askedIn) : null;
  const filters = interpreted ? { ...interpreted.filters, perPage: 24, page: 1 } : parseSearchParams(raw);

  const [result, facets] = await Promise.all([searchProducts(filters), getFacets()]);

  const products = serialize(result.items) as unknown as ProductCardData[];
  const chips = interpreted
    ? interpreted.applied.map((a) => ({ key: String(a.key), label: a.label, value: a.value }))
    : describeFilters(filters).map((a) => ({ key: String(a.key), label: a.label, value: a.value }));

  const activeCount = countActiveFilters(filters);

  function hrefForPage(page: number) {
    const params = filtersToParams({ ...filters, page });
    return `/marketplace${params.toString() ? `?${params.toString()}` : ""}`;
  }

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="mb-8">
          <p className="eyebrow text-accent">Marketplace</p>
          <h1 className="font-display mt-3 text-3xl leading-[1.1] font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            {filters.category?.length === 1
              ? facets.categories.find((c) => c.value === filters.category![0])?.label ?? "Fabrics"
              : "Every fabric on Threadwyn"}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            Swatches are rendered from each fabric&apos;s real weave, weight and dyed colourway — so what you
            see is what arrives on the roll.
          </p>
        </header>

        {askedIn ? (
          <div className="mb-7 rounded-[var(--radius-lg)] border border-brand-line bg-brand-soft/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-white">
                <Sparkle size={13} weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-relaxed text-ink">
                  Interpreted <span className="text-muted italic">“{askedIn}”</span> as{" "}
                  <strong className="font-medium">
                    {chips.length} {pluralise(chips.length, "filter")}
                  </strong>
                  . Remove any that aren&apos;t right — the results update immediately.
                </p>
                {chips.length ? <ActiveFilters chips={chips} className="mt-3" /> : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[248px_1fr] lg:gap-10">
          {/* Desktop filter rail. Sticky so it stays reachable in a long scroll. */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-ink">Refine</h2>
                {activeCount > 0 ? (
                  <span className="font-mono text-[10.5px] text-brand-ink tnum">{activeCount} active</span>
                ) : null}
              </div>
              <FilterPanel facets={facets} />
            </div>
          </aside>

          <div className="min-w-0">
            <MarketplaceToolbar total={result.total} activeCount={activeCount} facets={facets} />

            {!askedIn && chips.length > 0 ? <ActiveFilters chips={chips} className="mt-4" /> : null}

            <p className="mt-4 font-mono text-[12px] text-subtle tnum md:hidden">
              {formatNumber(result.total)} {pluralise(result.total, "fabric")}
            </p>

            <Suspense fallback={<ProductGridSkeleton />}>
              {products.length === 0 ? (
                <EmptyState
                  mood="search"
                  className="rounded-[var(--radius-xl)] border border-line bg-surface"
                  title="Nothing matches all of those constraints"
                  description={
                    activeCount > 0
                      ? "Every filter narrows the catalogue. Try lifting the price ceiling or the stock minimum first — those two rule out the most fabrics."
                      : "No fabric matched that search. Try a fibre, a weave, or describe what you're making."
                  }
                  action={
                    <ButtonLink href="/marketplace" variant="secondary">
                      Clear all filters
                    </ButtonLink>
                  }
                  secondaryAction={
                    <ButtonLink href="/marketplace?inStock=1" variant="ghost">
                      Show everything in stock
                    </ButtonLink>
                  }
                />
              ) : (
                <>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                    {products.map((p, i) => (
                      <ProductCard key={p.id} product={p} priority={i < 6} />
                    ))}
                  </div>

                  <div className="mt-12">
                    <Pagination page={result.page} pageCount={result.pageCount} makeHref={hrefForPage} />
                  </div>

                  <p className="mt-6 text-center font-mono text-[11.5px] text-subtle tnum">
                    Showing {(result.page - 1) * result.perPage + 1}–
                    {Math.min(result.page * result.perPage, result.total)} of {formatNumber(result.total)}
                    {result.ranked ? " · ranked by relevance" : ""}
                  </p>
                </>
              )}
            </Suspense>
          </div>
        </div>
      </div>

      <AssistantDock />
    </>
  );
}
