import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";

import { ThemeScript } from "@/components/system/theme-script";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

/**
 * Fraunces carries the brand voice — a soft-serif with an optical-size axis, so
 * display sizes stay crisp and small sizes stay readable. Geist handles product
 * UI. Geist Mono handles specs, SKUs and order numbers, where tabular figures
 * stop columns from jittering as values change.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Threadwyn — Textile procurement, decided faster",
    template: "%s · Threadwyn",
  },
  description:
    "A B2B textile marketplace where buyers source fabric by the metre from verified mills, and suppliers run catalogue, inventory and orders from one console.",
  applicationName: "Threadwyn",
  keywords: [
    "textile marketplace",
    "fabric sourcing",
    "B2B procurement",
    "wholesale fabric",
    "mill direct",
  ],
  openGraph: {
    type: "website",
    siteName: "Threadwyn",
    title: "Threadwyn — Textile procurement, decided faster",
    description:
      "Source fabric by the metre from verified mills. Compare on GSM, composition, MOQ and lead time in one place.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#14120f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        {/* Keyboard users land here first — one tab to skip the entire chrome. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-full focus:bg-brand focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
