import type { ProductFilters } from "@/server/services/product-service";

/**
 * Deterministic natural-language → filter parser.
 *
 * This is the floor the AI stands on, not a placeholder. Textile sourcing
 * language is narrow and highly conventional — "lightweight", "under $4",
 * "at least 2000 metres", "GOTS", "twill" — so a rule set covers the majority
 * of real queries with zero latency and zero cost. When a model is configured
 * it runs *first* and this parser merges in anything it missed; when no model
 * is configured this is the whole show and the feature still works.
 *
 * Every filter it produces is surfaced to the user as a removable chip. The
 * assistant never applies a constraint the buyer cannot see and undo.
 */

export type ParsedQuery = {
  filters: ProductFilters;
  /** Human-readable chips, one per constraint, in the order they were found. */
  applied: { key: keyof ProductFilters; label: string; value: string }[];
  /** Words left over after constraint extraction — used as the text query. */
  residual: string;
};

const FIBRES: Record<string, string[]> = {
  cotton: ["cotton", "poplin", "oxford", "chambray", "denim", "khadi", "voile", "canvas", "duck"],
  linen: ["linen", "flax"],
  silk: ["silk", "charmeuse", "dupioni", "chiffon", "organza", "brocade", "tanchoi", "habotai"],
  wool: ["wool", "worsted", "merino", "tweed", "flannel"],
  polyester: ["polyester", "poly"],
  viscose: ["viscose", "rayon", "modal"],
  elastane: ["elastane", "spandex", "lycra", "stretch"],
  nylon: ["nylon", "polyamide"],
  cupro: ["cupro", "bemberg"],
};

const WEAVES: Record<string, string[]> = {
  PLAIN: ["plain weave", "plain", "poplin", "taffeta"],
  TWILL: ["twill", "denim", "gabardine", "chino"],
  SATIN: ["satin", "charmeuse", "sateen"],
  JACQUARD: ["jacquard", "brocade", "damask", "figured"],
  HERRINGBONE: ["herringbone", "chevron"],
  JERSEY: ["jersey", "knit", "single knit", "interlock", "terry"],
  RIB: ["rib", "ribbed", "ribbing"],
  DOBBY: ["dobby", "pique", "birdseye", "pinpoint"],
  CANVAS: ["canvas", "duck", "basketweave", "panama"],
  CREPE: ["crepe", "crêpe", "pebbled"],
};

const CATEGORIES: Record<string, string[]> = {
  shirting: ["shirting", "shirt", "shirts", "blouse", "blouses"],
  suiting: ["suiting", "suit", "suits", "tailoring", "blazer", "trouser", "trousers"],
  denim: ["denim", "jeans", "jean"],
  linen: ["linen"],
  "silk-satin": ["silk", "satin", "bridal", "eveningwear"],
  "knits-jersey": ["jersey", "knit", "knits", "t-shirt", "tshirt", "tee", "sweatshirt", "loungewear"],
  performance: ["performance", "activewear", "sportswear", "athleisure", "gym", "wicking"],
  "handloom-khadi": ["handloom", "khadi", "artisan", "handwoven", "hand-woven", "ikat"],
  upholstery: ["upholstery", "furnishing", "sofa", "curtain", "curtains", "cushion", "velvet"],
  "canvas-workwear": ["workwear", "canvas", "duck", "bag", "bags", "apron", "ripstop", "overall"],
  lining: ["lining", "linings", "pocketing"],
  "sheers-voile": ["voile", "sheer", "sheers", "organza", "mull", "dupatta"],
};

const SUSTAINABILITY: Record<string, string[]> = {
  GOTS: ["gots", "organic certified"],
  "OEKO-TEX Standard 100": ["oeko", "oekotex", "oeko-tex"],
  "GRS Recycled": ["recycled", "grs", "post-consumer"],
  "European Flax": ["european flax"],
  "BCI Cotton": ["bci"],
  Fairtrade: ["fairtrade", "fair trade"],
  "Handloom Mark": ["handloom mark"],
  "Silk Mark": ["silk mark"],
};

const NUM = String.raw`([\d,]+(?:\.\d+)?)`;

function num(raw: string) {
  return Number(raw.replace(/,/g, ""));
}

export function parseQuery(input: string): ParsedQuery {
  const text = ` ${input.toLowerCase().replace(/\$/g, " $ ").replace(/\s+/g, " ")} `;
  const filters: ProductFilters = {};
  const applied: ParsedQuery["applied"] = [];
  const consumed: string[] = [];

  const add = (key: keyof ProductFilters, label: string, value: string) => {
    applied.push({ key, label, value });
  };

  /* ------------------------------------------------------------- price */

  const priceBetween = text.match(new RegExp(`(?:between|from)\\s*\\$?\\s*${NUM}\\s*(?:and|to|[-–])\\s*\\$?\\s*${NUM}`));
  const priceUnder = text.match(new RegExp(`(?:under|below|less than|cheaper than|max|upto|up to|within)\\s*\\$?\\s*${NUM}`));
  const priceOver = text.match(new RegExp(`(?:over|above|more than|at least|minimum)\\s*\\$?\\s*${NUM}\\s*(?:a |per |/)?\\s*(?:dollars?|usd)?\\s*(?:a |per |/)?\\s*(?:m|metre|meter)`));

  if (priceBetween) {
    filters.priceMin = num(priceBetween[1]!);
    filters.priceMax = num(priceBetween[2]!);
    add("priceMax", `$${filters.priceMin}–$${filters.priceMax}/m`, String(filters.priceMax));
    consumed.push(priceBetween[0]);
  } else if (priceUnder && !/\b(gsm|gram|metre|meter|m\b)\s*$/.test(priceUnder[0])) {
    // "under 300" next to a gsm/metre word is a weight or quantity, not a price.
    const value = num(priceUnder[1]!);
    const looksLikeMetres = new RegExp(`${priceUnder[1]}\\s*(m\\b|metres?|meters?)`).test(text);
    const looksLikeGsm = new RegExp(`${priceUnder[1]}\\s*(gsm|g/m)`).test(text);
    if (!looksLikeMetres && !looksLikeGsm) {
      filters.priceMax = value;
      add("priceMax", `≤ $${value}/m`, String(value));
      consumed.push(priceUnder[0]);
    }
  }
  if (priceOver) {
    // Same guard the `under` branch carries, and for the same reason: this
    // pattern ends in `(?:m|metre|meter)`, so "at least 2000m in stock" —
    // a *quantity* — otherwise matched as a $2000 price floor. Paired with a
    // "under $4" ceiling that produced priceMin 2000 / priceMax 4 and an empty
    // result set for one of the most natural queries a buyer can type.
    const value = num(priceOver[1]!);
    const looksLikeMetres = new RegExp(`${priceOver[1]}\\s*(m\\b|metres?|meters?)`).test(text);
    const looksLikeGsm = new RegExp(`${priceOver[1]}\\s*(gsm|g/m)`).test(text);
    if (!looksLikeMetres && !looksLikeGsm) {
      filters.priceMin = value;
      add("priceMin", `≥ $${value}/m`, String(value));
      consumed.push(priceOver[0]);
    }
  }

  // Catalogue runs $1.55–$28.80/m, so these two bands are where "cheap" and
  // "premium" actually sit. They move with the catalogue, not with the words.
  if (!filters.priceMax && /\b(budget|cheap|affordable|economical|low cost|low-cost)\b/.test(text)) {
    filters.priceMax = 4;
    add("priceMax", "≤ $4/m", "4");
  }
  if (!filters.priceMin && /\b(premium|luxury|high end|high-end|finest)\b/.test(text)) {
    filters.priceMin = 8;
    add("priceMin", "≥ $8/m", "8");
  }

  /* --------------------------------------------------------------- gsm */

  const gsmExact = text.match(new RegExp(`${NUM}\\s*(?:gsm|g/m2|g/sqm)`));
  const gsmRange = text.match(new RegExp(`${NUM}\\s*(?:to|[-–])\\s*${NUM}\\s*gsm`));

  if (gsmRange) {
    filters.gsmMin = num(gsmRange[1]!);
    filters.gsmMax = num(gsmRange[2]!);
    add("gsmMax", `${filters.gsmMin}–${filters.gsmMax} gsm`, String(filters.gsmMax));
    consumed.push(gsmRange[0]);
  } else if (gsmExact) {
    const g = num(gsmExact[1]!);
    // A stated weight is a target, not a hard edge — allow ±15%.
    filters.gsmMin = Math.round(g * 0.85);
    filters.gsmMax = Math.round(g * 1.15);
    add("gsmMax", `≈ ${g} gsm`, String(g));
    consumed.push(gsmExact[0]);
  } else if (/\b(lightweight|light weight|light|summer|breathable|airy|sheer)\b/.test(text)) {
    filters.gsmMax = 160;
    add("gsmMax", "≤ 160 gsm", "160");
  } else if (/\b(heavyweight|heavy weight|heavy|winter|thick|sturdy|durable)\b/.test(text)) {
    filters.gsmMin = 260;
    add("gsmMin", "≥ 260 gsm", "260");
  } else if (/\b(midweight|mid weight|medium weight)\b/.test(text)) {
    filters.gsmMin = 150;
    filters.gsmMax = 280;
    add("gsmMax", "150–280 gsm", "280");
  }

  /* ------------------------------------------------------------- stock */

  const stockMatch = text.match(
    new RegExp(`(?:at least|minimum|min|need|want|require|more than|over)\\s*${NUM}\\s*(?:m\\b|metres?|meters?)`),
  );
  if (stockMatch) {
    filters.stockMin = num(stockMatch[1]!);
    add("stockMin", `Stock ≥ ${filters.stockMin.toLocaleString("en-US")}m`, String(filters.stockMin));
    consumed.push(stockMatch[0]);
  } else if (/\b(in stock|available now|ready stock|immediate|on hand)\b/.test(text)) {
    filters.inStock = true;
    add("inStock", "In stock", "1");
  }

  /* --------------------------------------------------------------- moq */

  const moqMatch = text.match(new RegExp(`moq\\s*(?:under|below|of|max)?\\s*${NUM}`));
  if (moqMatch) {
    filters.moqMax = num(moqMatch[1]!);
    add("moqMax", `MOQ ≤ ${filters.moqMax}m`, String(filters.moqMax));
    consumed.push(moqMatch[0]);
  } else if (/\b(low moq|small (?:batch|quantity|order)|sampling|sample length|short run)\b/.test(text)) {
    filters.moqMax = 100;
    add("moqMax", "MOQ ≤ 100m", "100");
  }

  /* --------------------------------------------------------- lead time */

  const leadMatch = text.match(
    new RegExp(`(?:within|under|less than|in)\\s*${NUM}\\s*(?:days?|working days?)`),
  );
  if (leadMatch) {
    filters.leadTimeMax = num(leadMatch[1]!);
    add("leadTimeMax", `Lead ≤ ${filters.leadTimeMax} days`, String(filters.leadTimeMax));
    consumed.push(leadMatch[0]);
  } else if (/\b(fast|quick|urgent|rush|asap|soon)\b/.test(text)) {
    filters.leadTimeMax = 10;
    add("leadTimeMax", "Lead ≤ 10 days", "10");
  }

  /* ------------------------------------------------- categorical facets */

  const fibres = matchDict(text, FIBRES);
  if (fibres.length) {
    filters.fibre = fibres;
    for (const f of fibres) add("fibre", `Fibre: ${cap(f)}`, f);
  }

  const weaves = matchDict(text, WEAVES);
  if (weaves.length) {
    filters.weave = weaves;
    for (const w of weaves) add("weave", `Weave: ${cap(w.toLowerCase())}`, w);
  }

  const categories = matchDict(text, CATEGORIES);
  if (categories.length) {
    filters.category = categories;
    for (const c of categories) add("category", `Category: ${cap(c.replace(/-/g, " "))}`, c);
  }

  const sustain = matchDict(text, SUSTAINABILITY);
  if (sustain.length) {
    filters.sustainability = sustain;
    for (const s of sustain) add("sustainability", s, s);
  }
  if (!sustain.length && /\borganic\b/.test(text)) {
    filters.sustainability = ["GOTS"];
    add("sustainability", "GOTS organic", "GOTS");
  }

  /* ----------------------------------------------------------- residual */

  let residual = input;
  for (const c of consumed) {
    residual = residual.replace(new RegExp(escapeRegex(c.trim()), "ig"), " ");
  }
  residual = residual
    .replace(
      /\b(i|we|need|want|looking for|show me|find|get|some|any|a|an|the|for|with|that|is|are|and|or|please|fabric|fabrics|cloth|material)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (residual.length > 1) filters.q = residual;

  return { filters, applied, residual };
}

function matchDict(text: string, dict: Record<string, string[]>): string[] {
  const hits: string[] = [];
  for (const [key, words] of Object.entries(dict)) {
    if (words.some((w) => new RegExp(`\\b${escapeRegex(w)}\\b`).test(text))) hits.push(key);
  }
  return hits;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Turns a filter object back into chips — used when filters arrive from the
 *  URL or from a model rather than from `parseQuery`. */
export function describeFilters(f: ProductFilters): ParsedQuery["applied"] {
  const out: ParsedQuery["applied"] = [];
  if (f.category?.length) for (const c of f.category) out.push({ key: "category", label: `Category: ${cap(c.replace(/-/g, " "))}`, value: c });
  if (f.fibre?.length) for (const c of f.fibre) out.push({ key: "fibre", label: `Fibre: ${cap(c)}`, value: c });
  if (f.weave?.length) for (const c of f.weave) out.push({ key: "weave", label: `Weave: ${cap(c.toLowerCase())}`, value: c });
  if (f.supplier?.length) for (const c of f.supplier) out.push({ key: "supplier", label: `Mill: ${cap(c.replace(/-/g, " "))}`, value: c });
  if (f.sustainability?.length) for (const c of f.sustainability) out.push({ key: "sustainability", label: c, value: c });
  if (f.priceMin != null) out.push({ key: "priceMin", label: `≥ $${f.priceMin}/m`, value: String(f.priceMin) });
  if (f.priceMax != null) out.push({ key: "priceMax", label: `≤ $${f.priceMax}/m`, value: String(f.priceMax) });
  if (f.gsmMin != null) out.push({ key: "gsmMin", label: `≥ ${f.gsmMin} gsm`, value: String(f.gsmMin) });
  if (f.gsmMax != null) out.push({ key: "gsmMax", label: `≤ ${f.gsmMax} gsm`, value: String(f.gsmMax) });
  if (f.stockMin != null) out.push({ key: "stockMin", label: `Stock ≥ ${f.stockMin.toLocaleString("en-US")}m`, value: String(f.stockMin) });
  if (f.moqMax != null) out.push({ key: "moqMax", label: `MOQ ≤ ${f.moqMax}m`, value: String(f.moqMax) });
  if (f.leadTimeMax != null) out.push({ key: "leadTimeMax", label: `Lead ≤ ${f.leadTimeMax} days`, value: String(f.leadTimeMax) });
  if (f.inStock) out.push({ key: "inStock", label: "In stock", value: "1" });
  return out;
}
