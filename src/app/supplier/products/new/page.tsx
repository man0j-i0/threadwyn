import type { Metadata } from "next";

import { requireSupplierPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ProductForm } from "@/components/supplier/product-form";

export const metadata: Metadata = { title: "Add a fabric" };

export default async function NewProductPage() {
  const { profile } = await requireSupplierPage();
  const categories = await db.category.findMany({
    orderBy: { position: "asc" },
    select: { name: true, slug: true },
  });

  const supplier = await db.supplierProfile.findUnique({
    where: { id: profile.id },
    select: { moqMetres: true, leadTimeDays: true, categories: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-8">
        <p className="eyebrow text-accent">New listing</p>
        <h1 className="font-display mt-2.5 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink">
          Add a fabric
        </h1>
        <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-muted">
          The specs you enter here are what buyers filter and compare on, so they matter more than the copy.
          Get GSM, composition, MOQ and lead time right and the listing does its own selling.
        </p>
      </header>

      <ProductForm
        mode="create"
        categories={categories}
        initial={{
          // Pre-filled from the mill's own defaults — most listings share them.
          moqMetres: supplier?.moqMetres ?? 100,
          leadTimeDays: supplier?.leadTimeDays ?? 14,
          categorySlug: supplier?.categories?.[0] ?? categories[0]?.slug,
        }}
      />
    </div>
  );
}
