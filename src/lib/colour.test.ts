import { describe, expect, it } from "vitest";

import {
  colourCertainty,
  colourDistance,
  hexToRgb,
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

/** A slice of the real seeded palette, hexes included. */
const PALETTE: Swatch[] = [
  { name: "Optic White", hex: "#F7F5F0" },
  { name: "Ecru", hex: "#E7DECC" },
  { name: "Natural", hex: "#DDD3C0" },
  { name: "Charcoal", hex: "#3A3A3C" },
  { name: "Navy", hex: "#1E2A44" },
  { name: "Terracotta", hex: "#B0603F" },
  { name: "Sage", hex: "#9BA88C" },
];

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
