import { describe, expect, it } from "vitest";

import { parseQuery } from "./nl-filters";

/**
 * The deterministic query parser.
 *
 * This is the floor the assistant stands on: it always runs, and a model — when
 * one is configured — only adds constraints it missed. So a regression here is
 * not an AI degradation, it is the search box being wrong for everybody.
 *
 * The cases that matter most are the *guards*. Every number in a sourcing query
 * is ambiguous — 300 could be a price, a weight or a quantity — and the parser
 * decides between them from the words around it. Both guards below were written
 * after real bugs: one shipped as a truncation, the other made the demo script's
 * headline query return nothing at all.
 */

const chips = (q: string) => parseQuery(q).applied.map((a) => a.label);

describe("price", () => {
  it("reads a ceiling with or without the symbol", () => {
    expect(parseQuery("shirting under $4").filters.priceMax).toBe(4);
    expect(parseQuery("shirting under 4 a metre").filters.priceMax).toBe(4);
  });

  it("keeps cents", () => {
    // `int()` used to truncate this to 4 and silently drop everything between.
    expect(parseQuery("shirting under $4.50").filters.priceMax).toBe(4.5);
  });

  it("reads a floor", () => {
    expect(parseQuery("twill over $8 per metre").filters.priceMin).toBe(8);
    expect(parseQuery("linen at least $6 a metre").filters.priceMin).toBe(6);
  });

  it("reads a range", () => {
    const { filters } = parseQuery("linen between $5 and $10");
    expect(filters.priceMin).toBe(5);
    expect(filters.priceMax).toBe(10);
  });

  it("maps vague price words onto the catalogue's real bands", () => {
    expect(parseQuery("cheap navy jersey").filters.priceMax).toBe(4);
    expect(parseQuery("premium silk for bridal").filters.priceMin).toBe(8);
  });
});

describe("guards against reading a quantity or weight as a price", () => {
  it("does not turn a stock minimum into a price floor", () => {
    // The regression that mattered: the floor pattern ends in (m|metre|meter),
    // so "at least 2000m" matched as a $2000 price floor. Combined with the
    // ceiling below it produced min 2000 / max 4 — an empty result set, for the
    // exact query the demo script tells you to type.
    const { filters } = parseQuery(
      "breathable cotton for summer shirting under $4 with at least 2000m in stock",
    );
    expect(filters.priceMin).toBeUndefined();
    expect(filters.priceMax).toBe(4);
    expect(filters.stockMin).toBe(2000);
  });

  it("does not turn a gsm ceiling into a price ceiling", () => {
    const { filters } = parseQuery("cotton under 300 gsm");
    expect(filters.priceMax).toBeUndefined();
  });

  it("still reads a genuine floor stated per metre", () => {
    // The guard must not be so broad that it eats the real case.
    expect(parseQuery("twill over $8 per metre").filters.priceMin).toBe(8);
  });
});

describe("weight, stock and structure", () => {
  it("reads an explicit gsm range", () => {
    const { filters } = parseQuery("cotton 120 to 160 gsm");
    expect(filters.gsmMin).toBe(120);
    expect(filters.gsmMax).toBe(160);
  });

  it("treats a single stated weight as a target, not an edge", () => {
    const { filters } = parseQuery("cotton 200 gsm");
    expect(filters.gsmMin).toBeLessThan(200);
    expect(filters.gsmMax).toBeGreaterThan(200);
  });

  it("maps weight words when no number is given", () => {
    expect(parseQuery("lightweight summer cotton").filters.gsmMax).toBe(160);
    expect(parseQuery("heavyweight winter cloth").filters.gsmMin).toBe(260);
  });

  it("reads fibre, weave and category", () => {
    const { filters } = parseQuery("navy cotton twill for denim");
    expect(filters.fibre).toContain("cotton");
    expect(filters.weave).toContain("TWILL");
    expect(filters.category).toContain("denim");
  });
});

describe("chips", () => {
  it("surfaces one removable chip per constraint", () => {
    // The product rule: the assistant proposes, the buyer disposes. A filter
    // the parser applied but never showed would be a constraint nobody can undo.
    const q = "breathable cotton for summer shirting under $4 with at least 2000m in stock";
    const labels = chips(q);

    expect(labels).toContain("≤ $4/m");
    expect(labels).toContain("Stock ≥ 2,000m");
    expect(labels.some((l) => l.includes("Cotton"))).toBe(true);
    expect(labels.some((l) => l.includes("Shirting"))).toBe(true);
    // And crucially, no phantom price floor.
    expect(labels.some((l) => l.startsWith("≥ $"))).toBe(false);
  });

  it("prices chips in dollars", () => {
    expect(chips("under $4")).toContain("≤ $4/m");
    expect(chips("cheap cotton").some((l) => l.includes("₹"))).toBe(false);
  });

  it("returns nothing for a query with no constraints", () => {
    expect(parseQuery("something lovely").applied).toHaveLength(0);
  });
});
