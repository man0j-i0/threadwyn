"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Handbag,
  SpeakerHigh,
  SpeakerSlash,
  Sparkle,
} from "@phosphor-icons/react";

import { cn, formatMoney, formatNumber } from "@/lib/utils";
import { WEAVE_LABELS, WEAVE_NOTES, type WeaveKey } from "@/lib/weave";
import {
  deriveBehaviour,
  deriveConstruction,
  parseComposition,
  primaryFibre,
  type Construction,
} from "@/lib/weavescope";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { ButtonLink } from "@/components/ui/button";
import { LogoGlyph } from "@/components/brand/logo";
import { useSpeech } from "@/components/ai/use-voice";
import { YarnView } from "./yarn-view";
import { FibreView } from "./fibre-view";

export type ScopeProduct = {
  id: string;
  slug: string;
  name: string;
  weave: WeaveKey;
  gsm: number;
  widthCm: number;
  composition: string;
  fibres: string[];
  finish: string;
  handFeel: string;
  pricePerMetre: number;
  moqMetres: number;
  leadTimeDays: number;
  stockMetres: number;
  category: { name: string; slug: string };
  supplier: { businessName: string; slug: string; city: string };
  colorways: { id: string; name: string; hex: string }[];
};

/**
 * WeaveScope — a guided descent from finished cloth to fibre.
 *
 * Why it exists: procurement teams buy fabric from photographs and a spec line,
 * then find out what they actually bought when the roll arrives. This makes the
 * construction legible — what the weave is doing, how many threads are in it,
 * what the fibre looks like, and why those things set the price.
 *
 * Two deliberate engineering calls:
 *
 * 1. No WebGL. Every frame here is SVG generated from the fabric's stored spec,
 *    so it works on every fabric in the catalogue rather than one hand-authored
 *    hero, ships no 3D runtime, and stays honest — nothing on screen is a
 *    decorative approximation of a different fabric.
 *
 * 2. Native scroll, never hijacked. The magnification stage is a sticky
 *    element driven by scroll position; the page still scrolls at the speed the
 *    OS says it should, the scrollbar stays truthful, and `prefers-reduced-
 *    motion` collapses the whole thing into a plain stacked article.
 */
export function WeaveScope({ product }: { product: ScopeProduct }) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const [magIndex, setMagIndex] = useState(0);

  const speech = useSpeech();
  const [narrating, setNarrating] = useState(false);

  const colour = product.colorways[0]?.hex ?? "#C9C2B4";
  const fibre = primaryFibre(product.fibres);
  const construction = deriveConstruction({ weave: product.weave, gsm: product.gsm, fibre });
  const behaviour = deriveBehaviour({ weave: product.weave, gsm: product.gsm, fibre, construction });
  const composition = parseComposition(product.composition);

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ["start start", "end end"],
  });

  /* --- the descent. Only transform and opacity, so it stays on the GPU. --- */

  const clothScale = useTransform(scrollYProgress, [0, 0.28, 0.42], [1, 5.5, 16]);
  const clothOpacity = useTransform(scrollYProgress, [0.3, 0.42], [1, 0]);

  const yarnScale = useTransform(scrollYProgress, [0.32, 0.62, 0.76], [0.62, 1.15, 3.4]);
  const yarnOpacity = useTransform(scrollYProgress, [0.34, 0.44, 0.68, 0.78], [0, 1, 1, 0]);

  const fibreScale = useTransform(scrollYProgress, [0.7, 1], [0.72, 1.5]);
  const fibreOpacity = useTransform(scrollYProgress, [0.72, 0.82], [0, 1]);

  const gridOpacity = useTransform(scrollYProgress, [0.46, 0.54, 0.66, 0.72], [0, 1, 1, 0]);
  const introOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  const STEPS = [
    { at: 0.0, mag: "1×", caption: "As it arrives on the roll" },
    { at: 0.2, mag: "8×", caption: "A pick glass — the loupe a mill uses to count threads" },
    { at: 0.38, mag: "40×", caption: "Warp and weft resolve into separate yarns" },
    { at: 0.55, mag: "200×", caption: `Twist becomes visible — ${construction.fibresPerYarn} fibres per yarn` },
    { at: 0.74, mag: "600×", caption: "Single fibres" },
    { at: 0.9, mag: "1200×", caption: `${fibre.label} surface structure` },
  ];

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    let next = 0;
    for (let i = 0; i < STEPS.length; i++) if (v >= STEPS[i]!.at) next = i;
    setMagIndex(next);
  });

  const step = STEPS[magIndex]!;

  // Narration is opt-in and reads the same derived facts shown on screen —
  // it never says anything the page does not.
  const narrationScript = [
    `${product.name}, from ${product.supplier.businessName}.`,
    `${product.composition}, ${product.gsm} grams per square metre, woven ${product.widthCm} centimetres wide.`,
    `The structure is a ${WEAVE_LABELS[product.weave].toLowerCase()} — ${construction.interlacing}.`,
    `We estimate ${construction.endsPerCm} warp ends and ${construction.picksPerCm} weft picks per centimetre, about ${construction.threadsPerInch} threads to the inch.`,
    `Each yarn carries roughly ${construction.fibresPerYarn} ${fibre.label.toLowerCase()} fibres. ${fibre.note}`,
  ].join(" ");

  useEffect(() => {
    if (!narrating) speech.cancel();
  }, [narrating, speech]);

  function toggleNarration() {
    if (narrating) {
      speech.cancel();
      setNarrating(false);
    } else {
      speech.speak(narrationScript);
      setNarrating(true);
    }
  }

  return (
    <div className="bg-canvas">
      {/* -------------------------------------------------------- chrome */}
      <header className="fixed inset-x-0 top-0 z-60 flex items-center gap-3 px-4 py-4 sm:px-6">
        <Link
          href={`/product/${product.slug}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface/85 px-4 text-[13px] text-muted backdrop-blur-xl transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} weight="bold" />
          <span className="hidden sm:inline">Back to the fabric</span>
          <span className="sm:hidden">Back</span>
        </Link>

        <div className="flex-1" />

        <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface/85 px-3.5 backdrop-blur-xl">
          <LogoGlyph className="size-4" />
          <span className="text-[12px] font-medium tracking-[-0.01em] text-ink">WeaveScope</span>
        </span>

        {speech.supported ? (
          <button
            type="button"
            onClick={toggleNarration}
            aria-pressed={narrating}
            aria-label={narrating ? "Stop narration" : "Narrate this fabric"}
            className={cn(
              "grid size-10 cursor-pointer place-items-center rounded-full border backdrop-blur-xl transition-colors",
              narrating
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface/85 text-muted hover:text-ink",
            )}
          >
            {narrating ? <SpeakerHigh size={16} weight="fill" /> : <SpeakerSlash size={16} weight="light" />}
          </button>
        ) : null}
      </header>

      {/* ==================================================== THE DESCENT */}
      {reduced ? (
        <StaticDescent product={product} colour={colour} fibre={fibre} construction={construction} />
      ) : (
        <div ref={stageRef} className="relative h-[520vh]">
          <div className="sticky top-0 h-dvh overflow-hidden">
            {/* cloth → yarn → fibre, cross-fading as you descend */}
            <motion.div
              style={{ scale: clothScale, opacity: clothOpacity }}
              className="absolute inset-0 origin-center will-change-transform"
            >
              <FabricSwatch
                weave={product.weave}
                hex={colour}
                gsm={product.gsm}
                seed={product.id}
                alt={`${product.name} at 1× magnification`}
                priority
              />
            </motion.div>

            <motion.div
              style={{ scale: yarnScale, opacity: yarnOpacity }}
              className="absolute inset-0 origin-center will-change-transform"
            >
              <YarnView weave={product.weave} hex={colour} seed={product.id} className="size-full" />
            </motion.div>

            <motion.div
              style={{ scale: fibreScale, opacity: fibreOpacity }}
              className="absolute inset-0 origin-center will-change-transform"
            >
              <FibreView fibre={fibre} hex={colour} seed={product.id} className="size-full" count={3} />
            </motion.div>

            {/* construction overlay — the pick-glass reading */}
            <motion.div style={{ opacity: gridOpacity }} className="pointer-events-none absolute inset-0">
              <ConstructionOverlay construction={construction} weave={product.weave} />
            </motion.div>

            {/* opening title, fades out as the descent begins */}
            <motion.div
              style={{ opacity: introOpacity }}
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            >
              <div className="rounded-[var(--radius-2xl)] bg-[#14120f]/45 px-8 py-10 backdrop-blur-md sm:px-14 sm:py-12">
                <p className="eyebrow text-white/60">WeaveScope</p>
                <h1 className="font-display mt-4 max-w-2xl text-4xl leading-[1.05] font-medium text-balance text-white sm:text-6xl">
                  {product.name}
                </h1>
                <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-pretty text-white/70">
                  {product.composition} · {product.gsm} gsm · {WEAVE_LABELS[product.weave]}
                </p>
                <p className="mt-8 inline-flex items-center gap-2 text-[13px] text-white/60">
                  <ArrowDown size={14} weight="bold" className="animate-bounce" />
                  Scroll to look inside
                </p>
              </div>
            </motion.div>

            {/* magnification readout — the microscope HUD */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-6">
              <div className="mx-auto flex max-w-3xl items-center gap-4 rounded-[var(--radius-lg)] bg-[#14120f]/60 px-4 py-3 backdrop-blur-md sm:px-5">
                <span className="font-mono text-xl font-medium text-white tabular-nums sm:text-2xl">
                  {step.mag}
                </span>
                <span className="h-8 w-px bg-white/20" />
                <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-white/80 sm:text-[13.5px]">
                  {step.caption}
                </p>
                {/* scale bar — the thing a real micrograph always carries */}
                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  <span className="h-px w-10 bg-white/70" />
                  <span className="font-mono text-[10px] text-white/60">
                    {magIndex < 2 ? "10 mm" : magIndex < 4 ? "1 mm" : "50 µm"}
                  </span>
                </div>
              </div>

              <div className="mx-auto mt-2 flex max-w-3xl gap-1">
                {STEPS.map((s, i) => (
                  <span
                    key={s.mag}
                    className={cn(
                      "h-0.5 flex-1 rounded-full transition-colors duration-500",
                      i <= magIndex ? "bg-white/80" : "bg-white/20",
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== CONSTRUCTION */}
      <Section
        eyebrow="What the loom did"
        title={WEAVE_LABELS[product.weave]}
        lede={WEAVE_NOTES[product.weave]}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure value={`${construction.endsPerCm}`} unit="/cm" label="Warp ends" estimated />
          <Figure value={`${construction.picksPerCm}`} unit="/cm" label="Weft picks" estimated />
          <Figure value={`${construction.threadsPerInch}`} unit="TPI" label="Thread count" estimated />
          <Figure
            value={`${Math.round(construction.coverFactor * 100)}`}
            unit="%"
            label="Cover factor"
            estimated
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Figure value={`${construction.yarnTex}`} unit="tex" label="Yarn linear density" estimated />
          <Figure value={formatNumber(construction.fibresPerYarn)} label="Fibres per yarn" estimated />
          <Figure
            value={formatNumber(construction.yarnMetresPerSqm)}
            unit="m"
            label="Yarn per m² of cloth"
            estimated
          />
        </div>

        {/* Being explicit about what is measured and what is derived. */}
        <details className="mt-7 rounded-[var(--radius-md)] border border-line bg-canvas-veil p-4">
          <summary className="cursor-pointer text-[13px] font-medium text-ink">
            How these numbers are worked out
          </summary>
          <div className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-muted">
            <p>
              Weight, width, composition and weave are stored facts, entered by{" "}
              {product.supplier.businessName}. The construction figures above are{" "}
              <strong className="font-medium text-ink">estimates</strong>, derived from them.
            </p>
            <p className="font-mono text-[11.5px] text-subtle">
              gsm = (ends/m × tex + picks/m × tex) ÷ 1000
            </p>
            <p>
              That is one equation with two unknowns, so yarn count is bracketed from the weight class — a
              70 gsm voile is not spun from the same yarn as a 480 gsm duck — and the ends-to-picks split
              comes from the weave&apos;s warp bias. A {WEAVE_LABELS[product.weave].toLowerCase()} carries a{" "}
              {construction.floatLength}-thread float, which lets a weaver pack threads more closely than a
              plain weave at the same yarn count.
            </p>
            <p>
              Confirm against the mill&apos;s own specification sheet before committing to a lot. This is a
              sourcing aid, not a test report.
            </p>
          </div>
        </details>
      </Section>

      {/* ========================================================= FIBRE */}
      <Section eyebrow="The material itself" title={`${fibre.label} under magnification`} lede={fibre.note}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5">
            <div className="aspect-4/3 overflow-hidden rounded-[calc(var(--radius-xl)-9px)]">
              <FibreView fibre={fibre} hex={colour} seed={`${product.id}-detail`} className="size-full" count={4} />
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label="Fibre" value={fibre.label} />
            <Detail label="Form" value={fibre.staple ? "Staple — short lengths, spun" : "Filament — continuous"} />
            <Detail label="Diameter" value={`${fibre.diameterUm[0]}–${fibre.diameterUm[1]} µm`} />
            <Detail
              label="Cross-section"
              value={
                {
                  "convoluted-ribbon": "Collapsed, twisted ribbon",
                  "noded-cylinder": "Cylinder with growth nodes",
                  "triangular-filament": "Rounded triangle",
                  "scaled-cylinder": "Cylinder, scaled cuticle",
                  "smooth-cylinder": "Uniform circle, extruded",
                  "serrated-striated": "Serrated, striated",
                  "flat-metallic": "Flat ribbon on a core",
                }[fibre.morphology]
              }
            />
            <div className="sm:col-span-2">
              <dt className="eyebrow text-subtle">Composition</dt>
              <dd className="mt-3 space-y-2">
                {composition.map((c) => (
                  <div key={c.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-[13px] text-ink">{c.label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${c.pct}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right font-mono text-[12px] text-muted tnum">
                      {c.pct}%
                    </span>
                  </div>
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      {/* ======================================================== ORIGIN */}
      <Section
        eyebrow="How it got here"
        title={`From ${fibre.label.toLowerCase()} to cloth`}
        lede={`Four steps stand between the raw ${fibre.label.toLowerCase()} and the roll you would order. Each one is a place cost enters the fabric.`}
      >
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fibre.origin.map((beat, i) => (
            <li
              key={beat.title}
              className="relative rounded-[var(--radius-lg)] border border-line bg-surface p-5"
            >
              <span className="font-mono text-[11px] text-accent tnum">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-display mt-2.5 text-lg leading-snug font-medium text-ink">{beat.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{beat.body}</p>
              {i < fibre.origin.length - 1 ? (
                <ArrowRight
                  size={13}
                  weight="bold"
                  aria-hidden
                  className="absolute top-1/2 -right-2.5 hidden -translate-y-1/2 text-line-strong lg:block"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </Section>

      {/* ===================================================== BEHAVIOUR */}
      <Section
        eyebrow="How it will behave"
        title="Fibre, weave and weight together"
        lede="Indicative scores, derived consistently across the whole catalogue. Absolute values are approximate — comparing two Threadwyn fabrics on them is not."
      >
        <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-5 sm:p-7">
          <ul className="space-y-5">
            {behaviour.map((b) => (
              <li key={b.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-medium text-ink">{b.label}</span>
                  <span className="font-mono text-[12px] text-muted tnum">{b.value}</span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-inset"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={b.value}
                  aria-label={`${b.label}: ${b.value} out of 100`}
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-[var(--ease-out-expo)]"
                    style={{ width: `${b.value}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11.5px] text-subtle">{b.because}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ========================================================= PRICE */}
      <Section
        eyebrow="Why it costs what it costs"
        title={`${formatMoney(product.pricePerMetre)} a metre`}
        lede="Price in textiles is mostly a function of how much fibre is in the cloth, how fine it is spun, and how slowly the loom has to run."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <PriceCard
            title="Fibre"
            body={`${product.composition}. ${
              fibre.key === "silk" || fibre.key === "zari"
                ? "A premium fibre with a long, manual preparation chain."
                : fibre.key === "linen"
                  ? "Flax needs retting and hackling before it can even be spun — several steps cotton skips."
                  : fibre.key === "wool"
                    ? "Fibre diameter in microns is the single biggest driver of wool cost."
                    : fibre.staple
                      ? "A staple fibre, so it must be carded, drawn and twisted before it becomes yarn."
                      : "A continuous filament, so it skips the spinning stages a staple fibre needs."
            }`}
          />
          <PriceCard
            title="Fineness"
            body={`Spun at roughly ${construction.yarnTex} tex, giving about ${construction.threadsPerInch} threads to the inch. Finer yarn means more ends to warp, more breaks to mend, and a slower loom.`}
          />
          <PriceCard
            title="Structure"
            body={`${WEAVE_LABELS[product.weave]} — ${construction.interlacing}. ${
              construction.floatLength >= 4
                ? "Long floats need careful tension control and a more complex loom set-up."
                : construction.floatLength <= 1
                  ? "The most stable structure, and the fastest to weave."
                  : "A moderately complex lift plan, slower than plain weave to run."
            }`}
          />
        </div>

        <p className="mt-6 rounded-[var(--radius-md)] border border-line bg-canvas-veil p-4 text-[13px] leading-relaxed text-muted">
          One square metre of this cloth contains roughly{" "}
          <strong className="font-medium text-ink">
            {formatNumber(construction.yarnMetresPerSqm)} metres
          </strong>{" "}
          of yarn. At {product.widthCm}cm width, a single linear metre off the roll is{" "}
          {(product.widthCm / 100).toFixed(2)} m² — about{" "}
          {formatNumber(Math.round((construction.yarnMetresPerSqm * product.widthCm) / 100))} metres of yarn,
          for {formatMoney(product.pricePerMetre)}.
        </p>
      </Section>

      {/* =========================================================== EXIT */}
      <section className="mx-auto max-w-4xl px-4 pt-8 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-line bg-surface p-8 text-center sm:p-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]">
            <FabricSwatch
              weave={product.weave}
              hex={colour}
              gsm={product.gsm}
              seed={`${product.id}-cta`}
              alt=""
              drape={false}
            />
          </div>

          <p className="eyebrow text-accent">You&apos;ve been all the way down</p>
          <h2 className="font-display mx-auto mt-4 max-w-lg text-3xl leading-[1.1] font-medium text-balance text-ink sm:text-4xl">
            Ready to source {product.name}?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-pretty text-muted">
            {formatMoney(product.pricePerMetre)} a metre from {product.supplier.businessName} in{" "}
            {product.supplier.city}, {formatNumber(product.moqMetres)}m minimum,{" "}
            {product.leadTimeDays}-day lead time.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink
              href={`/product/${product.slug}`}
              size="lg"
              trailingIcon={<ArrowRight size={14} weight="bold" />}
            >
              View specifications
            </ButtonLink>
            <ButtonLink
              href={`/product/${product.slug}#product-qa`}
              size="lg"
              variant="secondary"
              icon={<Sparkle size={15} weight="light" />}
            >
              Ask the assistant
            </ButtonLink>
            <ButtonLink
              href={`/marketplace?category=${product.category.slug}`}
              size="lg"
              variant="ghost"
              icon={<Handbag size={15} weight="light" />}
            >
              More {product.category.name.toLowerCase()}
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------ fragments */

function Section({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="eyebrow text-accent">{eyebrow}</p>
      <h2 className="font-display mt-3.5 max-w-2xl text-3xl leading-[1.08] font-medium text-balance text-ink sm:text-[2.6rem]">
        {title}
      </h2>
      <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-pretty text-muted">{lede}</p>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Figure({
  value,
  unit,
  label,
  estimated,
}: {
  value: string;
  unit?: string;
  label: string;
  estimated?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <p className="font-mono text-3xl leading-none font-medium text-ink tnum">
        {value}
        {unit ? <span className="ml-1 text-[14px] font-normal text-subtle">{unit}</span> : null}
      </p>
      <p className="mt-3 text-[12.5px] text-muted">{label}</p>
      {estimated ? <p className="mt-1 font-mono text-[10px] text-subtle">estimated</p> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow text-subtle">{label}</dt>
      <dd className="mt-1.5 text-[13.5px] text-ink">{value}</dd>
    </div>
  );
}

function PriceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

/** The construction overlay — a pick-glass reticle laid over the yarns. */
function ConstructionOverlay({
  construction,
  weave,
}: {
  construction: Construction;
  weave: WeaveKey;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <g stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.16" strokeDasharray="1.5 1.5">
          {[14.3, 28.6, 42.9, 57.2, 71.5, 85.8].map((p) => (
            <line key={`v${p}`} x1={p} y1="0" x2={p} y2="100" />
          ))}
          {[14.3, 28.6, 42.9, 57.2, 71.5, 85.8].map((p) => (
            <line key={`h${p}`} x1="0" y1={p} x2="100" y2={p} />
          ))}
        </g>
        {/* measured span, like a reticle */}
        <g stroke="#ffffff" strokeOpacity="0.85" strokeWidth="0.3">
          <line x1="14.3" y1="8" x2="85.8" y2="8" />
          <line x1="14.3" y1="6" x2="14.3" y2="10" />
          <line x1="85.8" y1="6" x2="85.8" y2="10" />
        </g>
      </svg>

      <div className="relative mx-4 max-w-md rounded-[var(--radius-lg)] bg-[#14120f]/70 px-5 py-4 backdrop-blur-md">
        <p className="eyebrow text-white/55">Construction</p>
        <p className="mt-2 font-mono text-[13px] leading-relaxed text-white tabular-nums">
          {construction.endsPerCm} ends × {construction.picksPerCm} picks / cm
        </p>
        <p className="mt-1 font-mono text-[13px] text-white/80 tabular-nums">
          {construction.threadsPerInch} threads per inch
        </p>
        <p className="mt-2.5 text-[12px] leading-relaxed text-white/65">
          {WEAVE_LABELS[weave]} — {construction.interlacing}. Cover factor{" "}
          {Math.round(construction.coverFactor * 100)}%, so {Math.round((1 - construction.coverFactor) * 100)}%
          of the cloth plane is air.
        </p>
      </div>
    </div>
  );
}

/**
 * Reduced-motion path: the same content, stacked, no scroll-driven camera.
 * Someone who gets motion sick still gets the whole explanation.
 */
function StaticDescent({
  product,
  colour,
  fibre,
  construction,
}: {
  product: ScopeProduct;
  colour: string;
  fibre: ReturnType<typeof primaryFibre>;
  construction: Construction;
}) {
  const stages = [
    { mag: "1×", caption: "As it arrives on the roll", node: <FabricSwatch weave={product.weave} hex={colour} gsm={product.gsm} seed={product.id} alt={`${product.name} at 1×`} /> },
    { mag: "40×", caption: `Warp and weft resolve — ${construction.endsPerCm} ends and ${construction.picksPerCm} picks per centimetre`, node: <YarnView weave={product.weave} hex={colour} seed={product.id} className="size-full" /> },
    { mag: "1200×", caption: `${fibre.label} fibre — ${fibre.diameterUm[0]}–${fibre.diameterUm[1]} µm across`, node: <FibreView fibre={fibre} hex={colour} seed={product.id} className="size-full" /> },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 sm:px-6">
      <p className="eyebrow text-accent">WeaveScope</p>
      <h1 className="font-display mt-3.5 text-4xl leading-[1.05] font-medium text-balance text-ink sm:text-5xl">
        {product.name}
      </h1>
      <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted">
        {product.composition} · {product.gsm} gsm · {WEAVE_LABELS[product.weave]}
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {stages.map((s) => (
          <figure key={s.mag} className="rounded-[var(--radius-lg)] border border-line bg-canvas-veil p-1.5">
            <div className="aspect-square overflow-hidden rounded-[calc(var(--radius-lg)-8px)]">{s.node}</div>
            <figcaption className="px-3 py-3">
              <p className="font-mono text-[15px] font-medium text-ink tnum">{s.mag}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-subtle">{s.caption}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
