import "server-only";

import { z } from "zod";

import { completeVision, parseJsonLoose, visionAvailable, visionLabel } from "@/lib/ai/provider";
import { describeFilters } from "@/lib/ai/nl-filters";
import { filtersToParams } from "@/lib/marketplace-params";
import { colourCertainty, nearestSwatch, rgbToHex, type Rgb, type Swatch } from "@/lib/colour";
import type { ProductFilters } from "@/server/services/product-service";

/**
 * Fabric scan: a photograph becomes the same `ProductFilters` a click would.
 *
 * The point of this file is that it produces *nothing new*. A scan resolves to
 * an ordinary filter set and an ordinary `/marketplace` URL, so a result found
 * by photo is the same object as a result found by typing, is editable in the
 * same chips, and cannot surface a fabric the normal search would hide.
 *
 * Two tiers, as everywhere else in this app:
 *
 *   pixels  the browser measures a dominant colour; we name it against the
 *           colourways suppliers actually listed. No model, no network, always
 *           available — this is the floor.
 *   model   a vision model adds weave, weight and a likely fibre.
 *
 * There is no regex that reads a photograph, so if the model tier is down the
 * scan degrades to the colour tier rather than failing. That is the whole
 * reason the colour is measured in the browser instead of being asked of the
 * model, and it is also just the better answer: pixels beat inference at
 * naming a colour.
 */

export type Certainty = "confident" | "likely" | "uncertain";

export type ScanReading = {
  key: "colour" | "weave" | "weight" | "fibre" | "surface";
  label: string;
  value: string;
  certainty: Certainty;
  /** What produced this reading, shown so the buyer can weigh it. */
  source: "pixels" | "model";
  /** Present when the reading is displayed but deliberately not filtered on. */
  note?: string;
};

export type FabricScan = {
  readings: ScanReading[];
  filters: ProductFilters;
  chips: { key: string; label: string; value: string }[];
  href: string;
  /** `vision` when a model answered, `colour-only` when it did not. */
  mode: "vision" | "colour-only";
  model: string;
  /** The dominant colour the browser measured, so the UI can show the pixel. */
  measuredHex: string;
  /** The catalogue colourway it was matched to, for the side-by-side. */
  matchedHex: string | null;
  /** Specifications a photograph cannot establish. Rendered as a caveat. */
  withheld: string[];
};

/**
 * Colour is absent from this prompt on purpose — it is measured, not asked.
 *
 * Everything requested here is structure the camera can genuinely resolve.
 * "unknown" is offered explicitly for each field because a model given only
 * valid-looking options will pick one, and a confident wrong weave is worse
 * than an admitted gap.
 */
const SCAN_PROMPT = `You are looking at a close-up photograph of a textile swatch.

Report only what is visibly present. If the photograph does not show enough to tell, answer "unknown" — do not guess.

Reply with JSON only. No prose, no code fence.

{"weave":"plain|twill|satin|jacquard|herringbone|jersey|rib|dobby|canvas|crepe|unknown","weight":"light|medium|heavy|unknown","fibre":"cotton|linen|silk|wool|polyester|viscose|nylon|unknown","surface":"two or three words for the hand, e.g. smooth matte, crisp dry, soft brushed"}

weave    the interlacing pattern you can see between the yarns
weight   light if open and sheer, heavy if dense and thick
fibre    your best reading of the fibre, or "unknown"
surface  how the cloth would feel, judged from sheen and texture`;

const modelReading = z.object({
  weave: z.string().optional(),
  weight: z.string().optional(),
  fibre: z.string().optional(),
  surface: z.string().optional(),
});

const WEAVES = new Set([
  "PLAIN",
  "TWILL",
  "SATIN",
  "JACQUARD",
  "HERRINGBONE",
  "JERSEY",
  "RIB",
  "DOBBY",
  "CANVAS",
  "CREPE",
]);

const FIBRES = new Set([
  "cotton",
  "linen",
  "silk",
  "wool",
  "polyester",
  "viscose",
  "elastane",
  "nylon",
  "cupro",
]);

/**
 * Same bands the typed parser uses for "lightweight" and "heavy".
 *
 * Imported by value rather than shared with `nl-filters` because they are the
 * same numbers for a different reason — there they translate a word a buyer
 * wrote, here they translate a judgement about a picture. If one moves, it does
 * not follow that the other should.
 */
const WEIGHT_BANDS = {
  light: { gsmMax: 160 },
  medium: { gsmMin: 150, gsmMax: 280 },
  heavy: { gsmMin: 260 },
} as const;

const WITHHELD = [
  "GSM, composition and width are physical measurements — they come from the mill, not the photograph.",
  "Price, lead time and certification are supplier data.",
];

/**
 * Progressively looser filter sets, best first.
 *
 * A scan that ANDs colour, weave and a weight band against a catalogue this
 * size returns nothing far more often than it returns something — the first
 * real photo tried here read correctly as ecru plain-weave midweight and
 * matched zero fabrics. An empty grid is the wrong answer to "find me cloth
 * like this": the buyer wants the closest thing that exists, and being told
 * what had to give is more useful than being told nothing matched.
 *
 * Dropped in order of how much each reading is worth keeping:
 *
 *   weight  a band inferred from how open the cloth looks — the softest of the
 *           three, and the one that excludes the most rows
 *   colour  a real measurement, but the same fabric usually exists in other
 *           colourways, so it is a preference rather than a constraint
 *   weave   structural, and the last thing to give up: a twill is not a
 *           substitute for a poplin whatever colour it comes in
 *
 * The caller walks this until a query returns rows.
 */
/**
 * Chips for a filter set, including one for the colour.
 *
 * `describeFilters` leaves `q` out on purpose — on the marketplace the text
 * query lives in the search box, so a chip for it would be a second control for
 * one value. There is no search box on the scan page, and the colour genuinely
 * is narrowing the results, so it has to be visible. Added here rather than in
 * `describeFilters`, which every other surface shares.
 */
export function chipsFor(filters: ProductFilters): { key: string; label: string; value: string }[] {
  const chips = describeFilters(filters).map((c) => ({
    key: String(c.key),
    label: c.label,
    value: c.value,
  }));

  if (filters.q) chips.unshift({ key: "q", label: `Colour: ${filters.q}`, value: filters.q });
  return chips;
}

export function hrefFor(filters: ProductFilters): string {
  const query = filtersToParams(filters).toString();
  return `/marketplace${query ? `?${query}` : ""}`;
}

export function relaxationLadder(filters: ProductFilters): { filters: ProductFilters; relaxed: string[] }[] {
  const drop = (keys: (keyof ProductFilters)[]): ProductFilters => {
    const next = { ...filters };
    for (const key of keys) delete next[key];
    return next;
  };

  const ladder: { filters: ProductFilters; relaxed: string[] }[] = [{ filters, relaxed: [] }];

  const hasWeight = filters.gsmMin != null || filters.gsmMax != null;
  const hasColour = Boolean(filters.q);
  const hasWeave = Boolean(filters.weave?.length);

  if (hasWeight) ladder.push({ filters: drop(["gsmMin", "gsmMax"]), relaxed: ["weight"] });
  if (hasColour) {
    ladder.push({ filters: drop(["gsmMin", "gsmMax", "q"]), relaxed: [...(hasWeight ? ["weight"] : []), "colour"] });
  }
  if (hasWeave) {
    ladder.push({
      filters: drop(["gsmMin", "gsmMax", "q", "weave"]),
      relaxed: [...(hasWeight ? ["weight"] : []), ...(hasColour ? ["colour"] : []), "weave"],
    });
  }

  return ladder;
}

function clean(value: string | undefined): string | null {
  const v = value?.trim().toLowerCase();
  if (!v || v === "unknown" || v === "n/a" || v === "none") return null;
  return v;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Read a swatch.
 *
 * `measured` is the dominant colour the browser computed. `palette` is the set
 * of colourways currently listed. Neither the image nor the colour is stored.
 */
export async function scanFabric(opts: {
  imageDataUri: string;
  measured: Rgb;
  palette: readonly Swatch[];
}): Promise<FabricScan> {
  const { imageDataUri, measured, palette } = opts;

  const readings: ScanReading[] = [];
  const filters: ProductFilters = { perPage: 24, page: 1 };

  /* ── tier 1: pixels ──────────────────────────────────────────────────── */

  const swatch = nearestSwatch(measured, palette);
  if (swatch) {
    readings.push({
      key: "colour",
      label: "Colour",
      value: swatch.name,
      certainty: colourCertainty(swatch.distance),
      source: "pixels",
      note: "Measured from the image and matched to the nearest colourway in stock.",
    });
  }

  /* ── tier 2: the model ───────────────────────────────────────────────── */

  let mode: FabricScan["mode"] = "colour-only";

  if (visionAvailable()) {
    const result = await completeVision({ prompt: SCAN_PROMPT, imageDataUri, maxTokens: 200 });
    const raw = result ? parseJsonLoose<unknown>(result.content) : null;
    const parsed = raw ? modelReading.safeParse(raw) : null;

    if (parsed?.success) {
      mode = "vision";
      const { weave, weight, fibre, surface } = parsed.data;

      const weaveValue = clean(weave)?.replace(/\s*weave$/, "").toUpperCase();
      if (weaveValue && WEAVES.has(weaveValue)) {
        readings.push({
          key: "weave",
          label: "Weave",
          value: `${titleCase(weaveValue.toLowerCase())} weave`,
          certainty: "likely",
          source: "model",
        });
      }

      const weightValue = clean(weight);
      if (weightValue && weightValue in WEIGHT_BANDS) {
        readings.push({
          key: "weight",
          label: "Weight",
          value: titleCase(weightValue),
          certainty: "likely",
          source: "model",
        });
      }

      const fibreValue = clean(fibre);
      if (fibreValue && FIBRES.has(fibreValue)) {
        readings.push({
          key: "fibre",
          label: "Likely fibre",
          value: titleCase(fibreValue),
          // Never better than uncertain, whatever the model sounds like. Cotton,
          // viscose and spun polyester are close to indistinguishable in a
          // photograph — the difference is a burn test or a lab, not a camera.
          certainty: "uncertain",
          source: "model",
          note: "Not used to filter. Confirm the composition with the mill.",
        });
      }

      const surfaceValue = clean(surface);
      if (surfaceValue) {
        readings.push({
          key: "surface",
          label: "Surface",
          value: titleCase(surfaceValue.slice(0, 40)),
          certainty: "likely",
          source: "model",
          note: "Descriptive only.",
        });
      }
    }
  }

  /* ── readings → filters ──────────────────────────────────────────────── */

  // One rule, applied uniformly: an uncertain reading is shown but never
  // filtered on. It is the difference between "here is what I think I see" and
  // "I have hidden everything that disagrees with what I think I see" — and it
  // stops one shaky fibre guess from emptying the grid.
  for (const reading of readings) {
    if (reading.certainty === "uncertain") continue;

    switch (reading.key) {
      case "colour":
        filters.q = reading.value;
        break;
      case "weave":
        filters.weave = [reading.value.replace(/\s*weave$/i, "").toUpperCase()];
        break;
      case "weight": {
        const band = WEIGHT_BANDS[reading.value.toLowerCase() as keyof typeof WEIGHT_BANDS];
        if (band) Object.assign(filters, band);
        break;
      }
      case "fibre":
      case "surface":
        break;
    }
  }

  return {
    readings,
    filters,
    chips: chipsFor(filters),
    href: hrefFor(filters),
    mode,
    model: mode === "vision" ? visionLabel() : "measured colour only",
    measuredHex: rgbToHex(measured),
    matchedHex: swatch?.hex ?? null,
    withheld: WITHHELD,
  };
}
