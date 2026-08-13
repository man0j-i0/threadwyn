import { describe, expect, it } from "vitest";

import {
  colourCertainty,
  colourDistance,
  hexToRgb,
  litDistance,
  nearestSwatch,
  rgbToHex,
  type Swatch,
} from "./colour";

/**
 * These cover the half of the fabric scan that runs without a model.
 *
 * That is the half worth pinning: the vision tier can be swapped or go down,
 * but a photo always has pixels, and this is what turns them into a colourway
 * name the catalogue can be searched for.
 */

/**
 * A slice of the real seeded palette.
 *
 * Silver Grey and Powder Blue earn their place: they are the two swatches a
 * shaded warm cloth used to be misnamed as, so a regression here has something
 * wrong to find.
 */
const PALETTE: Swatch[] = [
  { name: "Optic White", hex: "#F7F5F0" },
  { name: "Ecru", hex: "#E7DECC" },
  { name: "Natural", hex: "#DDD3C0" },
  { name: "Silver Grey", hex: "#B7B8B5" },
  { name: "Powder Blue", hex: "#BDCEDA" },
  { name: "Charcoal", hex: "#3A3A3C" },
  { name: "Navy", hex: "#1E2A44" },
  { name: "Terracotta", hex: "#B0603F" },
  { name: "Sage", hex: "#9BA88C" },
];

/** The warm neutrals, any of which is a fair name for undyed cotton. */
const WARM_NEUTRALS = ["Ecru", "Natural", "Optic White"];

describe("hexToRgb", () => {
  it("parses six-digit hex with and without a hash", () => {
    expect(hexToRgb("#E7DECC")).toEqual({ r: 231, g: 222, b: 204 });
    expect(hexToRgb("E7DECC")).toEqual({ r: 231, g: 222, b: 204 });
  });

  it("expands shorthand", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#08f")).toEqual({ r: 0, g: 136, b: 255 });
  });

  it("is case insensitive", () => {
    expect(hexToRgb("#e7decc")).toEqual(hexToRgb("#E7DECC"));
  });

  it("returns null rather than throwing on junk", () => {
    // A supplier can type anything into a colourway hex. A bad row must skip,
    // not take the whole scan down.
    expect(hexToRgb("")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
    expect(hexToRgb("rebeccapurple")).toBeNull();
    expect(hexToRgb("#GGGGGG")).toBeNull();
  });
});

describe("colourDistance", () => {
  it("is zero for identical colours", () => {
    expect(colourDistance({ r: 120, g: 80, b: 40 }, { r: 120, g: 80, b: 40 })).toBe(0);
  });

  it("is symmetric", () => {
    const a = { r: 231, g: 222, b: 204 };
    const b = { r: 58, g: 58, b: 60 };
    expect(colourDistance(a, b)).toBeCloseTo(colourDistance(b, a), 10);
  });

  it("grows with separation", () => {
    const base = { r: 231, g: 222, b: 204 };
    const near = { r: 226, g: 218, b: 200 };
    const far = { r: 30, g: 42, b: 68 };
    expect(colourDistance(base, near)).toBeLessThan(colourDistance(base, far));
  });

  it("weights green more heavily than blue, as the eye does", () => {
    // Same numeric shift on different channels. Green must read as the larger
    // change — this is the entire reason for not using plain Euclidean RGB.
    const base = { r: 128, g: 128, b: 128 };
    const greenShift = colourDistance(base, { r: 128, g: 158, b: 128 });
    const blueShift = colourDistance(base, { r: 128, g: 128, b: 158 });
    expect(greenShift).toBeGreaterThan(blueShift);
  });
});

describe("nearestSwatch", () => {
  it("names an exact catalogue colour exactly", () => {
    const match = nearestSwatch({ r: 231, g: 222, b: 204 }, PALETTE);
    expect(match?.name).toBe("Ecru");
    expect(match?.distance).toBe(0);
  });

  it("picks the nearest neighbour for a colour between two swatches", () => {
    // Sits between Ecru (#E7DECC) and Natural (#DDD3C0), a touch closer to Natural.
    const match = nearestSwatch({ r: 224, g: 214, b: 196 }, PALETTE);
    expect(match?.name).toBe("Natural");
  });

  it("separates the two dark neutrals rather than collapsing them", () => {
    expect(nearestSwatch({ r: 32, g: 44, b: 70 }, PALETTE)?.name).toBe("Navy");
    expect(nearestSwatch({ r: 60, g: 60, b: 62 }, PALETTE)?.name).toBe("Charcoal");
  });

  it("skips rows with an unparseable hex", () => {
    const withJunk: Swatch[] = [{ name: "Broken", hex: "not-a-colour" }, ...PALETTE];
    const match = nearestSwatch({ r: 231, g: 222, b: 204 }, withJunk);
    expect(match?.name).toBe("Ecru");
  });

  it("returns null when nothing is in stock", () => {
    expect(nearestSwatch({ r: 10, g: 10, b: 10 }, [])).toBeNull();
    expect(nearestSwatch({ r: 10, g: 10, b: 10 }, [{ name: "Broken", hex: "zz" }])).toBeNull();
  });
});

describe("matching a lit photo against unlit swatches", () => {
  /** Same colour, photographed dimmer. Illumination, not a different cloth. */
  const dim = (hex: string, factor: number) => {
    const rgb = hexToRgb(hex)!;
    return { r: Math.round(rgb.r * factor), g: Math.round(rgb.g * factor), b: Math.round(rgb.b * factor) };
  };

  it("scores an exact match at zero", () => {
    const ecru = hexToRgb("#E7DECC")!;
    expect(litDistance(ecru, ecru)).toBe(0);
  });

  it("names a warm cloth warm even when it is photographed in shadow", () => {
    // The reported bug: a photo of undyed cotton came back "Powder Blue".
    // Under plain redmean a dimmed ecru scores nearer the mid-tone neutrals
    // than Ecru, because brightness swamps hue. It is the same cloth either way.
    for (const factor of [0.9, 0.8, 0.7, 0.6]) {
      const match = nearestSwatch(dim("#E7DECC", factor), PALETTE);
      expect(WARM_NEUTRALS, `at ${factor} brightness`).toContain(match!.name);
    }
  });

  it("holds for a dark colour photographed brighter than the swatch", () => {
    const match = nearestSwatch(dim("#1E2A44", 1.4), PALETTE);
    expect(match?.name).toBe("Navy");
  });

  it("still separates colours that differ only in lightness", () => {
    // Illumination tolerance must not collapse a pale swatch into a dark one of
    // the same hue — a residual lightness term keeps these apart.
    const light: Swatch[] = [
      { name: "Camel", hex: "#B08D5E" },
      { name: "Espresso", hex: "#362519" },
    ];
    expect(nearestSwatch(hexToRgb("#B08D5E")!, light)?.name).toBe("Camel");
    expect(nearestSwatch(hexToRgb("#362519")!, light)?.name).toBe("Espresso");
  });

  it("keeps hue decisive over brightness", () => {
    // Tolerating illumination must not blur hue. A genuinely neutral grey and a
    // genuinely cool one still have to land on the neutral and the cool swatch,
    // never on a warm neutral of similar brightness.
    expect(nearestSwatch({ r: 184, g: 185, b: 182 }, PALETTE)?.name).toBe("Silver Grey");
    expect(nearestSwatch({ r: 189, g: 206, b: 218 }, PALETTE)?.name).toBe("Powder Blue");
    expect(nearestSwatch({ r: 155, g: 168, b: 140 }, PALETTE)?.name).toBe("Sage");
  });

  it("does not send a genuinely cool cloth to a warm swatch either", () => {
    // The fix must not overcorrect: powder blue photographed dim is still blue.
    expect(nearestSwatch(dim("#BDCEDA", 0.7), PALETTE)?.name).toBe("Powder Blue");
  });
});

describe("colourCertainty", () => {
  it("calls a near-exact hit confident", () => {
    expect(colourCertainty(0)).toBe("confident");
    expect(colourCertainty(40)).toBe("confident");
  });

  it("hedges in the middle band", () => {
    expect(colourCertainty(41)).toBe("likely");
    expect(colourCertainty(110)).toBe("likely");
  });

  it("admits uncertainty when the measurement sits between swatches", () => {
    expect(colourCertainty(111)).toBe("uncertain");
    expect(colourCertainty(400)).toBe("uncertain");
  });

  it("degrades a real off-palette measurement to uncertain", () => {
    // Hot magenta against a palette of neutrals and earths. Nothing here is
    // close, and the honest answer is to say so — an uncertain reading is
    // shown but never used as a filter.
    const match = nearestSwatch({ r: 255, g: 0, b: 200 }, PALETTE);
    expect(match).not.toBeNull();
    expect(colourCertainty(match!.distance)).toBe("uncertain");
  });
});

describe("rgbToHex", () => {
  it("round-trips through hexToRgb", () => {
    for (const swatch of PALETTE) {
      expect(rgbToHex(hexToRgb(swatch.hex)!).toUpperCase()).toBe(swatch.hex.toUpperCase());
    }
  });

  it("pads single-digit channels", () => {
    expect(rgbToHex({ r: 0, g: 8, b: 15 })).toBe("#00080f");
  });

  it("clamps and rounds out-of-range channels", () => {
    expect(rgbToHex({ r: -20, g: 300, b: 127.6 })).toBe("#00ff80");
  });
});
