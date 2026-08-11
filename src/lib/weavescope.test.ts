import { describe, expect, it } from "vitest";

import { deriveConstruction, parseComposition, primaryFibre } from "./weavescope";

/**
 * WeaveScope's construction estimates.
 *
 * These numbers are the most technically exposed thing in the product: they are
 * shown to people who buy cloth for a living, labelled as estimates, and the
 * derivation is a claim we make out loud. So the test that matters is not "does
 * it return 49" — it is that the arithmetic still satisfies the mass balance it
 * says it satisfies, for every weave and across the whole weight range.
 *
 *     gsm = 0.1 × (ends/cm + picks/cm) × tex
 *
 * If a future edit breaks that identity, the page is quietly lying.
 */

const cotton = primaryFibre(["cotton"]);

describe("deriveConstruction", () => {
  /**
   * The published figures are rounded for display — you cannot show "24.6 warp
   * ends", and tex is quoted to one decimal. So the identity holds exactly on
   * the internal values and only approximately on the returned ones. 2% is
   * comfortably above that rounding and far below what any real break in the
   * algebra would produce: inverting the warp bias or dropping the ÷10 moves
   * this by tens of percent, not fractions of one.
   */
  const impliesGsmWithin2Pct = (c: { endsPerCm: number; picksPerCm: number; yarnTex: number }, gsm: number) => {
    const implied = 0.1 * (c.endsPerCm + c.picksPerCm) * c.yarnTex;
    return Math.abs(implied - gsm) / gsm;
  };

  it("satisfies the mass balance it claims, across the weight range", () => {
    for (const gsm of [45, 70, 120, 165, 250, 407, 480]) {
      const c = deriveConstruction({ weave: "PLAIN", gsm, fibre: cotton });
      expect(impliesGsmWithin2Pct(c, gsm)).toBeLessThan(0.02);
    }
  });

  it("holds the identity for every weave", () => {
    const weaves = [
      "PLAIN", "TWILL", "SATIN", "JACQUARD", "HERRINGBONE",
      "JERSEY", "RIB", "DOBBY", "CANVAS", "CREPE",
    ] as const;

    for (const weave of weaves) {
      const c = deriveConstruction({ weave, gsm: 200, fibre: cotton });
      expect(impliesGsmWithin2Pct(c, 200)).toBeLessThan(0.02);
    }
  });

  it("spins heavier cloth from coarser yarn", () => {
    const voile = deriveConstruction({ weave: "PLAIN", gsm: 60, fibre: cotton });
    const duck = deriveConstruction({ weave: "PLAIN", gsm: 480, fibre: cotton });
    expect(duck.yarnTex).toBeGreaterThan(voile.yarnTex);
    expect(duck.yarnDiameterMm).toBeGreaterThan(voile.yarnDiameterMm);
  });

  it("gives a warp-faced weave more ends than picks", () => {
    // Satin carries a strong warp bias; plain weave is balanced.
    const satin = deriveConstruction({ weave: "SATIN", gsm: 120, fibre: cotton });
    expect(satin.endsPerCm).toBeGreaterThan(satin.picksPerCm);

    const plain = deriveConstruction({ weave: "PLAIN", gsm: 120, fibre: cotton });
    expect(plain.endsPerCm).toBeCloseTo(plain.picksPerCm, 6);
  });

  it("keeps cover factor inside the physical range", () => {
    for (const gsm of [45, 120, 250, 480]) {
      const c = deriveConstruction({ weave: "CANVAS", gsm, fibre: cotton });
      expect(c.coverFactor).toBeGreaterThan(0);
      expect(c.coverFactor).toBeLessThanOrEqual(0.99);
    }
  });

  it("returns whole, positive counts a buyer can read", () => {
    const c = deriveConstruction({ weave: "TWILL", gsm: 407, fibre: cotton });
    expect(Number.isInteger(c.threadsPerInch)).toBe(true);
    expect(Number.isInteger(c.fibresPerYarn)).toBe(true);
    expect(c.threadsPerInch).toBeGreaterThan(0);
    expect(c.fibresPerYarn).toBeGreaterThan(0);
    expect(c.yarnMetresPerSqm).toBeGreaterThan(0);
  });

  it("names the interlacing for the weave", () => {
    expect(deriveConstruction({ weave: "PLAIN", gsm: 120, fibre: cotton }).interlacing)
      .toBe("1 over, 1 under");
    expect(deriveConstruction({ weave: "SATIN", gsm: 120, fibre: cotton }).floatLength)
      .toBeGreaterThan(deriveConstruction({ weave: "PLAIN", gsm: 120, fibre: cotton }).floatLength);
  });
});

describe("parseComposition", () => {
  it("splits a blend into parts that sum to 100", () => {
    const parts = parseComposition("98% Cotton / 2% Elastane");
    expect(parts).toHaveLength(2);
    expect(parts.reduce((sum, p) => sum + p.pct, 0)).toBe(100);
    expect(parts[0]!.label).toContain("Cotton");
  });

  it("handles a single fibre", () => {
    const parts = parseComposition("100% Cotton");
    expect(parts).toHaveLength(1);
    expect(parts[0]!.pct).toBe(100);
  });
});

describe("primaryFibre", () => {
  it("picks the fibre the cloth is mostly made of", () => {
    expect(primaryFibre(["cotton", "elastane"]).key).toBe("cotton");
  });

  it("falls back rather than throwing on an unknown fibre", () => {
    expect(primaryFibre([]).label).toBeTruthy();
    expect(primaryFibre(["unobtanium"]).label).toBeTruthy();
  });
});
