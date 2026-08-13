import type { Metadata } from "next";

import { FabricScanner } from "@/components/ai/fabric-scanner";
import { AssistantDock } from "@/components/ai/assistant-dock";

export const metadata: Metadata = {
  title: "Scan a fabric",
  description:
    "Photograph a swatch and Threadwyn reads its colour and weave, then finds the closest fabrics you can actually order.",
};

/**
 * The second door into the catalogue.
 *
 * Search assumes you can already name what you want. A buyer holding a swatch
 * off an existing garment usually cannot — so this takes the photograph instead
 * and resolves it to the same filters the search box produces.
 */
export default function ScanPage() {
  return (
    <>
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {/* No eyebrow. "FABRIC SCAN" over "Show us the cloth" was a label
            explaining a heading that already explains itself, and the brief
            asked for less text, not more scaffolding. */}
        <header className="mb-10 max-w-2xl">
          <h1 className="font-display text-[2.5rem] leading-[1.05] font-medium tracking-[-0.025em] text-ink sm:text-[3.25rem]">
            Show us the cloth
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted">
            Photograph a swatch. We&apos;ll read its colour and weave, then find what you can order.
          </p>
        </header>

        <FabricScanner />
      </div>

      <AssistantDock />
    </>
  );
}
