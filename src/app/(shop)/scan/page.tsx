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
        <header className="mb-9 max-w-2xl">
          <p className="eyebrow text-accent">Fabric scan</p>
          <h1 className="font-display mt-3 text-3xl leading-[1.1] font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            Show us the cloth
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Upload a photo of a swatch and we&apos;ll read what a camera can honestly tell — colour, weave, weight —
            then find the closest fabrics in stock.
          </p>
        </header>

        <FabricScanner />
      </div>

      <AssistantDock />
    </>
  );
}
