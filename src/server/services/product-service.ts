import "server-only";

import type { Prisma, ProductStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { cosine, embedLocal, tokenize } from "@/lib/ai/embed";

/**
 * One query path, three callers.
 *
 * The filter sidebar, the keyword search box and the AI assistant all funnel
 * into `searchProducts`. The assistant's only privilege is that it can *write*
 * the filter object — it never gets a private ranking, and it can never surface
 * a product the deterministic path would have hidden. That is what keeps the AI
 * honest and what keeps browsing fully usable with the assistant switched off.
 */

export const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  weave: true,
  gsm: true,
  widthCm: true,
  composition: true,
  pricePerMetre: true,
  compareAtPrice: true,
  moqMetres: true,
  stockMetres: true,
  leadTimeDays: true,
  status: true,
  featured: true,
  category: { select: { name: true, slug: true } },
  supplier: { select: { businessName: true, slug: true, verified: true, city: true } },
  colorways: { select: { id: true, name: true, hex: true }, orderBy: { position: "asc" } },
  images: { select: { url: true, alt: true }, orderBy: { position: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

export type SortKey = "relevance" | "newest" | "price-asc" | "price-desc" | "gsm-asc" | "gsm-desc" | "popular";

export type ProductFilters = {
  q?: string;
  category?: string[];
  fibre?: string[];
  weave?: string[];
  supplier?: string[];
  sustainability?: string[];
  priceMin?: number;
  priceMax?: number;
  gsmMin?: number;
  gsmMax?: number;
  widthMin?: number;
  moqMax?: number;
  stockMin?: number;
  leadTimeMax?: number;
  inStock?: boolean;
  featured?: boolean;
  sort?: SortKey;
  page?: number;
  perPage?: number;
};

const MAX_PER_PAGE = 48;

export function buildWhere(f: ProductFilters, status: ProductStatus[] = ["ACTIVE"]): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: { in: status } };
  const and: Prisma.ProductWhereInput[] = [];

  if (f.category?.length) and.push({ category: { slug: { in: f.category } } });
  if (f.supplier?.length) and.push({ supplier: { slug: { in: f.supplier } } });
  if (f.fibre?.length) and.push({ fibres: { hasSome: f.fibre } });
  if (f.weave?.length) and.push({ weave: { in: f.weave as Prisma.EnumWeaveFilter["in"] } });
  if (f.sustainability?.length) and.push({ sustainability: { hasSome: f.sustainability } });

  if (f.priceMin != null || f.priceMax != null) {
    and.push({ pricePerMetre: { gte: f.priceMin ?? undefined, lte: f.priceMax ?? undefined } });
  }
  if (f.gsmMin != null || f.gsmMax != null) {
    and.push({ gsm: { gte: f.gsmMin ?? undefined, lte: f.gsmMax ?? undefined } });
  }
  if (f.widthMin != null) and.push({ widthCm: { gte: f.widthMin } });
  if (f.moqMax != null) and.push({ moqMetres: { lte: f.moqMax } });
  if (f.stockMin != null) and.push({ stockMetres: { gte: f.stockMin } });
  if (f.leadTimeMax != null) and.push({ leadTimeDays: { lte: f.leadTimeMax } });
  if (f.inStock) and.push({ stockMetres: { gt: 0 } });
  if (f.featured) and.push({ featured: true });

  // Lexical prefilter. Cheap, index-friendly, and it keeps the vector rerank
  // working on a candidate set rather than the whole table.
  if (f.q?.trim()) {
    const terms = tokenize(f.q).slice(0, 8);
    if (terms.length) {
      and.push({
        OR: [
          { name: { contains: f.q.trim(), mode: "insensitive" } },
          ...terms.map((t) => ({ searchText: { contains: t, mode: "insensitive" as const } })),
        ],
      });
    }
  }

  if (and.length) where.AND = and;
  return where;
}

function orderBy(sort: SortKey | undefined): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ pricePerMetre: "asc" }, { name: "asc" }];
    case "price-desc":
      return [{ pricePerMetre: "desc" }, { name: "asc" }];
    case "gsm-asc":
      return [{ gsm: "asc" }, { name: "asc" }];
    case "gsm-desc":
      return [{ gsm: "desc" }, { name: "asc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "popular":
      return [{ viewCount: "desc" }, { name: "asc" }];
    default:
      return [{ featured: "desc" }, { viewCount: "desc" }, { name: "asc" }];
  }
}

export async function searchProducts(filters: ProductFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, filters.perPage ?? 24));
  const where = buildWhere(filters);
  const wantsRelevance = Boolean(filters.q?.trim()) && (filters.sort ?? "relevance") === "relevance";

  // With a text query we rank semantically, so we need the candidate set
  // before paginating. Without one, Postgres does the ordering and we page in
  // the database — no reason to pull rows we won't show.
  if (wantsRelevance) {
    const [candidates, total] = await Promise.all([
      db.product.findMany({
        where,
        select: { ...PRODUCT_CARD_SELECT, embedding: true, searchText: true },
        take: 240,
      }),
      db.product.count({ where }),
    ]);

    const queryVec = embedLocal(filters.q!);
    const terms = tokenize(filters.q!);

    const ranked = candidates
      .map((p) => {
        const semantic = cosine(queryVec, p.embedding);
        // Exact substring hits are worth more than vector proximity — a buyer
        // typing "dupioni" wants dupioni, not "something like dupioni".
        const haystack = p.searchText;
        const lexical =
          terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0) / Math.max(1, terms.length);
        const nameHit = p.name.toLowerCase().includes(filters.q!.trim().toLowerCase()) ? 0.35 : 0;
        const stocked = p.stockMetres > 0 ? 0.04 : 0;
        return { p, score: semantic * 0.45 + lexical * 0.5 + nameHit + stocked };
      })
      .sort((a, b) => b.score - a.score);

    const slice = ranked.slice((page - 1) * perPage, page * perPage);

    return {
      // Strip the vector — it is 256 floats per row and no client needs it.
      items: slice.map(({ p }) => {
        const { embedding: _e, searchText: _s, ...rest } = p;
        return rest;
      }),
      total,
      page,
      perPage,
      pageCount: Math.max(1, Math.ceil(total / perPage)),
      ranked: true as const,
    };
  }

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      select: PRODUCT_CARD_SELECT,
      orderBy: orderBy(filters.sort),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.product.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    ranked: false as const,
  };
}

/** Facet counts for the sidebar. Computed against the *unfiltered* base so a
 *  buyer can see what's behind a filter they haven't applied yet. */
export async function getFacets() {
  const [categories, suppliers, weaves, priceRange, gsmRange] = await Promise.all([
    db.category.findMany({
      orderBy: { position: "asc" },
      select: {
        name: true,
        slug: true,
        accentHex: true,
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
      },
    }),
    db.supplierProfile.findMany({
      orderBy: { businessName: "asc" },
      select: {
        businessName: true,
        slug: true,
        city: true,
        verified: true,
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
      },
    }),
    db.product.groupBy({ by: ["weave"], where: { status: "ACTIVE" }, _count: true }),
    db.product.aggregate({
      where: { status: "ACTIVE" },
      _min: { pricePerMetre: true },
      _max: { pricePerMetre: true },
    }),
    db.product.aggregate({ where: { status: "ACTIVE" }, _min: { gsm: true }, _max: { gsm: true } }),
  ]);

  const fibreRows = await db.product.findMany({
    where: { status: "ACTIVE" },
    select: { fibres: true, sustainability: true },
  });

  const fibreCounts = new Map<string, number>();
  const sustainabilityCounts = new Map<string, number>();
  for (const row of fibreRows) {
    for (const f of row.fibres) fibreCounts.set(f, (fibreCounts.get(f) ?? 0) + 1);
    for (const s of row.sustainability) sustainabilityCounts.set(s, (sustainabilityCounts.get(s) ?? 0) + 1);
  }

  return {
    categories: categories.map((c) => ({
      value: c.slug,
      label: c.name,
      count: c._count.products,
      accentHex: c.accentHex,
    })),
    suppliers: suppliers
      .filter((s) => s._count.products > 0)
      .map((s) => ({
        value: s.slug,
        label: s.businessName,
        count: s._count.products,
        city: s.city,
        verified: s.verified,
      })),
    weaves: weaves
      .map((w) => ({ value: w.weave, label: w.weave, count: w._count }))
      .sort((a, b) => b.count - a.count),
    fibres: [...fibreCounts.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count),
    sustainability: [...sustainabilityCounts.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count),
    price: {
      min: Math.floor(Number(priceRange._min.pricePerMetre ?? 0)),
      max: Math.ceil(Number(priceRange._max.pricePerMetre ?? 5000)),
    },
    gsm: { min: gsmRange._min.gsm ?? 0, max: gsmRange._max.gsm ?? 500 },
  };
}

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      colorways: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
      supplier: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          businessType: true,
          tagline: true,
          description: true,
          city: true,
          state: true,
          country: true,
          verified: true,
          rating: true,
          ratingCount: true,
          moqMetres: true,
          leadTimeDays: true,
          yearEstablished: true,
          certifications: true,
          operatingHours: true,
          contactEmail: true,
          contactPhone: true,
        },
      },
    },
  });
}

/**
 * Nearest neighbours by cosine over the catalogue vectors, then nudged toward
 * the same category and a comparable weight — "similar" in textiles means
 * similar to *work with*, not merely similar in words.
 */
export async function getSimilarProducts(productId: string, limit = 6) {
  const source = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, embedding: true, categoryId: true, gsm: true, pricePerMetre: true },
  });
  if (!source) return [];

  const pool = await db.product.findMany({
    where: { status: "ACTIVE", id: { not: productId } },
    select: { ...PRODUCT_CARD_SELECT, embedding: true, categoryId: true },
    take: 400,
  });

  const srcPrice = Number(source.pricePerMetre);

  return pool
    .map((p) => {
      const semantic = cosine(source.embedding, p.embedding);
      const sameCategory = p.categoryId === source.categoryId ? 0.16 : 0;
      const gsmProximity = 1 - Math.min(1, Math.abs(p.gsm - source.gsm) / 260);
      const priceProximity =
        1 - Math.min(1, Math.abs(Number(p.pricePerMetre) - srcPrice) / Math.max(120, srcPrice));
      return { p, score: semantic * 0.58 + sameCategory + gsmProximity * 0.16 + priceProximity * 0.1 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p }) => {
      const { embedding: _e, categoryId: _c, ...rest } = p;
      return rest;
    });
}

/** Full spec rows for the comparison table, in the order requested. */
export async function getProductsForCompare(slugs: string[]) {
  const rows = await db.product.findMany({
    where: { slug: { in: slugs.slice(0, 4) } },
    include: {
      category: { select: { name: true, slug: true } },
      colorways: { orderBy: { position: "asc" } },
      supplier: {
        select: { businessName: true, slug: true, city: true, verified: true, rating: true, leadTimeDays: true },
      },
    },
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return slugs.map((s) => bySlug.get(s)).filter((r): r is NonNullable<typeof r> => Boolean(r));
}

export async function incrementViewCount(id: string) {
  // Fire-and-forget: a failed counter must never break a product page.
  await db.product.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
}
