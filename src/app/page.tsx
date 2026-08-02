import Link from "next/link";
import {
  ArrowRight,
  ArrowsLeftRight,
  Certificate,
  ChatCircleDots,
  ClipboardText,
  Microphone,
  Package,
  Ruler,
  SlidersHorizontal,
  Storefront,
} from "@phosphor-icons/react/dist/ssr";

import { db } from "@/lib/db";
import { formatNumber } from "@/lib/utils";
import { serialize } from "@/lib/serialize";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSearch } from "@/components/marketplace/hero-search";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem, MaskedHeading } from "@/components/motion/reveal";
import { AssistantDock } from "@/components/ai/assistant-dock";
import type { WeaveKey } from "@/lib/weave";

export const revalidate = 60;

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

export default async function LandingPage() {
  const [featured, categories, stats, mills] = await Promise.all([
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
  ]);

  const [productCount, millCount, stockAgg, leadAgg] = stats;
  const products = serialize(featured) as unknown as ProductCardData[];

  // The hero cascade is drawn from real catalogue rows, not decoration — each
  // card opens that fabric's loom. Picked for weave and colour-temperature
  // spread so the renderer's range reads at a glance.
  const heroPicks = [
    "12oz-stretch-denim-ahmedabad-denim",
    "pure-european-flax-165-erode-linen",
    "mulberry-charmeuse-16mm-surat-silk-house",
    "wool-herringbone-280-bhiwandi-loomworks",
    "combed-single-jersey-180-ludhiana-knit-mills",
  ];

  const heroRows = await db.product.findMany({
    where: { slug: { in: heroPicks } },
    select: {
      id: true,
      slug: true,
      name: true,
      weave: true,
      gsm: true,
      composition: true,
      colorways: { select: { hex: true }, orderBy: { position: "asc" }, take: 1 },
    },
  });

  // Preserve the curated order, and fall back to featured stock if a seed slug
  // ever drifts — the hero must never render half-empty.
  const bySlug = new Map(heroRows.map((r) => [r.slug, r]));
  const heroSwatches = heroPicks
    .map((s) => bySlug.get(s))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .concat(heroRows.filter((r) => !heroPicks.includes(r.slug)))
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

          <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-10 lg:pt-24 lg:pb-28">
            <div className="max-w-2xl">
              <Reveal>
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-soft px-3 py-1.5">
                  <span className="size-1.5 rounded-full bg-brand" />
                  <span className="eyebrow text-brand-ink">Mill-direct textile sourcing</span>
                </span>
              </Reveal>

              <h1 className="font-display mt-6 text-[2.6rem] leading-[1.02] font-medium tracking-[-0.025em] text-ink sm:text-6xl lg:text-[4.25rem]">
                <MaskedHeading text="Decide on fabric" delay={0.05} />
                <span className="block text-muted italic">
                  <MaskedHeading text="in one place." delay={0.28} />
                </span>
              </h1>

              <Reveal delay={0.5}>
                <p className="mt-6 max-w-xl text-[16.5px] leading-relaxed text-pretty text-muted">
                  Threadwyn puts {formatNumber(productCount)} live fabrics from {millCount} verified Indian mills
                  behind one search. Compare on GSM, composition, MOQ and lead time — not on how well a
                  supplier photographs their cloth.
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

            {/* Z-axis cascade of real rendered swatches. Rotations and overlaps
                are stripped below lg so nothing collides on a phone. */}
            {/* Each card is a door into that fabric's loom. Rotations and
                overlaps are stripped below lg so nothing collides on a phone. */}
            <Reveal delay={0.3} y={28} className="relative hidden lg:block">
              <div className="relative mx-auto h-[34rem] w-full max-w-lg">
                {heroSwatches.map((s, i) => {
                  const layout = [
                    "left-0 top-6 w-56 rotate-[-6deg]",
                    "left-40 top-0 w-64 rotate-[3deg] z-20",
                    "right-0 top-40 w-52 rotate-[7deg] z-10",
                    "left-4 top-64 w-60 rotate-[2deg] z-30",
                    "right-6 bottom-0 w-48 rotate-[-4deg] z-20",
                  ][i]!;
                  return (
                    <Link
                      key={s.id}
                      href={`/weavescope/${s.slug}`}
                      style={{ animationDelay: `${0.35 + i * 0.11}s` }}
                      aria-label={`Look inside ${s.name} — watch it being woven`}
                      className={`group/hero animate-fade-up absolute ${layout} block rounded-[var(--radius-lg)] border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)] transition-[transform,box-shadow,border-color] duration-700 ease-[var(--ease-out-expo)] hover:-translate-y-2 hover:rotate-0 hover:border-brand hover:shadow-[var(--shadow-xl)] focus-visible:-translate-y-2 focus-visible:rotate-0`}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-[calc(var(--radius-lg)-8px)]">
                        <FabricSwatch
                          weave={s.weave as WeaveKey}
                          hex={s.colorways[0]?.hex ?? "#C9C2B4"}
                          gsm={s.gsm}
                          seed={s.id}
                          alt={`${s.name} swatch`}
                          priority
                        />

                        {/* The reticle resolves on hover — a loupe mark, not a
                            generic info glyph. */}
                        <span className="absolute inset-0 grid place-items-center bg-[#14120f]/0 transition-colors duration-500 group-hover/hero:bg-[#14120f]/45 group-focus-visible/hero:bg-[#14120f]/45">
                          <span className="flex scale-90 items-center gap-2 rounded-full border border-white/30 bg-[#14120f]/70 px-3.5 py-2 opacity-0 backdrop-blur-md transition-[opacity,transform] duration-500 ease-[var(--ease-spring)] group-hover/hero:scale-100 group-hover/hero:opacity-100 group-focus-visible/hero:scale-100 group-focus-visible/hero:opacity-100">
                            <span className="relative grid size-4 place-items-center text-white">
                              <span className="absolute inset-0 rounded-full border border-current opacity-50 motion-safe:animate-ping motion-safe:[animation-duration:2s]" />
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
                            <span className="text-[11.5px] font-medium whitespace-nowrap text-white">
                              Look inside
                            </span>
                          </span>
                        </span>
                      </div>

                      <div className="px-2 pt-2.5 pb-1.5">
                        <p className="truncate text-[12px] font-medium text-ink">{s.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-subtle">
                          {s.gsm} gsm · {s.composition}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
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
              title="Twelve categories, sorted the way a sourcing team thinks"
              description="Not by season or trend — by what the cloth is and what it can take."
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
                <Link
                  href={`/marketplace?category=${c.slug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-5 transition-[border-color,box-shadow,transform] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-md)]"
                >
                  <span
                    aria-hidden
                    className="absolute -top-10 -right-10 size-28 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-500 group-hover:opacity-25"
                    style={{ backgroundColor: c.accentHex }}
                  />
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: c.accentHex }}
                  />
                  <h3 className="mt-4 text-[15px] font-medium text-ink">{c.name}</h3>
                  <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-subtle">{c.blurb}</p>
                  <p className="mt-4 font-mono text-[11px] text-subtle tnum">
                    {c._count.products} {c._count.products === 1 ? "fabric" : "fabrics"}
                  </p>
                </Link>
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
                title="Cloth the mills are backing"
                description="Every swatch below is rendered from that fabric's actual weave, weight and dyed colourway — so the colour you see is the colour that ships."
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

        {/* =================================================================== AI */}
        <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
            <Reveal>
              <p className="eyebrow text-accent">The assistant</p>
              <h2 className="font-display mt-4 text-3xl leading-[1.08] font-medium text-balance text-ink sm:text-[2.75rem]">
                It translates what you said into filters you can see and undo.
              </h2>
              <p className="mt-5 text-[15.5px] leading-relaxed text-pretty text-muted">
                Ask in plain English or just talk. Threadwyn turns the request into structured filters, runs the
                same deterministic query the sidebar uses, and shows you exactly which constraints it applied.
                Disagree with one? Remove the chip. The AI proposes; you decide.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  {
                    icon: <ChatCircleDots size={17} weight="light" />,
                    title: "Grounded in the catalogue",
                    body: "Answers cite real products and real specs. If the data doesn't say it, the assistant says so.",
                  },
                  {
                    icon: <Microphone size={17} weight="light" />,
                    title: "Voice, when your hands are on cloth",
                    body: "Push-to-talk with a live transcript. Same assistant, different input.",
                  },
                  {
                    icon: <ArrowsLeftRight size={17} weight="light" />,
                    title: "Comparison that reads like a spec sheet",
                    body: "Side-by-side on GSM, composition, MOQ, lead time and price — plus which to pick when.",
                  },
                ].map((f) => (
                  <li key={f.title} className="flex gap-3.5">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border border-brand-line bg-brand-soft text-brand-ink">
                      {f.icon}
                    </span>
                    <span>
                      <span className="block text-[14px] font-medium text-ink">{f.title}</span>
                      <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{f.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.12} y={26}>
              <AssistantPreview />
            </Reveal>
          </div>
        </section>

        {/* ========================================================= HOW IT WORKS */}
        <section className="border-t border-line bg-canvas-veil/50">
          <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
            <Reveal>
              <SectionHeading
                align="center"
                eyebrow="Both sides of the counter"
                title="One catalogue, two jobs to be done"
                description="Buyers need to decide faster. Suppliers need fewer emails. The same data serves both."
              />
            </Reveal>

            <div className="mt-14 grid gap-5 lg:grid-cols-2">
              <Reveal>
                <RoleCard
                  role="For buyers"
                  title="From a vague brief to a placed order"
                  steps={[
                    { icon: <SlidersHorizontal size={15} weight="light" />, text: "Search or filter down to a shortlist" },
                    { icon: <ArrowsLeftRight size={15} weight="light" />, text: "Compare candidates on the specs that matter" },
                    { icon: <Ruler size={15} weight="light" />, text: "Add by the metre against each mill's MOQ" },
                    { icon: <Package size={15} weight="light" />, text: "Track each mill's half of the order separately" },
                  ]}
                  href="/register?role=buyer"
                  cta="Start sourcing"
                />
              </Reveal>
              <Reveal delay={0.1}>
                <RoleCard
                  role="For suppliers"
                  title="A console instead of an inbox"
                  steps={[
                    { icon: <ClipboardText size={15} weight="light" />, text: "Set up your mill by talking, not form-filling" },
                    { icon: <Storefront size={15} weight="light" />, text: "List cloth with the specs buyers filter on" },
                    { icon: <Package size={15} weight="light" />, text: "Take orders with stock checked automatically" },
                    { icon: <Certificate size={15} weight="light" />, text: "Move each order through a clear status ladder" },
                  ]}
                  href="/register?role=supplier"
                  cta="List your mill"
                  accent
                />
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================================================================== CTA */}
        <section className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
          <Reveal>
            <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-line bg-surface px-6 py-16 text-center sm:px-16 sm:py-20">
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]">
                <FabricSwatch weave="JACQUARD" hex="#0F4D35" gsm={165} seed="cta" alt="" drape={false} />
              </div>
              <p className="eyebrow text-accent">Ready when you are</p>
              <h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl leading-[1.08] font-medium text-balance text-ink sm:text-[2.75rem]">
                Sourcing decisions shouldn&apos;t take three weeks of emails.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-pretty text-muted">
                Create an account in under a minute. Onboarding is a short conversation, not a twelve-field form.
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

/** A static, honest rendering of a real assistant exchange — same layout the
 *  live dock uses, so the marketing claim and the product agree. */
function AssistantPreview() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5 shadow-[var(--shadow-lg)]">
      <div className="rounded-[calc(var(--radius-xl)-7px)] border border-line bg-surface p-5 shadow-[var(--shadow-inset)] sm:p-6">
        <div className="flex items-center gap-2.5 border-b border-line pb-4">
          <span className="grid size-7 place-items-center rounded-full bg-brand text-white">
            <ChatCircleDots size={14} weight="fill" />
          </span>
          <span className="text-[13px] font-medium text-ink">Threadwyn Assistant</span>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-subtle">
            <span className="size-1.5 rounded-full bg-positive" />
            grounded in 60 fabrics
          </span>
        </div>

        <div className="space-y-4 pt-5">
          <div className="flex justify-end">
            <p className="max-w-[85%] rounded-[var(--radius-md)] rounded-br-sm bg-brand px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white dark:text-[#08110d]">
              Breathable cotton for summer shirting, under ₹300 a metre, at least 2000m on hand
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[13px] text-subtle">Applied these filters:</p>
            <div className="flex flex-wrap gap-1.5">
              {["Category: Shirting", "Fibre: Cotton", "≤ ₹300/m", "Stock ≥ 2000m", "≤ 160 gsm"].map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-2.5 py-1 font-mono text-[11px] text-brand-ink"
                >
                  {f}
                  <span aria-hidden className="text-brand-ink/45">
                    ×
                  </span>
                </span>
              ))}
            </div>

            <div className="space-y-2 rounded-[var(--radius-md)] border border-line bg-canvas-veil p-3.5">
              {[
                { name: "Compact Cotton Poplin 120", meta: "120 gsm · 8,400m · ₹238/m", hex: "#F7F5F0", weave: "PLAIN" as WeaveKey },
                { name: "End-on-End 110", meta: "110 gsm · 4,100m · ₹246/m", hex: "#A9C0D4", weave: "PLAIN" as WeaveKey },
                { name: "Indigo Chambray 130", meta: "130 gsm · 3,600m · ₹254/m", hex: "#5A6E92", weave: "PLAIN" as WeaveKey },
              ].map((r) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="size-9 shrink-0 overflow-hidden rounded-[var(--radius-xs)]">
                    <FabricSwatch weave={r.weave} hex={r.hex} gsm={120} seed={r.name} alt="" drape={false} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{r.name}</span>
                    <span className="block truncate font-mono text-[10.5px] text-subtle">{r.meta}</span>
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[13px] leading-relaxed text-muted">
              Three matches. The poplin has the deepest stock and the tightest weave — best if you need shade
              consistency across a repeat order. The chambray is softer but only carries three colourways.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
