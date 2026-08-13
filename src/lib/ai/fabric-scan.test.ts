import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Swatch } from "@/lib/colour";

/**
 * Two rules these exist to protect.
 *
 * **An uncertain reading is displayed but never filtered on.** It is what stops
 * a soft visual impression from emptying the results grid, and it is invisible
 * in the UI when it works — exactly the kind of rule that rots silently.
 *
 * **The model reports; this code classifies.** The first version asked the
 * model to fill a ten-option weave enum and got `"plain"` for everything,
 * including a swatch with an obvious diagonal and including a control run with
 * no image attached. The prompt now asks binaries and `composeWeave` decides.
 * Keeping that decision in ordinary code is what makes it testable at all.
 *
 * The vision tier is mocked: these are about the mapping, not the model.
 * Whether gemma reads a real swatch correctly is a question for a live probe,
 * not a unit test — that would make the suite depend on a network and a GPU.
 */

const completeVision = vi.fn();
const visionAvailable = vi.fn(() => true);

vi.mock("@/lib/ai/provider", () => ({
  completeVision: (...args: unknown[]) => completeVision(...args),
  visionAvailable: () => visionAvailable(),
  visionLabel: () => "google/gemma-3-27b-it",
}));

const { scanFabric, relaxationLadder, chipsFor, parseBinaryReading, composeWeave } =
  await import("./fabric-scan");

const PALETTE: Swatch[] = [
  { name: "Optic White", hex: "#F7F5F0" },
  { name: "Ecru", hex: "#E7DECC" },
  { name: "Charcoal", hex: "#3A3A3C" },
  { name: "Navy", hex: "#1E2A44" },
];

/** Exactly Ecru, so the colour reading is confident and does produce a filter. */
const ECRU = { r: 231, g: 222, b: 204 };

/** The model's three lines: interlacing, sheen, density. */
function answers(...lines: string[]) {
  completeVision.mockResolvedValue({ content: lines.join("\n"), model: "google/gemma-3-27b-it" });
}

function scan(measured = ECRU) {
  return scanFabric({ imageDataUri: "data:image/webp;base64,AAAA", measured, palette: PALETTE });
}

function reading(result: Awaited<ReturnType<typeof scanFabric>>, key: string) {
  return result.readings.find((r) => r.key === key);
}

beforeEach(() => {
  completeVision.mockReset();
  visionAvailable.mockReturnValue(true);
});

describe("parseBinaryReading", () => {
  it("reads three clean lines", () => {
    expect(parseBinaryReading("grid\nmatte\ndense")).toEqual({
      interlacing: "grid",
      sheen: "matte",
      density: "dense",
    });
  });

  it("tolerates casing, numbering, punctuation and blank lines", () => {
    expect(parseBinaryReading("1. Diagonal\n\n2) GLOSSY.\n3 - open")).toEqual({
      interlacing: "diagonal",
      sheen: "glossy",
      density: "open",
    });
  });

  it("nulls a line that is not one of the two offered words", () => {
    // A model that answered something else has not answered. Coercing it would
    // be inventing a reading.
    expect(parseBinaryReading("herringbone\nmatte\ndense").interlacing).toBeNull();
    expect(parseBinaryReading("grid\nunsure\ndense").sheen).toBeNull();
  });

  it("nulls missing lines rather than shifting the others up", () => {
    expect(parseBinaryReading("grid")).toEqual({ interlacing: "grid", sheen: null, density: null });
  });

  it("returns all nulls for prose", () => {
    expect(parseBinaryReading("I'm sorry, I can't tell from this image.")).toEqual({
      interlacing: null,
      sheen: null,
      density: null,
    });
  });
});

describe("composeWeave", () => {
  const base = { interlacing: null, sheen: null, density: null } as const;

  it("reads a diagonal as twill regardless of sheen", () => {
    expect(composeWeave({ ...base, interlacing: "diagonal" })).toBe("TWILL");
    expect(composeWeave({ ...base, interlacing: "diagonal", sheen: "glossy" })).toBe("TWILL");
  });

  it("separates plain from satin on sheen", () => {
    expect(composeWeave({ ...base, interlacing: "grid", sheen: "matte" })).toBe("PLAIN");
    expect(composeWeave({ ...base, interlacing: "grid", sheen: "glossy" })).toBe("SATIN");
  });

  it("defaults a grid with no sheen answer to plain", () => {
    expect(composeWeave({ ...base, interlacing: "grid" })).toBe("PLAIN");
  });

  it("returns null when the interlacing question went unanswered", () => {
    // No weave filter at all, which the relaxation ladder copes with. Guessing
    // among ten weaves is the failure this design replaced.
    expect(composeWeave(base)).toBeNull();
    expect(composeWeave({ ...base, sheen: "glossy", density: "dense" })).toBeNull();
  });
});

describe("the uncertain-never-filters rule", () => {
  it("shows weight but does not let it narrow the catalogue", async () => {
    // "Open or dense" is a fair question to ask a photograph, but it is a proxy
    // for weight rather than a reading of it.
    answers("grid", "matte", "dense");
    const result = await scan();

    expect(reading(result, "weight")).toMatchObject({ certainty: "uncertain" });
    expect(result.filters.gsmMin).toBeUndefined();
    expect(result.filters.gsmMax).toBeUndefined();
  });

  it("does not filter on a colour that matched nothing close", async () => {
    answers("diagonal", "matte", "dense");
    // Hot magenta against a neutral palette: nearest swatch is far away.
    const result = await scan({ r: 255, g: 0, b: 200 });

    expect(reading(result, "colour")?.certainty).toBe("uncertain");
    expect(result.filters.q).toBeUndefined();
    // The weave still filters — one uncertain reading does not poison the rest.
    expect(result.filters.weave).toEqual(["TWILL"]);
  });

  it("keeps the uncertain reading visible rather than dropping it", async () => {
    answers("grid", "matte", "open");
    const result = await scan();

    expect(reading(result, "weight")).toBeDefined();
    expect(reading(result, "weight")?.note).toMatch(/not used to filter/i);
  });
});

describe("readings become ordinary filters", () => {
  it("maps a confident colour to the text query", async () => {
    answers("grid", "matte", "dense");
    const result = await scan();

    expect(reading(result, "colour")).toMatchObject({ value: "Ecru", certainty: "confident", source: "pixels" });
    expect(result.filters.q).toBe("Ecru");
  });

  it("maps a diagonal to the weave the marketplace uses", async () => {
    answers("diagonal", "matte", "dense");
    const result = await scan();

    expect(reading(result, "weave")?.value).toBe("Twill weave");
    expect(result.filters.weave).toEqual(["TWILL"]);
  });

  it("maps a glossy grid to satin", async () => {
    answers("grid", "glossy", "dense");
    expect((await scan()).filters.weave).toEqual(["SATIN"]);
  });

  it("builds a marketplace href from exactly those filters", async () => {
    answers("diagonal", "matte", "open");
    const result = await scan();

    const params = new URLSearchParams(result.href.split("?")[1]);
    expect(params.get("weave")).toBe("TWILL");
    expect(params.get("q")).toBe("Ecru");
    // Weight is uncertain, so it must not reach the URL.
    expect(params.get("gsmMax")).toBeNull();
  });

  it("carries the chips the marketplace would render", async () => {
    answers("grid", "glossy", "dense");
    const result = await scan();

    expect(result.chips.map((c) => c.label)).toContain("Weave: Satin");
  });

  it("shows the colour as a chip even though the marketplace does not", async () => {
    // `describeFilters` omits `q` because the marketplace renders it in the
    // search box. There is no search box here, so an invisible filter would be
    // narrowing results with nothing on screen to explain it.
    answers("grid", "matte", "dense");
    expect((await scan()).chips[0]).toMatchObject({ key: "q", label: "Colour: Ecru" });
  });

  it("has no colour chip when the colour was too uncertain to filter on", async () => {
    answers("grid", "matte", "dense");
    expect((await scan({ r: 255, g: 0, b: 200 })).chips.some((c) => c.key === "q")).toBe(false);
  });
});

describe("what the model is not allowed to assert", () => {
  it("claims no weave when the interlacing line was unusable", async () => {
    answers("herringbone", "matte", "dense");
    const result = await scan();

    expect(reading(result, "weave")).toBeUndefined();
    expect(result.filters.weave).toBeUndefined();
  });

  it("never reports a fibre", async () => {
    // Cotton, viscose and spun polyester are near identical in a photo, so the
    // question is not asked at all rather than asked and hedged.
    answers("grid", "matte", "dense");
    const result = await scan();

    expect(reading(result, "fibre")).toBeUndefined();
    expect(result.withheld.join(" ")).toMatch(/Fibre is not guessed here/);
  });

  it("never infers gsm, price or composition, and says so", async () => {
    answers("grid", "matte", "dense");
    const result = await scan();

    expect(result.withheld.join(" ")).toMatch(/GSM, composition and width/);
    expect(result.withheld.join(" ")).toMatch(/Price, lead time and certification/);
    expect(result.readings.some((r) => /\d+\s*gsm/i.test(r.value))).toBe(false);
  });
});

describe("the mock tier cannot reach production", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ignores FABRIC_SCAN_MOCK entirely when NODE_ENV is production", async () => {
    // The guard that matters. A deployment quietly serving canned readings
    // would be worse than one that fell back to colour, so the flag is not
    // merely defaulted off in production — it is unreadable there.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FABRIC_SCAN_MOCK", "1");
    answers("diagonal", "matte", "dense");

    const result = await scan();

    expect(completeVision).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("google/gemma-3-27b-it");
    expect(result.model).not.toBe("mock reading");
  });

  it("uses the mock in development when asked", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FABRIC_SCAN_MOCK", "1");
    vi.useFakeTimers();

    try {
      const pending = scan();
      // The mock holds long enough for the analysis overlay to play out.
      await vi.advanceTimersByTimeAsync(3000);
      const result = await pending;

      expect(completeVision).not.toHaveBeenCalled();
      expect(result.model).toBe("mock reading");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hits the real model when the flag is absent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FABRIC_SCAN_MOCK", "");
    answers("grid", "matte", "dense");

    const result = await scan();

    expect(completeVision).toHaveBeenCalledTimes(1);
    expect(result.model).toBe("google/gemma-3-27b-it");
  });
});

describe("the relaxation ladder", () => {
  const full = { q: "Ecru", weave: ["PLAIN"], gsmMin: 150, gsmMax: 280, perPage: 24, page: 1 };

  it("tries the full reading first", () => {
    expect(relaxationLadder(full)[0]).toEqual({ filters: full, relaxed: [] });
  });

  it("gives up weight, then colour, then weave", () => {
    // Weave is structural — a twill is not a substitute for a poplin whatever
    // colour it comes in — so it is the last thing surrendered.
    expect(relaxationLadder(full).map((r) => r.relaxed)).toEqual([
      [],
      ["weight"],
      ["weight", "colour"],
      ["weight", "colour", "weave"],
    ]);
  });

  it("actually removes the keys it claims to", () => {
    const [, noWeight, noColour, noWeave] = relaxationLadder(full);

    expect(noWeight!.filters.gsmMin).toBeUndefined();
    expect(noWeight!.filters.q).toBe("Ecru");
    expect(noColour!.filters.q).toBeUndefined();
    expect(noColour!.filters.weave).toEqual(["PLAIN"]);
    expect(noWeave!.filters.weave).toBeUndefined();
  });

  it("never mutates the filters it was handed", () => {
    const original = { ...full };
    relaxationLadder(full);
    expect(full).toEqual(original);
  });

  it("skips rungs for readings that were never made", () => {
    expect(relaxationLadder({ q: "Navy" }).map((r) => r.relaxed)).toEqual([[], ["colour"]]);
  });

  it("is a single rung when nothing could be read", () => {
    expect(relaxationLadder({})).toEqual([{ filters: {}, relaxed: [] }]);
  });

  it("bottoms out at a filter set that cannot come back empty-handed", () => {
    const ladder = relaxationLadder(full);
    const last = ladder[ladder.length - 1]!.filters;
    expect(last.q).toBeUndefined();
    expect(last.weave).toBeUndefined();
    expect(last.gsmMin).toBeUndefined();
    expect(last.gsmMax).toBeUndefined();
  });
});

describe("chipsFor", () => {
  it("puts the colour first, ahead of the structural filters", () => {
    expect(chipsFor({ q: "Ecru", weave: ["PLAIN"], gsmMax: 160 }).map((c) => c.key)).toEqual([
      "q",
      "weave",
      "gsmMax",
    ]);
  });

  it("omits the colour chip when there is no colour filter", () => {
    expect(chipsFor({ weave: ["PLAIN"] }).some((c) => c.key === "q")).toBe(false);
  });
});

describe("degrading when the model tier is gone", () => {
  it("still names the colour when there is no provider at all", async () => {
    visionAvailable.mockReturnValue(false);
    const result = await scan();

    expect(completeVision).not.toHaveBeenCalled();
    expect(result.mode).toBe("colour-only");
    expect(result.model).toBe("measured colour only");
    expect(result.filters.q).toBe("Ecru");
  });

  it("falls back to colour when the vision call fails", async () => {
    // Exhausted credits, a revoked token, a 500 and a timeout all arrive here
    // as null — the caller cannot tell them apart and does not need to.
    completeVision.mockResolvedValue(null);
    const result = await scan();

    expect(result.mode).toBe("colour-only");
    expect(reading(result, "colour")?.value).toBe("Ecru");
  });

  it("falls back to colour when the model answers with prose", async () => {
    completeVision.mockResolvedValue({ content: "I'm sorry, I can't tell.", model: "x" });
    const result = await scan();

    expect(result.mode).toBe("colour-only");
    expect(result.readings.map((r) => r.key)).toEqual(["colour"]);
  });

  it("keeps a partial answer when only some lines came back usable", async () => {
    answers("diagonal", "banana", "dense");
    const result = await scan();

    expect(result.mode).toBe("vision");
    expect(result.filters.weave).toEqual(["TWILL"]);
    expect(reading(result, "surface")).toBeUndefined();
    expect(reading(result, "weight")).toBeDefined();
  });

  it("reports an empty palette without crashing", async () => {
    answers("grid", "matte", "dense");
    const result = await scanFabric({
      imageDataUri: "data:image/webp;base64,AAAA",
      measured: ECRU,
      palette: [],
    });

    expect(reading(result, "colour")).toBeUndefined();
    expect(result.matchedHex).toBeNull();
    expect(result.measuredHex).toBe("#e7decc");
    expect(result.filters.weave).toEqual(["PLAIN"]);
  });
});
