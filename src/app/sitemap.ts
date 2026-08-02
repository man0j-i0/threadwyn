import type { MetadataRoute } from "next";

import { db } from "@/lib/db";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.category.findMany({ select: { slug: true }, orderBy: { position: "asc" } }),
  ]);

  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/marketplace`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/suppliers`, changeFrequency: "weekly", priority: 0.7 },
    ...categories.map((c) => ({
      url: `${BASE}/marketplace?category=${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...products.flatMap((p) => [
      {
        url: `${BASE}/product/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      {
        url: `${BASE}/weavescope/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      },
    ]),
  ];
}
