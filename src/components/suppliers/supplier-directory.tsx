"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Certificate, MagnifyingGlass, MapPin, Star, X } from "@phosphor-icons/react";

import { formatMetres, formatMoney, pluralise, titleCase } from "@/lib/utils";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { Badge } from "@/components/ui/badge";
import type { WeaveKey } from "@/lib/weave";

export type DirectoryProduct = {
  id: string;
  slug: string;
  name: string;
  weave: string;
  gsm: number;
  pricePerMetre: number;
  stockMetres: number;
  colorways: { hex: string }[];
};

export type DirectorySupplier = {
  id: string;
  slug: string;
  businessName: string;
  businessType: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  rating: number;
  ratingCount: number;
  yearEstablished: number | null;
  moqMetres: number;
  leadTimeDays: number;
  verified: boolean;
  certifications: string[];
  fabricTypes: string[];
  categories: string[];
  _count: { products: number };
  products: DirectoryProduct[];
};

/**
 * The supplier directory, with a search that actually searches.
 *
 * The header used to carry a control labelled "Search fabrics" that was a link
 * to the marketplace, which on this page meant the only search-shaped thing
 * available took you somewhere else entirely. This replaces it with a real one.
 *
 * Filtering is client-side and deliberately so: the page already loads every
 * supplier in one query, and there are tens of them rather than thousands. A
 * round trip per keystroke would be slower and would need a debounce, a
 * pending state and a race guard to behave as well as an array filter does for
 * free. If the directory ever outgrows a single query this should move to the
 * server, and the query is the thing that would tell you.
 *
 * It matches on more than the name, because someone looking for a mill rarely
 * knows what it is called: city, state, business type, fabric types,
 * categories and certifications are all searchable. Typing "GOTS", "Surat" or
 * "handloom" all find something.
 */
export function SupplierDirectory({ suppliers }: { suppliers: DirectorySupplier[] }) {
  const [query, setQuery] = useState("");
  const reduced = useReducedMotion();

  // Built once per supplier rather than per keystroke.
  const haystacks = useMemo(
    () =>
      suppliers.map((s) =>
        [
          s.businessName,
          s.tagline ?? "",
          s.city ?? "",
          s.state ?? "",
          titleCase(s.businessType),
          ...s.certifications,
          ...s.fabricTypes,
          ...s.categories,
        ]
          .join(" ")
          .toLowerCase(),
      ),
    [suppliers],
  );

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return suppliers;
    // Every word has to match somewhere, so "surat silk" narrows rather than
    // widening the way a plain substring test would.
    const terms = q.split(/\s+/);
    return suppliers.filter((_, i) => terms.every((t) => haystacks[i]!.includes(t)));
  }, [q, suppliers, haystacks]);

  return (
    <>
      <div className="mt-10 flex items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--brand-soft)]">
        <MagnifyingGlass size={16} weight="light" className="shrink-0 text-subtle" />
        <label htmlFor="supplier-search" className="sr-only">
          Search mills by name, city, fabric or certification
        </label>
        <input
          id="supplier-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search mills by name, city, fabric or certification…"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-subtle/80 focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={13} weight="bold" />
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="mt-3 font-mono text-[11.5px] text-subtle tnum">
        {q
          ? `${visible.length} of ${suppliers.length} ${pluralise(suppliers.length, "mill")}`
          : `${suppliers.length} ${pluralise(suppliers.length, "mill")}`}
      </p>

      {visible.length === 0 ? (
        <div className="mt-12 rounded-[var(--radius-xl)] border border-line bg-surface px-6 py-16 text-center">
          <p className="text-[15px] font-medium text-ink">No mills match “{query}”.</p>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-subtle">
            Try a city, a fibre, or a certification. Every mill is searchable by name, location,
            what it weaves and what it is certified for.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-6 cursor-pointer text-[13px] font-medium text-brand-ink underline underline-offset-4 transition-colors hover:text-brand-hover"
          >
            Clear the search
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {visible.map((s, i) => (
            <motion.div
              key={s.id}
              /* Self-contained, not parent-driven.
                 These used to be `StaggerItem`s inside a `Stagger`, which runs
                 one `whileInView` on the parent with `once: true`. That
                 observer fires a single time and then stops, so a card that
                 unmounted while filtering and remounted when the query was
                 cleared arrived at the parent's `hidden` variant with nothing
                 left to move it to `show`: the list stayed looking filtered
                 after the text was deleted. Animating each card from its own
                 mount cannot get stuck, because every mount carries its own
                 transition. */
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0.2 : 0.45,
                // Capped, so filtering down to the last of thirty mills does
                // not wait a second and a half before showing it.
                delay: reduced ? 0 : Math.min(i, 6) * 0.045,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <article className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface transition-[border-color,box-shadow] duration-400 ease-[var(--ease-out-expo)] hover:border-line-strong hover:shadow-[var(--shadow-md)]">
                <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-display text-xl leading-snug font-medium text-ink sm:text-2xl">
                        <Link
                          href={`/marketplace?supplier=${s.slug}`}
                          className="transition-colors hover:text-brand-ink"
                        >
                          {s.businessName}
                        </Link>
                      </h2>
                      {s.verified ? <Badge tone="brass">Verified</Badge> : null}
                      <Badge tone="neutral">{titleCase(s.businessType)}</Badge>
                    </div>

                    {s.tagline ? (
                      <p className="mt-2 text-[14px] text-muted italic">{s.tagline}</p>
                    ) : null}

                    <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={12} weight="light" />
                        {s.city}, {s.state}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono tnum">
                        <Star size={11} weight="fill" className="text-brass" />
                        {s.rating.toFixed(1)} ({s.ratingCount})
                      </span>
                      {s.yearEstablished ? (
                        <span className="font-mono tnum">est. {s.yearEstablished}</span>
                      ) : null}
                      <span className="font-mono tnum">
                        MOQ {s.moqMetres}m · {s.leadTimeDays}d lead
                      </span>
                    </div>

                    {s.description ? (
                      <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted">
                        {s.description}
                      </p>
                    ) : null}

                    {s.certifications.length ? (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {s.certifications.map((c) => (
                          <Badge key={c} tone="neutral" icon={<Certificate size={10} weight="light" />}>
                            {c}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <Link
                      href={`/marketplace?supplier=${s.slug}`}
                      className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink underline underline-offset-4 transition-colors hover:text-brand-hover"
                    >
                      {s._count.products} {pluralise(s._count.products, "fabric")} from this mill
                      <ArrowRight size={11} weight="bold" />
                    </Link>
                  </div>

                  {/* A strip of what they actually make — more useful than a logo. */}
                  {s.products.length ? (
                    <div className="grid grid-cols-4 gap-2 lg:grid-cols-2 xl:grid-cols-4">
                      {s.products.map((p) => (
                        <Link
                          key={p.id}
                          href={`/product/${p.slug}`}
                          title={`${p.name} — ${formatMoney(p.pricePerMetre)}/m, ${formatMetres(p.stockMetres)}`}
                          className="group/sw block overflow-hidden rounded-[var(--radius-sm)] border border-line"
                        >
                          <span className="block aspect-square overflow-hidden">
                            <span className="block size-full transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/sw:scale-105">
                              <FabricSwatch
                                weave={p.weave as WeaveKey}
                                hex={p.colorways[0]?.hex ?? "#C9C2B4"}
                                gsm={p.gsm}
                                seed={p.id}
                                alt={`${p.name} swatch`}
                              />
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="self-center text-[13px] text-subtle">
                      No live listings from this mill right now.
                    </p>
                  )}
                </div>
              </article>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}
