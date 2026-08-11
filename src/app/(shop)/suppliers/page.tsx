import type { Metadata } from "next";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { SectionHeading } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { AssistantDock } from "@/components/ai/assistant-dock";
import {
  SupplierDirectory,
  type DirectorySupplier,
} from "@/components/suppliers/supplier-directory";

export const metadata: Metadata = {
  title: "Suppliers",
  description: "The verified Indian mills, handloom collectives and stockists supplying Threadwyn.",
};

// Dynamic, not ISR — see the note in src/app/page.tsx. SiteHeader's session
// read makes any `revalidate` here inert.

export default async function SuppliersPage() {
  const suppliers = await db.supplierProfile.findMany({
    orderBy: [{ verified: "desc" }, { rating: "desc" }],
    include: {
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
      products: {
        where: { status: "ACTIVE" },
        orderBy: { viewCount: "desc" },
        take: 4,
        select: {
          id: true,
          slug: true,
          name: true,
          weave: true,
          gsm: true,
          pricePerMetre: true,
          stockMetres: true,
          colorways: { select: { hex: true }, orderBy: { position: "asc" }, take: 1 },
        },
      },
    },
  });

  // Serialised here because Prisma hands back Decimal and Date instances that
  // cannot cross the server/client boundary.
  const data = serialize(suppliers) as unknown as DirectorySupplier[];

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <Reveal>
          <SectionHeading
            eyebrow="Who you're buying from"
            title="Meet the mills behind the fabrics"
            description="Explore verified suppliers, their fabrics and certifications."
          />
        </Reveal>

        <SupplierDirectory suppliers={data} />
      </div>

      <AssistantDock />
    </>
  );
}
