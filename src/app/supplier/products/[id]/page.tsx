import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

import { requireSupplierPage, HttpError } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getSupplierProduct } from "@/server/services/supplier-service";
import { serialize } from "@/lib/serialize";
import { formatNumber } from "@/lib/utils";
import { ProductForm } from "@/components/supplier/product-form";

export const metadata: Metadata = { title: "Edit fabric" };

type PageProps = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: PageProps) {
  const { profile } = await requireSupplierPage();
  const { id } = await params;

  let product;
  try {
    product = await getSupplierProduct(profile.id, id);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }

  const categories = await db.category.findMany({
    orderBy: { position: "asc" },
    select: { name: true, slug: true },
  });

  const data = serialize(product);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Editing</p>
          <h1 className="font-display mt-2.5 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink">
            {product.name}
          </h1>
          <p className="mt-2.5 font-mono text-[12px] text-subtle tnum">
            {formatNumber(product.viewCount)} views · {product.colorways.length} colourways
          </p>
        </div>
        {product.status === "ACTIVE" ? (
          <Link
            href={`/product/${product.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-[13px] text-brand-ink underline underline-offset-4 hover:text-brand-hover"
          >
            View as a buyer sees it
            <ArrowSquareOut size={12} weight="bold" />
          </Link>
        ) : null}
      </header>

      <ProductForm
        mode="edit"
        categories={categories}
        initial={{
          id: product.id,
          name: data.name,
          categorySlug: product.category.slug,
          description: data.description,
          composition: data.composition,
          fibres: data.fibres,
          weave: data.weave,
          gsm: data.gsm,
          widthCm: data.widthCm,
          finish: data.finish,
          handFeel: data.handFeel,
          useCases: data.useCases,
          sustainability: data.sustainability,
          pricePerMetre: data.pricePerMetre,
          compareAtPrice: data.compareAtPrice,
          moqMetres: data.moqMetres,
          leadTimeDays: data.leadTimeDays,
          status: data.status,
          featured: data.featured,
          colorways: data.colorways.map((c) => ({
            id: c.id,
            name: c.name,
            hex: c.hex,
            stockMetres: c.stockMetres,
          })),
          images: data.images.map((i) => ({ url: i.url, alt: i.alt })),
        }}
      />
    </div>
  );
}
