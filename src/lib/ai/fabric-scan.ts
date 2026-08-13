import "server-only";

import { completeVision, visionAvailable, visionLabel } from "@/lib/ai/provider";
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
 * Three binary questions. Not a JSON schema, and not by preference.
 *
 * The first version of this asked the model to fill a ten-option weave enum in
 * one JSON object. It returned `"plain"` for everything — including a swatch
 * with an obvious diagonal wale, and including a control run **with no image
 * attached at all**, which is what gave the game away: the enum's leading
 * option was outscoring the photograph.
 *
 * The same model, asked one two-way question about the same two swatches, was
 * right 8 times out of 8. Asked to describe them in prose, right again. It sees
 * the cloth perfectly well; it just will not classify into a long list.
 *
 * So the prompt only ever asks binaries, and `composeWeave` does the
 * classifying in ordinary code that can be unit tested. The model reports what
 * it sees; deciding what that makes the fabric is not its job.
 *
 * Colour is absent for a different reason — it is measured from pixels, not
 * asked. See `scanFabric`.
 */
const SCAN_PROMPT = `Look only at this photograph of a textile swatch. Answer each question about THIS image.

1. Do the yarns form a square checkerboard grid, or diagonal lines running corner to corner?
2. Is the surface matte, or glossy with a sheen?
3. Does the cloth look open and light, or dense and heavy?

Reply with exactly three lines, one lowercase word each, no numbering:
grid or diagonal
matte or glossy
open or dense`;

export type BinaryReading = {
  interlacing: "grid" | "diagonal" | null;
  sheen: "matte" | "glossy" | null;
  density: "open" | "dense" | null;
};

/**
 * Three lines, one word each. Anything that is not one of the two offered words
 * becomes `null` rather than being coerced — a model that ignored the format
 * has not answered, and a missing reading is safer than an invented one.
 */
export function parseBinaryReading(raw: string): BinaryReading {
  const lines = raw
    .toLowerCase()
    .split(/\r?\n/)
    .map((line) => line.replace(/[^a-z]/g, ""))
    .filter(Boolean);

  const pick = <A extends string, B extends string>(line: string | undefined, a: A, b: B) =>
    line === a ? a : line === b ? b : null;

  return {
    interlacing: pick(lines[0], "grid", "diagonal"),
    sheen: pick(lines[1], "matte", "glossy"),
    density: pick(lines[2], "open", "dense"),
  };
}

/**
 * Binary answers → a catalogue weave, or nothing.
 *
 * Only the four weaves these questions can actually separate. Jacquard, dobby,
 * herringbone, rib, canvas and crepe all return `null`, which means no weave
 * filter at all — the honest outcome, and one the relaxation ladder already
 * copes with. Guessing between ten weaves is the exact failure this replaced.
 *
 * A fourth question — knitted or woven — was tried and dropped: it called the
 * twill swatch "knitted" while the interlacing question on the same request
 * correctly said "diagonal". One unreliable answer outranking a reliable one is
 * worse than not asking.
 */
export function composeWeave({ interlacing, sheen }: BinaryReading): string | null {
  if (interlacing === "diagonal") return "TWILL";
  if (interlacing !== "grid") return null;
  return sheen === "glossy" ? "SATIN" : "PLAIN";
}

/**
 * Same bands the typed parser uses for "lightweight" and "heavy".
 *
 * Held by value rather than shared with `nl-filters` because they are the same
 * numbers for a different reason — there they translate a word a buyer wrote,
 * here a judgement about a picture. If one moves, it does not follow that the
 * other should.
 */
const WEIGHT_BANDS = {
  light: { gsmMax: 160 },
  heavy: { gsmMin: 260 },
} as const;

const WITHHELD = [
  "GSM, composition and width are physical measurements — they come from the mill, not the photograph.",
  "Fibre is not guessed here: cotton, viscose and spun polyester are near identical in a photo. The mill's spec sheet has it.",
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

/* ── mock tier ───────────────────────────────────────────────────────────── */

/**
 * Work on the interface without spending inference.
 *
 * Only the model call is faked. The colour is still measured from the real
 * pixels, `composeWeave` still classifies, the relaxation ladder still runs and
 * the catalogue is still searched — so what you are looking at is the real
 * pipeline with one network call removed, not a screenshot.
 *
 *   FABRIC_SCAN_MOCK=1            a canned reading, varying by photo
 *   FABRIC_SCAN_MOCK=colour-only  the model tier "fails", to design the fallback
 *
 * **Ignored in production, unconditionally.** A demo that quietly served canned
 * readings would be worse than one that fell back to colour, so the env var
 * cannot reach the deployment even if it is set there by accident.
 */
type MockMode = "off" | "vision" | "colour-only";

const MOCK_LATENCY_MS = 2600;

function mockMode(): MockMode {
  if (process.env.NODE_ENV === "production") return "off";

  const raw = process.env.FABRIC_SCAN_MOCK?.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "off") return "off";
  if (raw === "fail" || raw === "colour-only") return "colour-only";
  return "vision";
}

/**
 * Different photos give different weaves, keyed off the measured colour.
 *
 * A single hardcoded answer would have made every scan render the same card,
 * which is exactly the state a UI pass needs to avoid — plain, twill and satin
 * lay out differently and reach different corners of the catalogue.
 */
function mockAnswer(measured: Rgb): string {
  const answers = [
    "grid\nmatte\ndense", // → PLAIN
    "diagonal\nmatte\nopen", // → TWILL
    "grid\nglossy\ndense", // → SATIN
  ];
  return answers[(measured.r + measured.g + measured.b) % answers.length]!;
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
  const mock = mockMode();

  if (mock !== "off" || visionAvailable()) {
    let raw: string | null;

    if (mock !== "off") {
      // Held long enough for all three captions of the analysis overlay to
      // play, so the wait can be designed against something honest.
      await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
      raw = mock === "colour-only" ? null : mockAnswer(measured);
    } else {
      // 24 tokens: three one-word lines and nothing else. A tight ceiling is
      // part of the format — there is no room to drift into prose.
      const result = await completeVision({ prompt: SCAN_PROMPT, imageDataUri, maxTokens: 24 });
      raw = result?.content ?? null;
    }

    const answers = raw !== null ? parseBinaryReading(raw) : null;

    // At least one question has to have been answered in the offered form.
    // Three nulls means the model replied with something else entirely, which
    // is a miss, not a reading.
    if (answers && (answers.interlacing || answers.sheen || answers.density)) {
      mode = "vision";

      const weave = composeWeave(answers);
      if (weave) {
        readings.push({
          key: "weave",
          label: "Weave",
          value: `${titleCase(weave.toLowerCase())} weave`,
          // 8/8 on the two swatches it was tuned against, which is what earns
          // "likely" and the right to filter. See docs/07_fabric_scan.md.
          certainty: "likely",
          source: "model",
        });
      }

      if (answers.density) {
        readings.push({
          key: "weight",
          label: "Weight",
          value: answers.density === "open" ? "Light and open" : "Dense",
          // Deliberately never better than uncertain. "Open or dense" is a
          // reasonable question to ask a photograph, but it is a proxy for
          // weight rather than a reading of it, and both test swatches came
          // back "dense" — not enough evidence to let it narrow the catalogue.
          certainty: "uncertain",
          source: "model",
          note: "A visual impression, not a measurement. Not used to filter.",
        });
      }

      if (answers.sheen) {
        readings.push({
          key: "surface",
          label: "Surface",
          value: answers.sheen === "glossy" ? "Glossy, with sheen" : "Matte",
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
    // Never claim a model answered when it did not. The page prints this, and
    // a mocked run showing "google/gemma-3-27b-it" would be a lie told to the
    // person building against it.
    model:
      mode === "vision" ? (mock === "off" ? visionLabel() : "mock reading") : "measured colour only",
    measuredHex: rgbToHex(measured),
    matchedHex: swatch?.hex ?? null,
    withheld: WITHHELD,
  };
}
