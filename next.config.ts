import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phosphor ships a barrel of several thousand icons. Without this, a single
  // named import pulls the lot into the bundle graph and cold builds crawl.
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "motion"],
  },

  // Uploaded product photos are served from our own route handler as bytes,
  // so there is no remote image host to allow-list.
  images: { remotePatterns: [] },
};

export default nextConfig;
