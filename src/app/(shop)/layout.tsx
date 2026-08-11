import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CompareBar } from "@/components/product/compare-bar";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      {/* Layout-level, so a shortlist built in the marketplace survives opening
          a product and comes back with you. */}
      <CompareBar />
    </>
  );
}
