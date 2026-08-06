"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { FabricSwatch } from "@/components/product/fabric-swatch";
import { WEAVE_LABELS, type WeaveKey } from "@/lib/weave";

/**
 * What each category is actually made of.
 *
 * The grid represents cloth with a 10px coloured dot, on a site whose whole
 * argument is that it renders real construction. Every category here has a
 * defining structure, so hovering shows that structure instead: a herringbone
 * is not a twill is not a satin, and at card size you can see the difference.
 * Weight matters too, because it drives the yarn diameter the renderer draws,
 * which is why a 45 gsm voile and a 480 gsm canvas do not come out looking like
 * the same cloth in two colours.
 *
 * Colour comes from the category's own `accentHex`, promoted from decoration to
 * the dyed colour of the cloth.
 */
const MATERIAL: Record<string, { weave: WeaveKey; gsm: number }> = {
  shirting: { weave: "PLAIN", gsm: 120 },
  suiting: { weave: "TWILL", gsm: 260 },
  denim: { weave: "TWILL", gsm: 400 },
  linen: { weave: "PLAIN", gsm: 165 },
  "silk-satin": { weave: "SATIN", gsm: 70 },
  "knits-jersey": { weave: "JERSEY", gsm: 180 },
  performance: { weave: "DOBBY", gsm: 150 },
  "handloom-khadi": { weave: "PLAIN", gsm: 200 },
  upholstery: { weave: "JACQUARD", gsm: 420 },
  "canvas-workwear": { weave: "CANVAS", gsm: 480 },
  lining: { weave: "SATIN", gsm: 60 },
  "sheers-voile": { weave: "PLAIN", gsm: 45 },
};

const FALLBACK = { weave: "PLAIN" as WeaveKey, gsm: 160 };

/**
 * One duration and one curve for everything that moves on this card.
 *
 * The cloth, the scrim, the accent dot and all three text colours change
 * together. Staggering them made the card feel like several things reacting
 * separately rather than one surface changing state.
 *
 * easeOutCubic rather than the exponential used elsewhere in the app:
 * ease-out-expo front-loads almost all of its travel into the first few frames,
 * which reads as a snap on a property as gentle as opacity. This curve arrives
 * just as calmly but starts moving at a believable speed.
 */
const EASE = [0.33, 1, 0.68, 1] as const;
const DURATION = 0.42;

export type CategoryCardData = {
  slug: string;
  name: string;
  blurb: string | null;
  accentHex: string;
  count: number;
};

export function CategoryCard({ category }: { category: CategoryCardData }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  // Mounted on first interaction, so a grid of twelve does not paint twelve
  // feTurbulence filters before anyone has asked for one. It stays mounted
  // afterwards; remounting on every pointer entry would be worse than the
  // filter it saves.
  const [everOpened, setEverOpened] = useState(false);

  const material = MATERIAL[category.slug] ?? FALLBACK;

  function reveal(next: boolean) {
    if (next) setEverOpened(true);
    setOpen(next);
  }

  return (
    <Link
      href={`/marketplace?category=${category.slug}`}
      onMouseEnter={() => reveal(true)}
      onMouseLeave={() => reveal(false)}
      onFocus={() => reveal(true)}
      onBlur={() => reveal(false)}
      className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-5 transition-[border-color,box-shadow,transform] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-md)]"
    >
      {/* The material, resolving in place rather than sliding up from the foot
          of the card.

          A wipe has to travel to and from somewhere just off the edge, and that
          edge is where it went wrong: parked at exactly 100% the panel's top
          landed on the card's bottom and sub-pixel rounding left a hairline of
          fabric showing, while a spring overshot the park position on the way
          out and flashed the same line. A cross-fade has no offscreen position
          to be imprecise about. It is also the cheaper of the two, since
          opacity composites on the GPU and a transform on a filtered SVG does
          not. */}
      {everOpened ? (
        <motion.div
          aria-hidden
          // An explicit `initial` rather than `false`.
          //
          // This element mounts on the very first hover, at which point `open`
          // is already true. With `initial={false}` Motion writes the animate
          // value straight to the DOM on mount, so the first reveal appeared
          // fully formed with no transition while every later one faded
          // correctly. Starting it transparent means the first hover behaves
          // like the rest.
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 1 : 0 }}
          transition={reduced ? { duration: 0.15 } : { duration: DURATION, ease: EASE }}
          // Keeps this card's filter raster from invalidating its neighbours'.
          style={{ contain: "paint" }}
          className="pointer-events-none absolute inset-0"
        >
          <FabricSwatch
            weave={material.weave}
            hex={category.accentHex}
            gsm={material.gsm}
            seed={category.slug}
            alt=""
            drape={false}
            magnify={1.7}
            className="size-full"
          />
          {/* Type has to stay readable over an arbitrary dyed colour, so the
              cloth gets a scrim rather than the type getting a shadow. */}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(25,23,19,0.92),rgba(25,23,19,0.55))]" />
        </motion.div>
      ) : null}

      {/* Resting state only: once the cloth is up it covers this anyway. */}
      <span
        aria-hidden
        className="absolute -top-10 -right-10 size-28 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-500 group-hover:opacity-25"
        style={{ backgroundColor: category.accentHex }}
      />

      <span
        aria-hidden
        className="relative size-2.5 rounded-full transition-opacity duration-[420ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
        style={{ backgroundColor: category.accentHex, opacity: open ? 0 : 1 }}
      />

      <h3
        className="relative mt-4 text-[15px] font-medium transition-colors duration-[420ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
        // Both ends stated inline so the colour interpolates. Swapping a
        // `text-ink` class on a child instead left the parent's
        // `transition-colors` with nothing to animate, and the type snapped
        // from dark to white while the cloth behind it faded.
        style={{ color: open ? "#ffffff" : "var(--ink)" }}
      >
        {category.name}
      </h3>

      <p
        className="relative mt-1.5 flex-1 text-[12.5px] leading-relaxed transition-colors duration-[420ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
        style={{ color: open ? "rgba(255,255,255,0.78)" : "var(--ink-subtle)" }}
      >
        {category.blurb}
      </p>

      <p
        className="relative mt-4 flex items-baseline justify-between gap-3 font-mono text-[11px] transition-colors duration-[420ms] ease-[cubic-bezier(0.33,1,0.68,1)] tnum"
        style={{ color: open ? "rgba(255,255,255,0.78)" : "var(--ink-subtle)" }}
      >
        <span>
          {category.count} {category.count === 1 ? "fabric" : "fabrics"}
        </span>
        {/* The construction, named. Only appears with the cloth it describes. */}
        <span
          className="truncate transition-opacity duration-[420ms] ease-[cubic-bezier(0.33,1,0.68,1)]"
          style={{ opacity: open ? 1 : 0 }}
        >
          {WEAVE_LABELS[material.weave]}
        </span>
      </p>
    </Link>
  );
}
