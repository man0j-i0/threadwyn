import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Swatch } from "@/lib/colour";

/**
 * The rule these exist to protect: **an uncertain reading is displayed but
 * never filtered on.**
 *
 * It is what stops one shaky fibre guess from emptying the results grid, and
 * it is the difference between "here is what I think I see" and "I have hidden
 * everything that disagrees with what I think I see". It is also invisible in
 * the UI when it works, which is exactly the kind of rule that rots silently.
 *
 * The vision tier is mocked because these are about the mapping, not the model.
 * Whether gemma reads a swatch correctly is a question for `ai:check`, not a
 * unit test — it would make the suite depend on a network and a GPU.
 */

const completeVision = vi.fn();
const visionAvailable = vi.fn(() => true);

vi.mock("@/lib/ai/provider", async () => {
  // parseJsonLoose is real: how tolerantly we parse a model's output is part of
  // what is under test, and reimplementing it here would test the copy.
  const actual = await vi.importActual<typeof import("@/lib/ai/provider")>("@/lib/ai/provider");
  return {
    parseJsonLoose: actual.parseJsonLoose,
    completeVision: (...args: unknown[]) => completeVision(...args),
    visionAvailable: () => visionAvailable(),
    visionLabel: () => "google/gemma-3-27b-it",
  };
});

const { scanFabric, relaxationLadder, chipsFor } = await import("./fabric-scan");

const PALETTE: Swatch[] = [
  { name: "Optic White", hex: "#F7F5F0" },
  { name: "Ecru", hex: "#E7DECC" },
  { name: "Charcoal", hex: "#3A3A3C" },
  { name: "Navy", hex: "#1E2A44" },
];

/** Exactly Ecru, so the colour reading is confident and does produce a filter. */
const ECRU = { r: 231, g: 222, b: 204 };

function answers(json: unknown) {
  completeVision.mockResolvedValue({ content: JSON.stringify(json), model: "google/gemma-3-27b-it" });
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

describe("the uncertain-never-filters rule", () => {
  it("shows a likely fibre but does not filter on it", async () => {
    answers({ weave: "plain", weight: "light", fibre: "cotton", surface: "smooth matte" });
    const result = await scan();

    expect(reading(result, "fibre")).toMatchObject({ value: "Cotton", certainty: "uncertain" });
    expect(result.filters.fibre).toBeUndefined();
    expect(result.href).not.toContain("fibre=");
  });

  it("does not filter on a colour that matched nothing close", async () => {
    answers({ weave: "twill" });
    // Hot magenta against a neutral palette: nearest swatch is far away.
    const result = await scan({ r: 255, g: 0, b: 200 });

    expect(reading(result, "colour")?.certainty).toBe("uncertain");
    expect(result.filters.q).toBeUndefined();
    // The weave still filters — one uncertain reading does not poison the rest.
    expect(result.filters.weave).toEqual(["TWILL"]);
  });

  it("keeps the uncertain reading visible rather than dropping it", async () => {
    answers({ fibre: "viscose" });
    const result = await scan();

    expect(reading(result, "fibre")).toBeDefined();
    expect(reading(result, "fibre")?.note).toMatch(/not used to filter/i);
  });
});

describe("readings become ordinary filters", () => {
  it("maps a confident colour to the text query", async () => {
    answers({});
    const result = await scan();

    expect(reading(result, "colour")).toMatchObject({ value: "Ecru", certainty: "confident", source: "pixels" });
    expect(result.filters.q).toBe("Ecru");
  });

  it("maps weave to the enum the marketplace uses", async () => {
    answers({ weave: "herringbone" });
    const result = await scan();

    expect(reading(result, "weave")?.value).toBe("Herringbone weave");
    expect(result.filters.weave).toEqual(["HERRINGBONE"]);
  });

  it('tolerates the model answering "plain weave" instead of "plain"', async () => {
    answers({ weave: "plain weave" });
    expect((await scan()).filters.weave).toEqual(["PLAIN"]);
  });

  it.each([
    ["light", { gsmMax: 160, gsmMin: undefined }],
    ["heavy", { gsmMin: 260, gsmMax: undefined }],
    ["medium", { gsmMin: 150, gsmMax: 280 }],
  ])("maps %s weight to a gsm band", async (weight, expected) => {
    answers({ weight });
    const result = await scan();

    expect(result.filters.gsmMin).toBe(expected.gsmMin);
    expect(result.filters.gsmMax).toBe(expected.gsmMax);
  });

  it("builds a marketplace href from exactly those filters", async () => {
    answers({ weave: "plain", weight: "light" });
    const result = await scan();

    expect(result.href).toMatch(/^\/marketplace\?/);
    const params = new URLSearchParams(result.href.split("?")[1]);
    expect(params.get("weave")).toBe("PLAIN");
    expect(params.get("gsmMax")).toBe("160");
    expect(params.get("q")).toBe("Ecru");
  });

  it("carries the chips the marketplace would render", async () => {
    answers({ weave: "satin" });
    const result = await scan();

    expect(result.chips.map((c) => c.label)).toContain("Weave: Satin");
  });

  it("shows the colour as a chip even though the marketplace does not", async () => {
    // `describeFilters` omits `q` because the marketplace renders it in the
    // search box. There is no search box here, so an invisible filter would be
    // narrowing results with nothing on screen to explain it.
    answers({ weave: "satin" });
    const result = await scan();

    expect(result.chips[0]).toMatchObject({ key: "q", label: "Colour: Ecru" });
  });

  it("has no colour chip when the colour was too uncertain to filter on", async () => {
    answers({ weave: "satin" });
    const result = await scan({ r: 255, g: 0, b: 200 });

    expect(result.chips.some((c) => c.key === "q")).toBe(false);
  });
});

describe("what the model is not allowed to assert", () => {
  it('drops fields answered "unknown"', async () => {
    answers({ weave: "unknown", weight: "unknown", fibre: "unknown", surface: "unknown" });
    const result = await scan();

    expect(result.readings.map((r) => r.key)).toEqual(["colour"]);
    expect(result.filters.weave).toBeUndefined();
  });

  it("ignores a weave that is not in the catalogue's enum", async () => {
    answers({ weave: "gauze" });
    const result = await scan();

    expect(reading(result, "weave")).toBeUndefined();
    expect(result.filters.weave).toBeUndefined();
  });

  it("ignores a fibre outside the known list", async () => {
    answers({ fibre: "unobtainium" });
    expect(reading(await scan(), "fibre")).toBeUndefined();
  });

  it("never infers gsm, price or composition, and says so", async () => {
    answers({ weave: "plain", weight: "light", fibre: "cotton" });
    const result = await scan();

    expect(result.withheld.join(" ")).toMatch(/GSM, composition and width/);
    expect(result.withheld.join(" ")).toMatch(/Price, lead time and certification/);
    // The gsm filter is a band inferred from "light", never a claimed value.
    expect(result.readings.some((r) => /\d+\s*gsm/i.test(r.value))).toBe(false);
  });
});

describe("the relaxation ladder", () => {
  const full = { q: "Ecru", weave: ["PLAIN"], gsmMin: 150, gsmMax: 280, perPage: 24, page: 1 };

  it("tries the full reading first", () => {
    const ladder = relaxationLadder(full);
    expect(ladder[0]).toEqual({ filters: full, relaxed: [] });
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
    // Colour-only scan: there is no weight or weave to give up, so the ladder
    // is the full set and then nothing at all.
    expect(relaxationLadder({ q: "Navy" }).map((r) => r.relaxed)).toEqual([[], ["colour"]]);
  });

  it("is a single rung when nothing could be read", () => {
    expect(relaxationLadder({})).toEqual([{ filters: {}, relaxed: [] }]);
  });

  it("bottoms out at a filter set that cannot be empty-handed", () => {
    const ladder = relaxationLadder(full);
    const last = ladder[ladder.length - 1]!.filters;
    // Whatever is left must not constrain the catalogue at all, or the ladder
    // could still end on an empty grid.
    expect(last.q).toBeUndefined();
    expect(last.weave).toBeUndefined();
    expect(last.gsmMin).toBeUndefined();
    expect(last.gsmMax).toBeUndefined();
  });
});

describe("chipsFor", () => {
  it("puts the colour first, ahead of the structural filters", () => {
    const chips = chipsFor({ q: "Ecru", weave: ["PLAIN"], gsmMax: 160 });
    expect(chips.map((c) => c.key)).toEqual(["q", "weave", "gsmMax"]);
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
    completeVision.mockResolvedValue(null);
    const result = await scan();

    expect(result.mode).toBe("colour-only");
    expect(reading(result, "colour")?.value).toBe("Ecru");
  });

  it("falls back to colour when the model answers with prose instead of JSON", async () => {
    completeVision.mockResolvedValue({ content: "I'm sorry, I can't tell.", model: "x" });
    const result = await scan();

    expect(result.mode).toBe("colour-only");
    expect(result.readings.map((r) => r.key)).toEqual(["colour"]);
  });

  it("recovers JSON the model wrapped in a code fence", async () => {
    completeVision.mockResolvedValue({
      content: '```json\n{"weave":"twill","weight":"heavy"}\n```',
      model: "x",
    });
    const result = await scan();

    expect(result.mode).toBe("vision");
    expect(result.filters.weave).toEqual(["TWILL"]);
    expect(result.filters.gsmMin).toBe(260);
  });

  it("reports an empty palette without crashing", async () => {
    answers({ weave: "plain" });
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
