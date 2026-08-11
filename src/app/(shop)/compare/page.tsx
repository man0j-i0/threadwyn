import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Certificate, Check, Minus } from "@phosphor-icons/react/dist/ssr";

import { getProductsForCompare } from "@/server/services/product-service";
import { serialize } from "@/lib/serialize";
import { WEAVE_LABELS, type WeaveKey } from "@/lib/weave";
import { deriveConstruction, primaryFibre } from "@/lib/weavescope";
import { cn, formatMetres, formatMoney, formatNumber } from "@/lib/utils";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { AssistantDock } from "@/components/ai/assistant-dock";
import { CompareActions } from "@/components/product/compare-actions";

export const metadata: Metadata = {
  title: "Compare fabrics",
  description: "Put two to four fabrics side by side on the specs a sourcing decision actually turns on.",
};

type PageProps = { searchParams: Promise<{ slugs?: string }> };

/** Which direction is "better" for a row, where that is even meaningful. */
type Better = "high" | "low" | null;

export default async function ComparePage({ searchParams }: PageProps) {
  const { slugs: raw } = await searchParams;
  const slugs = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);

  const products = slugs.length ? serialize(await getProductsForCompare(slugs)) : [];

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-20">
        <EmptyState
          mood="search"
          className="rounded-[var(--radius-xl)] border border-line bg-surface"
          title="Nothing to compare yet"
          description="Pick two to four fabrics from the marketplace and they'll line up here on weight, width, composition, MOQ, lead time and price — the figures a sourcing decision actually turns on."
          action={
            <ButtonLink href="/marketplace" trailingIcon={<ArrowRight size={13} weight="bold" />}>
              Browse fabrics
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const enriched = products.map((p) => {
    const fibre = primaryFibre(p.fibres);
    return { p, fibre, construction: deriveConstruction({ weave: p.weave as WeaveKey, gsm: p.gsm, fibre }) };
  });

  const rows: {
    label: string;
    better: Better;
    values: (string | number)[];
    numeric?: number[];
    mono?: boolean;
    note?: string;
  }[] = [
    {
      label: "Price per metre",
      better: "low",
      values: enriched.map((e) => formatMoney(e.p.pricePerMetre)),
      numeric: enriched.map((e) => e.p.pricePerMetre),
      mono: true,
    },
    {
      label: "Composition",
      better: null,
      values: enriched.map((e) => e.p.composition),
    },
    {
      label: "Weave",
      better: null,
      values: enriched.map((e) => WEAVE_LABELS[e.p.weave as WeaveKey]),
    },
    {
      label: "Weight",
      better: null,
      values: enriched.map((e) => `${e.p.gsm} gsm`),
      numeric: enriched.map((e) => e.p.gsm),
      mono: true,
      note: "Neither direction is better — it depends what you're making.",
    },
    {
      label: "Width",
      better: "high",
      values: enriched.map((e) => `${e.p.widthCm} cm`),
      numeric: enriched.map((e) => e.p.widthCm),
      mono: true,
      note: "Wider cloth usually means better cutting yield.",
    },
    {
      label: "Minimum order",
      better: "low",
      values: enriched.map((e) => `${formatNumber(e.p.moqMetres)} m`),
      numeric: enriched.map((e) => e.p.moqMetres),
      mono: true,
    },
    {
      label: "Smallest possible order",
      better: "low",
      values: enriched.map((e) => formatMoney(e.p.pricePerMetre * e.p.moqMetres, { compact: true })),
      numeric: enriched.map((e) => e.p.pricePerMetre * e.p.moqMetres),
      mono: true,
      note: "Price × MOQ — the real cheque you write to try this cloth.",
    },
    {
      label: "Lead time",
      better: "low",
      values: enriched.map((e) => `${e.p.leadTimeDays} days`),
      numeric: enriched.map((e) => e.p.leadTimeDays),
      mono: true,
    },
    {
      label: "Stock on hand",
      better: "high",
      values: enriched.map((e) => formatMetres(e.p.stockMetres)),
      numeric: enriched.map((e) => e.p.stockMetres),
      mono: true,
    },
    {
      label: "Thread count",
      better: null,
      values: enriched.map((e) => `${e.construction.threadsPerInch} TPI`),
      numeric: enriched.map((e) => e.construction.threadsPerInch),
      mono: true,
      note: "Estimated from weight and weave — see WeaveScope for the derivation.",
    },
    {
      label: "Colourways",
      better: "high",
      values: enriched.map((e) => String(e.p.colorways.length)),
      numeric: enriched.map((e) => e.p.colorways.length),
      mono: true,
    },
    {
      label: "Finish",
      better: null,
      values: enriched.map((e) => e.p.finish),
    },
    {
      label: "Hand-feel",
      better: null,
      values: enriched.map((e) => e.p.handFeel),
    },
    {
      label: "Mill",
      better: null,
      values: enriched.map((e) => `${e.p.supplier.businessName}, ${e.p.supplier.city}`),
    },
  ];

  /** Index of the best cell in a row, or -1 where "best" is meaningless. */
  function bestIndex(numeric: number[] | undefined, better: Better) {
    if (!numeric || !better || numeric.length < 2) return -1;
    const target = better === "low" ? Math.min(...numeric) : Math.max(...numeric);
    // A tie means nothing is highlighted — flagging all of them says nothing.
    if (numeric.filter((n) => n === target).length > 1) return -1;
    return numeric.indexOf(target);
  }

  const cheapest = enriched.reduce((a, b) => (b.p.pricePerMetre < a.p.pricePerMetre ? b : a));
  const fastest = enriched.reduce((a, b) => (b.p.leadTimeDays < a.p.leadTimeDays ? b : a));
  const deepest = enriched.reduce((a, b) => (b.p.stockMetres > a.p.stockMetres ? b : a));
  const lowestCommit = enriched.reduce((a, b) =>
    b.p.pricePerMetre * b.p.moqMetres < a.p.pricePerMetre * a.p.moqMetres ? b : a,
  );

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="mb-8">
          <p className="eyebrow text-accent">Side by side</p>
          <h1 className="font-display mt-3 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            {products.length === 1
              ? products[0]!.name
              : `Compare ${products.length} fabrics`}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
            {products.length === 1 ? (
              <>
                Only one fabric is shortlisted, so there is nothing to weigh it against yet. Add a second
                from the marketplace and every row below becomes a comparison.
              </>
            ) : (
              <>
                Highlighted cells are the strongest in that row. Weight and composition have no
                &ldquo;better&rdquo;, so nothing is marked; they depend on what you&apos;re making.
              </>
            )}
          </p>
        </header>

        {/* -------------------------------------------------------- verdict */}
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Verdict label="Lowest price/m" name={cheapest.p.name} detail={formatMoney(cheapest.p.pricePerMetre)} />
          <Verdict
            label="Smallest commitment"
            name={lowestCommit.p.name}
            detail={formatMoney(lowestCommit.p.pricePerMetre * lowestCommit.p.moqMetres, { compact: true })}
          />
          <Verdict label="Fastest" name={fastest.p.name} detail={`${fastest.p.leadTimeDays} days`} />
          <Verdict label="Deepest stock" name={deepest.p.name} detail={formatMetres(deepest.p.stockMetres)} />
        </div>

        {/* ---------------------------------------------------------- table */}
        <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-line bg-surface">
          <table className="w-full min-w-3xl border-collapse">
            <caption className="sr-only">Specification comparison</caption>

            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-44 bg-surface p-4 text-left align-bottom">
                  <span className="eyebrow text-subtle">Specification</span>
                </th>
                {enriched.map(({ p }) => (
                  <th key={p.id} scope="col" className="min-w-56 border-l border-line p-4 text-left align-bottom">
                    <Link href={`/product/${p.slug}`} className="group block">
                      <span className="block aspect-4/3 overflow-hidden rounded-[var(--radius-sm)] border border-line">
                        <FabricSwatch
                          weave={p.weave as WeaveKey}
                          hex={p.colorways[0]?.hex ?? "#C9C2B4"}
                          gsm={p.gsm}
                          seed={p.id}
                          alt={`${p.name} swatch`}
                        />
                      </span>
                      <span className="mt-3 flex items-center gap-1.5">
                        <span className="eyebrow truncate text-subtle">{p.category.name}</span>
                        {p.supplier.verified ? (
                          <Certificate size={10} weight="fill" className="shrink-0 text-brass" />
                        ) : null}
                      </span>
                      <span className="mt-1.5 block text-[14px] leading-snug font-medium text-ink transition-colors group-hover:text-brand-ink">
                        {p.name}
                      </span>
                    </Link>
                    <div className="mt-3">
                      <CompareActions slug={p.slug} slugs={slugs} name={p.name} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const best = bestIndex(row.numeric, row.better);
                return (
                  <tr key={row.label} className="border-t border-line">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface p-4 text-left align-top text-[12.5px] font-medium text-muted"
                    >
                      {row.label}
                      {row.note ? (
                        <span className="mt-1 block text-[10.5px] leading-relaxed font-normal text-subtle">
                          {row.note}
                        </span>
                      ) : null}
                    </th>
                    {row.values.map((value, i) => (
                      <td
                        key={i}
                        className={cn(
                          "border-l border-line p-4 align-top text-[13px] text-ink",
                          row.mono && "font-mono tnum",
                          best === i && "bg-brand-soft/60",
                        )}
                      >
                        <span className="flex items-start gap-1.5">
                          {best === i ? (
                            <Check size={12} weight="bold" aria-label="Best in this row" className="mt-1 shrink-0 text-brand" />
                          ) : null}
                          <span>{value}</span>
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}

              {/* Certifications get their own presence/absence grid. */}
              <tr className="border-t border-line">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface p-4 text-left align-top text-[12.5px] font-medium text-muted"
                >
                  Certifications
                </th>
                {enriched.map(({ p }) => (
                  <td key={p.id} className="border-l border-line p-4 align-top">
                    {p.sustainability.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {p.sustainability.map((s) => (
                          <Badge key={s} tone="brass">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-[12.5px] text-subtle">
                        <Minus size={11} weight="bold" />
                        None on file
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-[12.5px] leading-relaxed text-subtle">
          Thread count is estimated from weight and weave structure — open{" "}
          <Link href={`/weavescope/${enriched[0]!.p.slug}`} className="text-brand-ink underline underline-offset-4">
            WeaveScope
          </Link>{" "}
          on any of these to see the derivation. Everything else is as entered by the mill.
        </p>
      </div>

      <AssistantDock />
    </>
  );
}

function Verdict({ label, name, detail }: { label: string; name: string; detail: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
      <p className="eyebrow text-subtle">{label}</p>
      <p className="mt-2.5 truncate text-[13.5px] font-medium text-ink">{name}</p>
      <p className="mt-1 font-mono text-[12.5px] text-brand-ink tnum">{detail}</p>
    </div>
  );
}
