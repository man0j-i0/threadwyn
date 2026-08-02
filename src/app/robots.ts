import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in surfaces and the API have nothing useful for a crawler and
      // everything to lose from being indexed.
      disallow: ["/api/", "/dashboard", "/cart", "/checkout", "/orders", "/supplier", "/onboarding"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
