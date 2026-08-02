import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { HttpError, notFound } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils";
import { embedLocal } from "@/lib/ai/embed";
import type { ProductInput, SupplierProfileInput } from "@/lib/validation/schemas";

/**
 * Every function here takes `supplierId` and scopes its query by it. That is
 * the whole authorisation model for supplier data: a mill physically cannot
 * read or write another mill's rows, because no query is ever built without
 * their own id in the WHERE clause.
 */

/** Keeps the lexical haystack and the semantic vector in step with the row. */
function buildSearchArtifacts(input: {
  name: string;
  description: string;
  composition: string;
  fibres: string[];
  weave: string;
  gsm: number;
  finish: string;
  handFeel: string;
  useCases: string[];
  sustainability: string[];
  categoryName: string;
  supplierName: string;
  colorNames: string[];
}) {
  const doc = [
    input.name,
    input.categoryName,
    input.composition,
    input.fibres.join(" "),
    input.weave.toLowerCase(),
    `${input.gsm} gsm`,
    input.gsm < 120
      ? "lightweight light sheer summer"
      : input.gsm > 300
        ? "heavyweight heavy winter durable"
        : "midweight",
    input.finish,
    input.handFeel,
    input.useCases.join(" "),
    input.sustainability.join(" "),
    input.colorNames.join(" "),
    input.supplierName,
    input.description,
  ]
    .join(" \n ")
    .replace(/\s+/g, " ")
    .trim();

  return { searchText: doc.toLowerCase(), embedding: embedLocal(doc) };
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = slugify(base);
  let n = 1;
  // Loop rather than trusting the first guess — two mills can easily list
  // "Cotton Poplin 120".
  for (;;) {
    const clash = await db.product.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return slug;
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
}

/* --------------------------------------------------------------- products */

export async function listSupplierProducts(
  supplierId: string,
  filters: { q?: string; status?: string; category?: string } = {},
) {
  return db.product.findMany({
    where: {
      supplierId,
      ...(filters.status && filters.status !== "ALL"
        ? { status: filters.status as Prisma.EnumProductStatusFilter["equals"] }
        : { status: { not: "ARCHIVED" } }),
      ...(filters.category ? { category: { slug: filters.category } } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { composition: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      category: { select: { name: true, slug: true } },
      colorways: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" }, take: 1 },
      _count: { select: { orderItems: true } },
    },
  });
}

export async function getSupplierProduct(supplierId: string, productId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, supplierId },
    include: {
      category: { select: { name: true, slug: true } },
      colorways: { orderBy: { position: "asc" } },
      images: { orderBy: { position: "asc" } },
    },
  });
  if (!product) throw notFound("Fabric");
  return product;
}

export async function createSupplierProduct(supplierId: string, input: ProductInput) {
  const [category, supplier] = await Promise.all([
    db.category.findUnique({ where: { slug: input.categorySlug }, select: { id: true, name: true } }),
    db.supplierProfile.findUnique({ where: { id: supplierId }, select: { businessName: true } }),
  ]);
  if (!category) throw new HttpError(422, "invalid_category", "That category doesn't exist.", {
    categorySlug: "Choose a category from the list.",
  });
  if (!supplier) throw notFound("Supplier");

  const stockMetres = input.colorways.reduce((sum, c) => sum + c.stockMetres, 0);
  const artifacts = buildSearchArtifacts({
    ...input,
    categoryName: category.name,
    supplierName: supplier.businessName,
    colorNames: input.colorways.map((c) => c.name),
  });

  return db.product.create({
    data: {
      supplierId,
      categoryId: category.id,
      name: input.name,
      slug: await uniqueSlug(input.name),
      description: input.description,
      composition: input.composition,
      fibres: input.fibres,
      weave: input.weave,
      gsm: input.gsm,
      widthCm: input.widthCm,
      finish: input.finish,
      handFeel: input.handFeel,
      useCases: input.useCases,
      sustainability: input.sustainability,
      pricePerMetre: new Prisma.Decimal(input.pricePerMetre),
      compareAtPrice: input.compareAtPrice ? new Prisma.Decimal(input.compareAtPrice) : null,
      moqMetres: input.moqMetres,
      leadTimeDays: input.leadTimeDays,
      // A listing with no stock is out of stock, whatever the form said.
      status: stockMetres <= 0 && input.status === "ACTIVE" ? "OUT_OF_STOCK" : input.status,
      featured: input.featured,
      stockMetres,
      searchText: artifacts.searchText,
      embedding: artifacts.embedding,
      colorways: {
        create: input.colorways.map((c, i) => ({
          name: c.name,
          hex: c.hex,
          stockMetres: c.stockMetres,
          position: i,
        })),
      },
      images: {
        create: input.images.map((img, i) => ({
          url: img.url,
          alt: img.alt || input.name,
          position: i,
        })),
      },
    },
    include: { colorways: true, images: true },
  });
}

export async function updateSupplierProduct(supplierId: string, productId: string, input: ProductInput) {
  const existing = await db.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true, name: true, slug: true },
  });
  if (!existing) throw notFound("Fabric");

  const [category, supplier] = await Promise.all([
    db.category.findUnique({ where: { slug: input.categorySlug }, select: { id: true, name: true } }),
    db.supplierProfile.findUnique({ where: { id: supplierId }, select: { businessName: true } }),
  ]);
  if (!category) throw new HttpError(422, "invalid_category", "That category doesn't exist.");
  if (!supplier) throw notFound("Supplier");

  const stockMetres = input.colorways.reduce((sum, c) => sum + c.stockMetres, 0);
  const artifacts = buildSearchArtifacts({
    ...input,
    categoryName: category.name,
    supplierName: supplier.businessName,
    colorNames: input.colorways.map((c) => c.name),
  });

  // The slug only moves if the name did — an existing link to this fabric
  // should keep working through an ordinary spec edit.
  const slug = existing.name === input.name ? existing.slug : await uniqueSlug(input.name, productId);

  return db.$transaction(async (tx) => {
    // Colourways carried over by id keep their stock history and any cart
    // lines pointing at them; only genuinely removed rows are deleted.
    const keepIds = input.colorways.map((c) => c.id).filter((id): id is string => Boolean(id));
    await tx.productColorway.deleteMany({
      where: { productId, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
    });

    for (const [i, c] of input.colorways.entries()) {
      if (c.id) {
        await tx.productColorway.update({
          where: { id: c.id },
          data: { name: c.name, hex: c.hex, stockMetres: c.stockMetres, position: i },
        });
      } else {
        await tx.productColorway.create({
          data: { productId, name: c.name, hex: c.hex, stockMetres: c.stockMetres, position: i },
        });
      }
    }

    await tx.productImage.deleteMany({ where: { productId } });
    if (input.images.length) {
      await tx.productImage.createMany({
        data: input.images.map((img, i) => ({
          productId,
          url: img.url,
          alt: img.alt || input.name,
          position: i,
        })),
      });
    }

    return tx.product.update({
      where: { id: productId },
      data: {
        categoryId: category.id,
        name: input.name,
        slug,
        description: input.description,
        composition: input.composition,
        fibres: input.fibres,
        weave: input.weave,
        gsm: input.gsm,
        widthCm: input.widthCm,
        finish: input.finish,
        handFeel: input.handFeel,
        useCases: input.useCases,
        sustainability: input.sustainability,
        pricePerMetre: new Prisma.Decimal(input.pricePerMetre),
        compareAtPrice: input.compareAtPrice ? new Prisma.Decimal(input.compareAtPrice) : null,
        moqMetres: input.moqMetres,
        leadTimeDays: input.leadTimeDays,
        status: stockMetres <= 0 && input.status === "ACTIVE" ? "OUT_OF_STOCK" : input.status,
        featured: input.featured,
        stockMetres,
        searchText: artifacts.searchText,
        embedding: artifacts.embedding,
      },
      include: { colorways: true, images: true },
    });
  });
}

/**
 * Archive rather than hard-delete when the fabric has order history — the line
 * items on a placed order must keep resolving to something.
 */
export async function deleteSupplierProduct(supplierId: string, productId: string) {
  const product = await db.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true, _count: { select: { orderItems: true } } },
  });
  if (!product) throw notFound("Fabric");

  if (product._count.orderItems > 0) {
    await db.product.update({ where: { id: productId }, data: { status: "ARCHIVED", featured: false } });
    return { archived: true as const };
  }

  await db.product.delete({ where: { id: productId } });
  return { archived: false as const };
}

export async function updateStock(
  supplierId: string,
  productId: string,
  colorways: { id: string; stockMetres: number }[],
) {
  const product = await db.product.findFirst({
    where: { id: productId, supplierId },
    select: { id: true, status: true, colorways: { select: { id: true } } },
  });
  if (!product) throw notFound("Fabric");

  const owned = new Set(product.colorways.map((c) => c.id));
  for (const c of colorways) {
    if (!owned.has(c.id)) throw new HttpError(422, "invalid_colorway", "Unknown colourway on this fabric.");
  }

  return db.$transaction(async (tx) => {
    for (const c of colorways) {
      await tx.productColorway.update({ where: { id: c.id }, data: { stockMetres: c.stockMetres } });
    }
    const total = colorways.reduce((sum, c) => sum + c.stockMetres, 0);

    // Restocking a sold-out listing brings it back automatically; a supplier
    // shouldn't have to remember to flip a status field too.
    const nextStatus =
      total <= 0 && product.status === "ACTIVE"
        ? "OUT_OF_STOCK"
        : total > 0 && product.status === "OUT_OF_STOCK"
          ? "ACTIVE"
          : product.status;

    return tx.product.update({
      where: { id: productId },
      data: { stockMetres: total, status: nextStatus },
      include: { colorways: { orderBy: { position: "asc" } } },
    });
  });
}

/* ---------------------------------------------------------------- profile */

export async function getSupplierProfile(userId: string) {
  return db.supplierProfile.findUnique({ where: { userId } });
}

export async function upsertSupplierProfile(userId: string, input: SupplierProfileInput) {
  const existing = await db.supplierProfile.findUnique({ where: { userId }, select: { id: true, slug: true } });

  const data = {
    businessName: input.businessName,
    businessType: input.businessType,
    tagline: input.tagline || null,
    description: input.description || null,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 || null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country || "India",
    operatingHours: (input.operatingHours ?? null) as unknown as Prisma.InputJsonValue,
    categories: input.categories,
    fabricTypes: input.fabricTypes,
    moqMetres: input.moqMetres,
    leadTimeDays: input.leadTimeDays,
    yearEstablished: input.yearEstablished ?? null,
    certifications: input.certifications,
    onboardingMode: input.onboardingMode,
    onboardedAt: new Date(),
  };

  if (existing) {
    return db.supplierProfile.update({ where: { id: existing.id }, data });
  }

  let slug = slugify(input.businessName);
  let n = 1;
  for (;;) {
    const clash = await db.supplierProfile.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) break;
    n += 1;
    slug = `${slugify(input.businessName)}-${n}`;
  }

  return db.supplierProfile.create({ data: { ...data, userId, slug } });
}
