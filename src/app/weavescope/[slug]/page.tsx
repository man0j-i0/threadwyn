import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProductBySlug } from "@/server/services/product-service";
import { serialize } from "@/lib/serialize";
import { WeaveScope, type ScopeProduct } from "@/components/weavescope/weavescope";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Fabric not found" };

  return {
    title: `${product.name} · WeaveScope`,
    description: `Look inside ${product.name} — from finished cloth down to weave structure and fibre. ${product.composition}, ${product.gsm} gsm.`,
  };
}

/**
 * WeaveScope gets its own route rather than a modal so it is linkable,
 * shareable and survives a refresh — a buyer sending "look at this weave" to a
 * colleague should be sending a URL, not a description of where to click.
 */
export default async function WeaveScopePage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const data = serialize({
    id: product.id,
    slug: product.slug,
    name: product.name,
    weave: product.weave,
    gsm: product.gsm,
    widthCm: product.widthCm,
    composition: product.composition,
    fibres: product.fibres,
    finish: product.finish,
    handFeel: product.handFeel,
    pricePerMetre: product.pricePerMetre,
    moqMetres: product.moqMetres,
    leadTimeDays: product.leadTimeDays,
    stockMetres: product.stockMetres,
    category: { name: product.category.name, slug: product.category.slug },
    supplier: {
      businessName: product.supplier.businessName,
      slug: product.supplier.slug,
      city: product.supplier.city,
    },
    colorways: product.colorways.map((c) => ({ id: c.id, name: c.name, hex: c.hex })),
  }) as unknown as ScopeProduct;

  return (
    <main id="main">
      <WeaveScope product={data} />
    </main>
  );
}
