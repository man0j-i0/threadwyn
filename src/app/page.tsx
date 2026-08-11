import {
  ArrowRight,
  ArrowsLeftRight,
  Certificate,
  ClipboardText,
  Package,
  Ruler,
  SlidersHorizontal,
  Storefront,
} from "@phosphor-icons/react/dist/ssr";

import { db } from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import { serialize } from "@/lib/serialize";
import { readSessionCached } from "@/lib/auth/session";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSearch } from "@/components/marketplace/hero-search";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem, MaskedHeading } from "@/components/motion/reveal";
import { AssistantDock } from "@/components/ai/assistant-dock";
import { CategoryCard } from "@/components/home/category-card";
import { FabricWheel, type WheelSwatch } from "@/components/home/fabric-wheel";
import type { WeaveKey } from "@/lib/weave";

// No `revalidate` here, deliberately. SiteHeader reads the session cookie to
// show who is signed in, which opts every route containing it into dynamic
// rendering — an ISR directive on this page would be silently inert, which is
// worse than absent because it reads like caching is happening. Making the
// landing page cacheable means moving the auth-dependent chrome out of the
// server tree, not adding a number here.

const productSelect = {
  id: true,
  slug: true,
  name: true,
  weave: true,
  gsm: true,
  widthCm: true,
  composition: true,
  pricePerMetre: true,
  compareAtPrice: true,
  moqMetres: true,
  stockMetres: true,
  leadTimeDays: true,
  status: true,
  featured: true,
  category: { select: { name: true, slug: true } },
  supplier: { select: { businessName: true, slug: true, verified: true, city: true } },
  colorways: { select: { id: true, name: true, hex: true }, orderBy: { position: "asc" } },
  images: { select: { url: true, alt: true }, orderBy: { position: "asc" }, take: 1 },
} as const;

// The hero cascade is drawn from real catalogue rows, not decoration — each
// card opens that fabric's loom. Picked for weave and colour-temperature
// spread so the renderer's range reads at a glance.
const HERO_PICKS = [
  "12oz-stretch-denim-ahmedabad-denim",
  "pure-european-flax-165-erode-linen",
  "mulberry-charmeuse-16mm-surat-silk-house",
  "wool-herringbone-280-bhiwandi-loomworks",
  "combed-single-jersey-180-ludhiana-knit-mills",
];

export default async function LandingPage() {
  /**
   * The page is an acquisition surface, and half of it is addressed to someone
   * who has not signed up. Read who is here so it stops asking a signed-in
   * buyer to create an account while the header shows their avatar — and, worse,
   * pointing them at `/register`, which `proxy.ts` bounces them straight off.
   *
   * `readSessionCached` is already called by `SiteHeader` on this request, so
   * this is a cache read rather than a second cookie parse. The page is dynamic
   * for that reason regardless; see the note above `productSelect`.
   */
  const session = await readSessionCached();

  // One batch, not two. These queries have no dependency on each other, and the
  // database is a region away from the function — a second sequential await
  // costs another full round-trip for nothing.
  const [featured, categories, stats, mills, heroRows] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE", featured: true },
      select: productSelect,
      orderBy: { viewCount: "desc" },
      take: 8,
    }),
    db.category.findMany({
      orderBy: { position: "asc" },
      select: {
        name: true,
        slug: true,
        blurb: true,
        accentHex: true,
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
      },
      take: 8,
    }),
    Promise.all([
      db.product.count({ where: { status: "ACTIVE" } }),
      db.supplierProfile.count({ where: { verified: true } }),
      db.product.aggregate({ _sum: { stockMetres: true }, where: { status: "ACTIVE" } }),
      db.product.aggregate({ _avg: { leadTimeDays: true }, where: { status: "ACTIVE" } }),
    ]),
    db.supplierProfile.findMany({
      where: { verified: true },
      orderBy: { rating: "desc" },
      select: { businessName: true, city: true, slug: true, yearEstablished: true },
      take: 8,
    }),
    db.product.findMany({
      where: { slug: { in: HERO_PICKS } },
      select: {
        id: true,
        slug: true,
        name: true,
        weave: true,
        gsm: true,
        composition: true,
        colorways: { select: { hex: true }, orderBy: { position: "asc" }, take: 1 },
      },
    }),
  ]);

  const [productCount, millCount, stockAgg, leadAgg] = stats;
  const products = serialize(featured) as unknown as ProductCardData[];

  // Preserve the curated order, and fall back to featured stock if a seed slug
  // ever drifts — the hero must never render half-empty.
  const bySlug = new Map(heroRows.map((r) => [r.slug, r]));
  const heroSwatches = HERO_PICKS
    .map((s) => bySlug.get(s))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .concat(heroRows.filter((r) => !HERO_PICKS.includes(r.slug)))
    .slice(0, 5);

  return (
    <>
      <SiteHeader floating />

      <main id="main" className="relative">
        {/* ================================================================= HERO */}
        <section className="relative overflow-hidden">
          {/* Warm ambient wash — two soft radials, no neon, no mesh gradient. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-40 -left-32 size-[42rem] rounded-full bg-[radial-gradient(circle,var(--brand-soft),transparent_68%)] opacity-70" />
            <div className="absolute -top-24 right-0 size-[34rem] rounded-full bg-[radial-gradient(circle,var(--accent-soft),transparent_68%)] opacity-60" />
          </div>

          <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-6 lg:px-10 lg:pt-24 lg:pb-28">
            <div className="max-w-2xl">
              <h1 className="font-display text-[2.6rem] leading-[1.02] font-medium tracking-[-0.025em] text-ink sm:text-6xl lg:text-[4.25rem]">
                <MaskedHeading text="Decide on fabric" delay={0.05} />
                <span className="block text-muted italic">
                  <MaskedHeading text="in one place." delay={0.28} />
                </span>
              </h1>

              <Reveal delay={0.5}>
                <p className="mt-6 max-w-lg text-[16.5px] leading-relaxed text-pretty text-muted">
                  {formatNumber(productCount)} live fabrics from {millCount} verified Indian mills.
                  Compare them by what actually matters.
                </p>
                <p className="mt-2.5 max-w-lg text-[15px] leading-relaxed text-pretty text-subtle">
                  GSM, composition, MOQ and lead time, all in one place.
                </p>
              </Reveal>

              <Reveal delay={0.62} className="mt-9">
                <HeroSearch />
              </Reveal>

              <Reveal delay={0.75}>
                <dl className="mt-11 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-8 sm:grid-cols-4">
                  <Stat value={formatNumber(productCount)} label="Live fabrics" />
                  <Stat value={String(millCount)} label="Verified mills" />
                  <Stat
                    value={`${Math.round((stockAgg._sum.stockMetres ?? 0) / 1000)}k m`}
                    label="Stock on hand"
                  />
                  <Stat value={`${Math.round(leadAgg._avg.leadTimeDays ?? 0)} days`} label="Median lead time" />
                </dl>
              </Reveal>
            </div>

            {/* The one place WeaveScope is offered. A dial rather than a
                stack: every fabric is visible, the selected one is lifted out
                at full size, and it turns by scroll, by arrow button or by
                clicking any card on the ring. */}
            <Reveal delay={0.3} y={28} className="relative hidden lg:-mr-10 lg:block xl:-mr-16">
              <FabricWheel
                swatches={heroSwatches.map<WheelSwatch>((s) => ({
                  id: s.id,
                  slug: s.slug,
                  name: s.name,
                  weave: s.weave as WeaveKey,
                  gsm: s.gsm,
                  composition: s.composition,
                  hex: s.colorways[0]?.hex ?? "#C9C2B4",
                }))}
              />
            </Reveal>
          </div>

          {/* Mill marquee — proof of supply, not decoration. */}
          <div className="border-y border-line bg-canvas-veil/60 py-4">
            <div className="mask-fade-x overflow-hidden">
              <div className="flex w-max animate-[tw-marquee_38s_linear_infinite] items-center gap-10 motion-reduce:animate-none">
                {[...mills, ...mills].map((m, i) => (
                  <span key={`${m.slug}-${i}`} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
                    <Certificate size={14} weight="light" className="text-brass" aria-hidden />
                    <span className="text-[13px] font-medium text-muted">{m.businessName}</span>
                    <span className="font-mono text-[11px] text-subtle">
                      {m.city}
                      {m.yearEstablished ? ` · est. ${m.yearEstablished}` : ""}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================== CATEGORIES */}
        <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <Reveal>
            <SectionHeading
              eyebrow="Browse by construction"
              title="Find the right fabric for the job."
              description="Explore fabrics by weave, weight and performance."
              action={
                <ButtonLink
                  href="/marketplace"
                  variant="secondary"
                  trailingIcon={<ArrowRight size={13} weight="bold" />}
                >
                  All fabrics
                </ButtonLink>
              }
            />
          </Reveal>

          <Stagger className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {categories.map((c) => (
              <StaggerItem key={c.slug}>
                <CategoryCard
                  category={{
                    slug: c.slug,
                    name: c.name,
                    blurb: c.blurb,
                    accentHex: c.accentHex,
                    count: c._count.products,
                  }}
                />
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ============================================================= FEATURED */}
        <section className="border-y border-line bg-canvas-veil/50">
          <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <Reveal>
              <SectionHeading
                eyebrow="Featured this week"
                title="Fabrics worth a closer look"
                description="Explore standout fabrics from verified mills."
              />
            </Reveal>

            <Stagger stagger={0.06} className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {products.map((p, i) => (
                <StaggerItem key={p.id}>
                  <ProductCard product={p} priority={i < 4} />
                </StaggerItem>
              ))}
            </Stagger>

            <Reveal className="mt-12 flex justify-center">
              <ButtonLink
                href="/marketplace"
                size="lg"
                variant="secondary"
                trailingIcon={<ArrowRight size={14} weight="bold" />}
              >
                Browse all {formatNumber(productCount)} fabrics
              </ButtonLink>
            </Reveal>
          </div>
        </section>

        {/* ========================================================= HOW IT WORKS */}
        {/* The footer carries `mt-24`, which normally sits against the CTA
            section's own canvas background and is invisible. With the CTA
            hidden this tinted section ends right before it, so the tint stopped
            and 96px of bare canvas showed through above the footer photograph.
            Pull the footer back up by that margin and pay it back as padding
            inside the tint: same total height, one continuous colour. */}
        <section
          className={`border-t border-line bg-canvas-veil/50${session ? " -mb-24 pb-24" : ""}`}
        >
          <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <Reveal>
              <SectionHeading
                align="center"
                eyebrow="Both sides of the counter"
                title="One catalogue. Two sides."
                description="Buyers source faster. Suppliers manage orders in one place."
              />
            </Reveal>

            <div className="mt-14 grid gap-5 lg:grid-cols-2">
              <Reveal>
                <RoleCard
                  role="For buyers"
                  title="From brief to order"
                  steps={[
                    { icon: <SlidersHorizontal size={15} weight="light" />, text: "Search and filter fabrics" },
                    { icon: <ArrowsLeftRight size={15} weight="light" />, text: "Compare key specifications" },
                    { icon: <Ruler size={15} weight="light" />, text: "Order by each mill's MOQ" },
                    { icon: <Package size={15} weight="light" />, text: "Track your orders" },
                  ]}
                  href={session ? "/marketplace" : "/register?role=buyer"}
                  cta={session ? "Explore the marketplace" : "Start sourcing"}
                />
              </Reveal>
              <Reveal delay={0.1}>
                <RoleCard
                  role="For suppliers"
                  title="From listing to order"
                  steps={[
                    { icon: <ClipboardText size={15} weight="light" />, text: "Set up your mill" },
                    { icon: <Storefront size={15} weight="light" />, text: "List fabrics with key specs" },
                    { icon: <Package size={15} weight="light" />, text: "Manage stock and orders" },
                    { icon: <Certificate size={15} weight="light" />, text: "Track order status" },
                  ]}
                  // A signed-in supplier goes to their console; a signed-in
                  // buyer gets the mill directory rather than a dead link to
                  // registration they cannot reach.
                  href={
                    session?.role === "SUPPLIER"
                      ? "/supplier"
                      : session
                        ? "/suppliers"
                        : "/register?role=supplier"
                  }
                  cta={
                    session?.role === "SUPPLIER"
                      ? "Open your console"
                      : session
                        ? "See the mills"
                        : "List your mill"
                  }
                  accent
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================================================================== CTA */}
        {/* Sign-up only. Someone already signed in has nothing to convert to,
            and the header already offers them everywhere they can go. */}
        {session ? null : (
        <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <Reveal>
            <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-line bg-surface px-6 py-16 text-center sm:px-16 sm:py-20">
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]">
                <FabricSwatch weave="JACQUARD" hex="#0F4D35" gsm={165} seed="cta" alt="" drape={false} />
              </div>
              <p className="eyebrow text-accent">Ready when you are</p>
              <h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl leading-[1.08] font-medium text-balance text-ink sm:text-[2.75rem]">
                Ready to source better?
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-pretty text-muted">
                Find fabrics, compare suppliers and place your next order.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <ButtonLink
                  href="/register"
                  size="lg"
                  trailingIcon={<ArrowRight size={14} weight="bold" />}
                >
                  Create an account
                </ButtonLink>
                <ButtonLink href="/marketplace" size="lg" variant="secondary">
                  Browse without signing up
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </section>
        )}
      </main>

      <SiteFooter />
      <AssistantDock />
    </>
  );
}

/* ------------------------------------------------------------- fragments */

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="eyebrow text-subtle">{label}</dt>
      <dd className="font-display mt-2 text-[26px] leading-none font-medium text-ink tnum">{value}</dd>
    </div>
  );
}

function RoleCard({
  role,
  title,
  steps,
  href,
  cta,
  accent,
}: {
  role: string;
  title: string;
  steps: { icon: React.ReactNode; text: string }[];
  href: string;
  cta: string;
  accent?: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5">
      <div className="flex h-full flex-col rounded-[calc(var(--radius-xl)-7px)] border border-line bg-surface p-7 shadow-[var(--shadow-inset)] sm:p-9">
        <p className={`eyebrow ${accent ? "text-accent" : "text-brand-ink"}`}>{role}</p>
        <h3 className="font-display mt-3.5 text-2xl leading-snug font-medium text-ink">{title}</h3>
        <ol className="mt-7 flex-1 space-y-3.5">
          {steps.map((s, i) => (
            <li key={s.text} className="flex items-center gap-3.5">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full border ${
                  accent ? "border-accent-line bg-accent-soft text-accent" : "border-brand-line bg-brand-soft text-brand-ink"
                }`}
              >
                {s.icon}
              </span>
              <span className="flex-1 text-[14px] text-muted">{s.text}</span>
              <span className="font-mono text-[11px] text-subtle tnum">{String(i + 1).padStart(2, "0")}</span>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <ButtonLink
            href={href}
            variant={accent ? "accent" : "primary"}
            fullWidth
            trailingIcon={<ArrowRight size={13} weight="bold" />}
          >
            {cta}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

