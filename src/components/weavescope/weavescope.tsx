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
import { deriveConstruction, primaryFibre } from "@/lib/weavescope";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { ButtonLink } from "@/components/ui/button";
import { useSpeech } from "@/components/ai/use-voice";
import { LoomStage } from "./loom-stage";
import { ScopeFigure } from "./scope-figure";

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
 * thread by thread, and then explains what those threads cost.
 *
 * Three sections, deliberately: the loom, what the loom did, and why it costs
 * what it costs. Fibre morphology, the cotton-to-cloth chain and the behaviour
 * scores were all cut — each was interesting and none of them changed a
 * sourcing decision, which is the only test a section here has to pass.
 *
 * Two engineering calls worth knowing:
 *
 * 1. The loom is procedural, not a downloaded model. Warp count follows GSM,
 *    colour follows the colourway, and the interlacing follows this fabric's
 *    actual weave lift plan — so it runs for all 60 fabrics in the catalogue,
 *    ships no asset, and can never render the wrong cloth. three.js is loaded
 *    only on this route, only client-side, only once the stage is in view.
 *
 * 2. Every figure below the loom is derived from stored spec and carries an
 *    `estimated` label. A sourcing tool that presents a guess as a measurement
 *    is worse than one that shows nothing.
 */
export function WeaveScope({ product }: { product: ScopeProduct }) {
  const speech = useSpeech();
  const [narrating, setNarrating] = useState(false);

  const colour = product.colorways[0]?.hex ?? "#C9C2B4";
  const fibre = primaryFibre(product.fibres);
  const construction = deriveConstruction({ weave: product.weave, gsm: product.gsm, fibre });

  // Narration only ever reads facts that are also on the page.
  const script = [
    `${product.name}, from ${product.supplier.businessName}.`,
    `${product.composition}, ${product.gsm} grams per square metre, woven ${product.widthCm} centimetres wide.`,
    `The structure is a ${WEAVE_LABELS[product.weave].toLowerCase()} — ${construction.interlacing}.`,
    `We estimate ${construction.endsPerCm} warp ends and ${construction.picksPerCm} weft picks per centimetre, about ${construction.threadsPerInch} threads to the inch.`,
    `Each yarn carries roughly ${construction.fibresPerYarn} ${fibre.label.toLowerCase()} fibres.`,
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
          <ScopeFigure
            weave={product.weave}
            hex={colour}
            gsm={product.gsm}
            seed={product.id}
            magnify={3.4}
            alt={`${product.name} weave structure, enlarged`}
            caption={`${WEAVE_LABELS[product.weave]} · approx. ${construction.threadsPerInch} threads per inch`}
          />

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

      </Section>

      {/* ========================================================= PRICE */}
      <Section
        eyebrow="Why it costs what it costs"
        title={`${formatMoney(product.pricePerMetre)} a metre`}
        lede="Three things drive the cost: fibre, fineness and construction."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <PriceCard
            title="Fibre"
            body={`${product.composition}. ${
              fibre.key === "silk" || fibre.key === "zari"
                ? "A premium fibre with a long, manual preparation chain."
                : fibre.key === "linen"
                  ? "Flax needs retting and hackling before it can be spun."
                  : fibre.key === "wool"
                    ? "Fibre diameter in microns is the biggest driver of wool cost."
                    : fibre.staple
                      ? "A staple fibre, so it is carded, drawn and twisted before it becomes yarn."
                      : "A continuous filament, so it skips the spinning stages a staple fibre needs."
            }`}
          />
          {/* "Roughly" stays. Yarn count is derived, not measured, and every
              figure it appears next to is labelled estimated — stating it flat
              here would be the one place the page claims more than it knows. */}
          <PriceCard
            title="Fineness"
            body={`Spun at roughly ${construction.yarnTex} tex. Finer yarn requires more threads per inch and more precise weaving.`}
          />
          <PriceCard
            title="Structure"
            body={`${WEAVE_LABELS[product.weave]} construction, with ${construction.endsPerCm} warp ends and ${construction.picksPerCm} weft picks per centimetre.`}
          />
        </div>
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

          <h2 className="font-display mx-auto max-w-lg text-3xl leading-[1.1] font-medium text-balance text-ink sm:text-4xl">
            Ready to source {product.name}?
          </h2>
          <p className="mx-auto mt-4 font-mono text-[13.5px] text-muted tnum">
            {formatMoney(product.pricePerMetre)}/m · {formatNumber(product.moqMetres)}m minimum ·{" "}
            {product.leadTimeDays}-day lead time
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

function PriceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
