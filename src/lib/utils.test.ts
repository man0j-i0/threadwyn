import { describe, expect, it } from "vitest";

import { formatMetres, formatMoney, formatNumber, formatPerMetre, orderNumber, slugify } from "./utils";

/**
 * Formatting.
 *
 * Worth testing because these are the only place currency and locale are
 * decided, and because the last regression here was invisible: the locale
 * constant was passed as the *string* `"LOCALE"`, which is a structurally valid
 * BCP-47 tag, so `Intl` accepted it and silently fell back to the runtime
 * default. Every number looked right on the machine it was written on.
 *
 * Asserting on the digits rather than the exact glyph keeps these from breaking
 * on an ICU update that changes a space or a symbol.
 */

describe("formatMoney", () => {
  it("renders dollars with two decimals", () => {
    expect(formatMoney(2.8)).toBe("$2.80");
    expect(formatMoney(13.9)).toBe("$13.90");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("groups thousands the US way, not the Indian way", () => {
    // The bug this exists for: `en-IN` with USD renders $1,20,000.00.
    expect(formatMoney(120_000)).toBe("$120,000.00");
    expect(formatMoney(120_000)).not.toContain("1,20,");
  });

  it("compacts only when asked", () => {
    expect(formatMoney(2_900, { compact: true })).toBe("$2.9k");
    expect(formatMoney(12_000, { compact: true })).toBe("$12k");
    expect(formatMoney(2_400_000, { compact: true })).toBe("$2.4M");
    // Below the tier it stays exact, so a cart total is never rounded.
    expect(formatMoney(999, { compact: true })).toBe("$999.00");
  });

  it("never uses the lakh tier the rupee formatter had", () => {
    expect(formatMoney(500_000, { compact: true })).not.toContain("L");
  });

  it("always carries the unit when quoted per metre", () => {
    expect(formatPerMetre(2.8)).toBe("$2.80/m");
  });
});

describe("numbers", () => {
  it("groups metres and counts in the same locale as money", () => {
    expect(formatMetres(8400)).toBe("8,400 m");
    expect(formatNumber(120_000)).toBe("120,000");
    expect(formatNumber(120_000)).not.toContain("1,20,");
  });

  it("rounds metres to whole units", () => {
    expect(formatMetres(1200.6)).toBe("1,201 m");
  });
});

describe("slugify", () => {
  it("produces url-safe slugs", () => {
    expect(slugify("Compact Cotton Poplin 120")).toBe("compact-cotton-poplin-120");
    expect(slugify("Silk & Satin")).toBe("silk-satin");
    expect(slugify("  trailing  ")).toBe("trailing");
  });
});

describe("orderNumber", () => {
  it("is stable for a given seed", () => {
    expect(orderNumber(4321)).toBe(orderNumber(4321));
  });

  it("carries the TW- prefix and a fixed width", () => {
    expect(orderNumber(4321)).toMatch(/^TW-[0-9A-Z]{6}$/);
  });
});
