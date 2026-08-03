import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next build` and `next dev` both own .next, so running a build while the
  // dev server is up kills it. `npm run build:check` points the build at its
  // own directory so verification never disturbs a running dev server.
  // Vercel runs plain `npm run build` and gets the default .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Phosphor ships a barrel of several thousand icons. Without this, a single
  // named import pulls the lot into the bundle graph and cold builds crawl.
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "motion"],
  },

  // Uploaded product photos are served from our own route handler as bytes,
  // so there is no remote image host to allow-list.
  images: { remotePatterns: [] },
  devIndicators: false,
};

export default nextConfig;
