import type { ProductFilters, SortKey } from "@/server/services/product-service";

/**
 * The URL is the source of truth for marketplace state.
 *
 * Not a client store — the URL. That gives sharable searches, a back button
 * that restores the exact filter set and scroll position, and server-rendered
 * results with no hydration wait. It also means the AI and the sidebar write
 * to the same place, so a filter set produced by the assistant is
 * indistinguishable from one a buyer clicked together, and just as editable.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

const SORTS: SortKey[] = ["relevance", "newest", "price-asc", "price-desc", "gsm-asc", "gsm-desc", "popular"];

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function list(value: string | string[] | undefined): string[] | undefined {
  const raw = Array.isArray(value) ? value.join(",") : value;
  if (!raw) return undefined;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function int(value: string | string[] | undefined): number | undefined {
  const raw = one(value);
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * Prices carry cents; weights, quantities, lead times and page numbers do not.
 *
 * This exists because `int` truncates: a $4.50 ceiling arrived as $4 and
 * silently dropped every fabric between the two. Harmless when the catalogue
 * was priced in whole rupees, wrong the moment it was priced in dollars.
 */
function decimal(value: string | string[] | undefined): number | undefined {
  const raw = one(value);
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function parseSearchParams(params: RawSearchParams): ProductFilters {
  const sortRaw = one(params.sort) as SortKey | undefined;

  return {
    q: one(params.q)?.trim() || undefined,
    category: list(params.category),
    fibre: list(params.fibre),
    weave: list(params.weave),
    supplier: list(params.supplier),
    sustainability: list(params.sustainability),
    priceMin: decimal(params.priceMin),
    priceMax: decimal(params.priceMax),
    gsmMin: int(params.gsmMin),
    gsmMax: int(params.gsmMax),
    moqMax: int(params.moqMax),
    stockMin: int(params.stockMin),
    leadTimeMax: int(params.leadTimeMax),
    inStock: one(params.inStock) === "1",
    featured: one(params.featured) === "1",
    sort: sortRaw && SORTS.includes(sortRaw) ? sortRaw : undefined,
    page: Math.max(1, int(params.page) ?? 1),
    perPage: 24,
  };
}

export function filtersToParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const key of ["category", "fibre", "weave", "supplier", "sustainability"] as const) {
    const value = filters[key];
    if (value?.length) params.set(key, value.join(","));
  }
  for (const key of ["priceMin", "priceMax", "gsmMin", "gsmMax", "moqMax", "stockMin", "leadTimeMax"] as const) {
    const value = filters[key];
    if (value != null) params.set(key, String(value));
  }
  if (filters.inStock) params.set("inStock", "1");
  if (filters.featured) params.set("featured", "1");
  if (filters.sort && filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function countActiveFilters(filters: ProductFilters): number {
  let n = 0;
  for (const key of ["category", "fibre", "weave", "supplier", "sustainability"] as const) {
    n += filters[key]?.length ?? 0;
  }
  for (const key of ["priceMin", "priceMax", "gsmMin", "gsmMax", "moqMax", "stockMin", "leadTimeMax"] as const) {
    if (filters[key] != null) n += 1;
  }
  if (filters.inStock) n += 1;
  if (filters.featured) n += 1;
  return n;
}

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Most relevant" },
  { value: "popular", label: "Most viewed" },
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "gsm-asc", label: "Weight: light to heavy" },
  { value: "gsm-desc", label: "Weight: heavy to light" },
];
