import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, Certificate, MapPin, Star } from "@phosphor-icons/react/dist/ssr";

import {
  getProductBySlug,
  getSimilarProducts,
  incrementViewCount,
} from "@/server/services/product-service";
import { serialize } from "@/lib/serialize";
import { readSessionCached } from "@/lib/auth/session";
import { formatMetres, formatNumber } from "@/lib/utils";
import { ProductDetail, type ProductDetailData } from "@/components/product/product-detail";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { ProductQA } from "@/components/ai/product-qa";
import { AssistantDock } from "@/components/ai/assistant-dock";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Fabric not found" };

  return {
    title: product.name,
    description: `${product.composition}, ${product.gsm} gsm, ${product.widthCm}cm wide. ₹${Number(product.pricePerMetre)}/m from ${product.supplier.businessName}. MOQ ${product.moqMetres}m, ${product.leadTimeDays}-day lead time.`,
    openGraph: { title: `${product.name} · Threadwyn`, description: product.description.slice(0, 200) },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // Deliberately not awaited — a view counter must never delay a page render.
  void incrementViewCount(product.id);

  const [similar, session] = await Promise.all([getSimilarProducts(product.id, 4), readSessionCached()]);
  const detail = serialize(product) as unknown as ProductDetailData;
  const similarCards = serialize(similar) as unknown as ProductCardData[];

  const hours = product.supplier.operatingHours as Record<
    string,
    { open: string; close: string } | null
  > | null;

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <nav aria-label="Breadcrumb" className="mb-7">
          <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-subtle">
            <li>
              <Link href="/marketplace" className="transition-colors hover:text-ink">
                Marketplace
              </Link>
            </li>
            <CaretRight size={9} weight="bold" aria-hidden />
            <li>
              <Link
                href={`/marketplace?category=${product.category.slug}`}
                className="transition-colors hover:text-ink"
              >
                {product.category.name}
              </Link>
            </li>
            <CaretRight size={9} weight="bold" aria-hidden />
            <li aria-current="page" className="truncate text-muted">
              {product.name}
            </li>
          </ol>
        </nav>

        <ProductDetail product={detail} canBuy={session?.role !== "SUPPLIER"} />

        {/* ---------------------------------------------------- description */}
        <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
          <div className="space-y-12">
            <section>
              <h2 className="font-display text-2xl font-medium text-ink">About this cloth</h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-pretty text-muted">
                {product.description}
              </p>

              <dl className="mt-8 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-2">
                <SpecRow label="Composition" value={product.composition} />
                <SpecRow label="Weave" value={product.weave.charAt(0) + product.weave.slice(1).toLowerCase()} />
                <SpecRow label="Weight" value={`${product.gsm} gsm`} mono />
                <SpecRow label="Width" value={`${product.widthCm} cm`} mono />
                <SpecRow label="Finish" value={product.finish} />
                <SpecRow label="Hand-feel" value={product.handFeel} />
                <SpecRow label="Minimum order" value={`${formatNumber(product.moqMetres)} m`} mono />
                <SpecRow label="Lead time" value={`${product.leadTimeDays} days`} mono />
                <SpecRow label="Stock on hand" value={formatMetres(product.stockMetres)} mono />
                <SpecRow label="Colourways" value={String(product.colorways.length)} mono />
              </dl>

              {product.useCases.length ? (
                <div className="mt-7">
                  <p className="eyebrow text-subtle">Typically used for</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.useCases.map((u) => (
                      <Badge key={u} tone="neutral">
                        {u}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {product.sustainability.length ? (
                <div className="mt-6">
                  <p className="eyebrow text-subtle">Certifications</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.sustainability.map((s) => (
                      <Badge key={s} tone="brass" icon={<Certificate size={11} weight="light" />}>
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <ProductQA
              slug={product.slug}
              name={product.name}
              suggestions={[
                "What's it best suited for?",
                "How much stock is on hand?",
                "Will it shrink?",
                "What's the minimum order?",
              ]}
            />
          </div>

          {/* ------------------------------------------------------ supplier */}
          <aside>
            <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-6">
              <p className="eyebrow text-subtle">Woven by</p>
              <h2 className="font-display mt-2.5 text-xl leading-snug font-medium text-ink">
                {product.supplier.businessName}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {product.supplier.verified ? <Badge tone="brass">Verified mill</Badge> : null}
                <span className="inline-flex items-center gap-1 font-mono text-[12px] text-muted tnum">
                  <Star size={11} weight="fill" className="text-brass" />
                  {product.supplier.rating.toFixed(1)}
                  <span className="text-subtle">({product.supplier.ratingCount})</span>
                </span>
              </div>

              {product.supplier.tagline ? (
                <p className="mt-3 text-[13.5px] text-muted italic">{product.supplier.tagline}</p>
              ) : null}

              {product.supplier.description ? (
                <p className="mt-4 text-[13px] leading-relaxed text-muted">{product.supplier.description}</p>
              ) : null}

              <div className="mt-5 space-y-2.5 border-t border-line pt-5">
                <Row
                  icon={<MapPin size={13} weight="light" />}
                  label={`${product.supplier.city}, ${product.supplier.state}`}
                />
                {product.supplier.yearEstablished ? (
                  <Row icon={<Certificate size={13} weight="light" />} label={`Established ${product.supplier.yearEstablished}`} />
                ) : null}
              </div>

              {hours ? (
                <div className="mt-5 border-t border-line pt-5">
                  <p className="eyebrow text-subtle">Operating hours</p>
                  <dl className="mt-3 space-y-1.5">
                    {(["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).map((day) => (
                      <div key={day} className="flex items-center justify-between gap-3">
                        <dt className="text-[12px] text-subtle capitalize">{day}</dt>
                        <dd className="font-mono text-[11.5px] text-muted tnum">
                          {hours[day] ? `${hours[day]!.open}–${hours[day]!.close}` : "Closed"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {product.supplier.certifications.length ? (
                <div className="mt-5 border-t border-line pt-5">
                  <p className="eyebrow text-subtle">Mill certifications</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {product.supplier.certifications.map((c) => (
                      <Badge key={c} tone="neutral">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <Link
                href={`/marketplace?supplier=${product.supplier.slug}`}
                className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink underline underline-offset-4 transition-colors hover:text-brand-hover"
              >
                See everything from this mill
                <CaretRight size={10} weight="bold" />
              </Link>
            </div>
          </aside>
        </div>

        {/* ------------------------------------------------------- similar */}
        {similarCards.length ? (
          <section className="mt-20">
            <Reveal>
              <SectionHeading
                eyebrow="Comparable cloth"
                title="Fabrics that work like this one"
                description="Ranked on construction, weight band and price proximity — not just on sharing a word in the name."
              />
            </Reveal>
            <div className="mt-9 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {similarCards.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <AssistantDock productSlug={product.slug} productName={product.name} />
    </>
  );
}

function SpecRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 bg-surface px-4 py-3.5">
      <dt className="text-[12.5px] text-subtle">{label}</dt>
      <dd className={`text-right text-[13px] text-ink ${mono ? "font-mono tnum" : ""}`}>{value}</dd>
    </div>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="flex items-center gap-2.5 text-[13px] text-muted">
      <span className="shrink-0 text-subtle">{icon}</span>
      {label}
    </p>
  );
}
