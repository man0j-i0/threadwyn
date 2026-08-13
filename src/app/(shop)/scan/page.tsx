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
        {/* Deliberately identical to the checkout header — eyebrow, spacing and
            type scale — because a scan is the same kind of thing: a short
            stepped flow with a stepper under it. Matching it is what keeps the
            two from looking like they came from different products. */}
        <header className="mb-8">
          <p className="eyebrow text-accent">Fabric scan</p>
          <h1 className="font-display mt-3 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            Show us the cloth
          </h1>
        </header>

        <FabricScanner />
      </div>

      <AssistantDock />
    </>
  );
}
