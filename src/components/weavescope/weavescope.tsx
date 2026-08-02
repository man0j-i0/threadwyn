"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Handbag,
  SpeakerHigh,
  SpeakerSlash,
  Sparkle,
} from "@phosphor-icons/react";

import { formatMoney, formatNumber } from "@/lib/utils";
import { WEAVE_LABELS, WEAVE_NOTES, type WeaveKey } from "@/lib/weave";
import {
  deriveBehaviour,
  deriveConstruction,
  parseComposition,
  primaryFibre,
} from "@/lib/weavescope";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { ButtonLink } from "@/components/ui/button";
import { LogoGlyph } from "@/components/brand/logo";
import { useSpeech } from "@/components/ai/use-voice";
import { LoomStage } from "./loom-stage";
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
 * WeaveScope — watch the cloth being made, then read what that means.
 *
 * Procurement teams buy fabric from a photograph and a spec line, then meet the
 * material when the roll arrives. This shows the construction being built,
 * thread by thread, and then explains what those threads cost and how the cloth
 * will behave because of them.
 *
 * Two engineering calls worth knowing:
 *
 * 1. The loom is procedural, not a downloaded model. Warp count follows GSM,
 *    colour follows the colourway, and the interlacing follows this fabric's
 *    actual weave lift plan — so it runs for all 60 fabrics in the catalogue,
 *    ships no asset, and can never render the wrong cloth. three.js is loaded
 *    only on this route, only client-side, only once the stage is in view.
 *
 * 2. Every figure below the loom is derived from stored spec, and anything
 *    estimated says so with its derivation. A sourcing tool that presents a
 *    guess as a measurement is worse than one that shows nothing.
 */
export function WeaveScope({ product }: { product: ScopeProduct }) {
  const speech = useSpeech();
  const [narrating, setNarrating] = useState(false);

  const colour = product.colorways[0]?.hex ?? "#C9C2B4";
  const fibre = primaryFibre(product.fibres);
  const construction = deriveConstruction({ weave: product.weave, gsm: product.gsm, fibre });
  const behaviour = deriveBehaviour({ weave: product.weave, gsm: product.gsm, fibre, construction });
  const composition = parseComposition(product.composition);

  // Narration only ever reads facts that are also on the page.
  const script = [
    `${product.name}, from ${product.supplier.businessName}.`,
    `${product.composition}, ${product.gsm} grams per square metre, woven ${product.widthCm} centimetres wide.`,
    `The structure is a ${WEAVE_LABELS[product.weave].toLowerCase()} — ${construction.interlacing}.`,
    `We estimate ${construction.endsPerCm} warp ends and ${construction.picksPerCm} weft picks per centimetre, about ${construction.threadsPerInch} threads to the inch.`,
    `Each yarn carries roughly ${construction.fibresPerYarn} ${fibre.label.toLowerCase()} fibres. ${fibre.note}`,
  ].join(" ");

  useEffect(() => {
    if (!narrating) speech.cancel();
  }, [narrating, speech]);

  return (
    <div className="bg-canvas">
      {/* -------------------------------------------------------- chrome */}
      <header className="fixed inset-x-0 top-0 z-60 flex items-center gap-3 px-4 py-4 sm:px-6">
        <Link
          href={`/product/${product.slug}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 text-[13px] text-white/80 backdrop-blur-xl transition-colors hover:text-white"
        >
          <ArrowLeft size={13} weight="bold" />
          <span className="hidden sm:inline">Back to the fabric</span>
          <span className="sm:hidden">Back</span>
        </Link>

        <div className="flex-1" />

        <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3.5 backdrop-blur-xl">
          <LogoGlyph className="size-4" />
          <span className="text-[12px] font-medium tracking-[-0.01em] text-white">WeaveScope</span>
        </span>

        {speech.supported ? (
          <button
            type="button"
            onClick={() => {
              if (narrating) {
                speech.cancel();
                setNarrating(false);
              } else {
                speech.speak(script);
                setNarrating(true);
              }
            }}
            aria-pressed={narrating}
            aria-label={narrating ? "Stop narration" : "Narrate this fabric"}
            className={`grid size-10 cursor-pointer place-items-center rounded-full border backdrop-blur-xl transition-colors ${
              narrating
                ? "border-brand bg-brand text-white"
                : "border-white/20 bg-black/40 text-white/75 hover:text-white"
            }`}
          >
            {narrating ? <SpeakerHigh size={16} weight="fill" /> : <SpeakerSlash size={16} weight="light" />}
          </button>
        ) : null}
      </header>

      {/* ====================================================== THE LOOM */}
      <LoomStage
        weave={product.weave}
        hex={colour}
        gsm={product.gsm}
        seed={product.id}
        productName={product.name}
        composition={product.composition}
        endsPerCm={construction.endsPerCm}
        picksPerCm={construction.picksPerCm}
        interlacing={construction.interlacing}
      />

      {/* ================================================== CONSTRUCTION */}
      <Section
        eyebrow="What the loom did"
        title={WEAVE_LABELS[product.weave]}
        lede={WEAVE_NOTES[product.weave]}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr] lg:items-center">
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5">
            <div className="aspect-square overflow-hidden rounded-[calc(var(--radius-xl)-9px)]">
              <YarnView weave={product.weave} hex={colour} seed={product.id} className="size-full" />
            </div>
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              {Math.round((1 - construction.coverFactor) * 100)}% of the cloth plane is air. That number is
              most of why this fabric breathes the way it does.
            </p>
          </div>
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

        <details className="mt-7 rounded-[var(--radius-md)] border border-line bg-canvas-veil p-4">
          <summary className="cursor-pointer text-[13px] font-medium text-ink">
            How these numbers are worked out
          </summary>
          <div className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-muted">
            <p>
              Weight, width, composition and weave are stored facts, entered by{" "}
              {product.supplier.businessName}. Everything marked{" "}
              <strong className="font-medium text-ink">estimated</strong> is derived from them.
            </p>
            <p className="font-mono text-[11.5px] text-subtle">
              gsm = (ends/m × tex + picks/m × tex) ÷ 1000
            </p>
            <p>
              One equation, two unknowns — so yarn count is bracketed from the weight class (a 70 gsm voile is
              not spun from the same yarn as a 480 gsm duck) and the ends-to-picks split comes from the
              weave&apos;s warp bias. A {WEAVE_LABELS[product.weave].toLowerCase()} carries a{" "}
              {construction.floatLength}-thread float, which lets a weaver pack threads more closely than a
              plain weave at the same count.
            </p>
            <p>
              Confirm against the mill&apos;s specification sheet before committing to a lot. This is a
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
              <FibreView
                fibre={fibre}
                hex={colour}
                seed={`${product.id}-detail`}
                className="size-full"
                count={4}
              />
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
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${c.pct}%` }} />
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
            <li key={beat.title} className="relative rounded-[var(--radius-lg)] border border-line bg-surface p-5">
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

          <p className="eyebrow text-accent">You watched it being made</p>
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
