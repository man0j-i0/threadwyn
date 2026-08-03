import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import { CATEGORIES, PRODUCTS, SUPPLIERS, colorValue } from "./seed-data";
import { embedLocal } from "../src/lib/ai/embed";

const db = new PrismaClient();

/** Deterministic PRNG so every seed run produces the same demo state. */
let rngState = 20260802;
function rnd() {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}
function between(min: number, max: number) {
  return Math.floor(min + rnd() * (max - min + 1));
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The lexical haystack and the semantic vector are both derived from the same
 * text, so keyword search and vector search agree about what a product "is".
 */
function searchDocument(p: {
  name: string;
  description: string;
  composition: string;
  weave: string;
  finish: string;
  handFeel: string;
  useCases: string[];
  fibres: string[];
  sustainability: string[];
  gsm: number;
  categoryName: string;
  supplierName: string;
  colorNames: string[];
}) {
  return [
    p.name,
    p.categoryName,
    p.composition,
    p.fibres.join(" "),
    p.weave.toLowerCase(),
    `${p.gsm} gsm`,
    p.gsm < 120 ? "lightweight light sheer summer" : p.gsm > 300 ? "heavyweight heavy winter durable" : "midweight",
    p.finish,
    p.handFeel,
    p.useCases.join(" "),
    p.sustainability.join(" "),
    p.colorNames.join(" "),
    p.supplierName,
    p.description,
  ]
    .join(" \n ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("→ clearing existing data");
  // Order matters: children before parents, since not every FK cascades.
  await db.aiMessage.deleteMany();
  await db.aiConversation.deleteMany();
  await db.orderEvent.deleteMany();
  await db.orderItem.deleteMany();
  await db.supplierOrder.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.productImage.deleteMany();
  await db.productColorway.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.supplierProfile.deleteMany();
  await db.buyerProfile.deleteMany();
  await db.uploadedImage.deleteMany();
  await db.user.deleteMany();

  /* ----------------------------------------------------------- categories */

  console.log("→ categories");
  const categoryBySlug = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await db.category.create({
      data: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        blurb: c.blurb,
        accentHex: c.accentHex,
        position: i,
        featured: "featured" in c ? Boolean(c.featured) : false,
      },
    });
    categoryBySlug.set(c.slug, row.id);
  }

  /* ------------------------------------------------------------ suppliers */

  console.log("→ suppliers");
  const passwordHash = await bcrypt.hash("threadwyn", 10);
  const supplierBySlug = new Map<string, { id: string; name: string }>();

  for (const [i, s] of SUPPLIERS.entries()) {
    const hours = {
      mon: { open: s.hours.standard.split("-")[0]!, close: s.hours.standard.split("-")[1]! },
      tue: { open: s.hours.standard.split("-")[0]!, close: s.hours.standard.split("-")[1]! },
      wed: { open: s.hours.standard.split("-")[0]!, close: s.hours.standard.split("-")[1]! },
      thu: { open: s.hours.standard.split("-")[0]!, close: s.hours.standard.split("-")[1]! },
      fri: { open: s.hours.standard.split("-")[0]!, close: s.hours.standard.split("-")[1]! },
      sat:
        "sat" in s.hours && s.hours.sat
          ? { open: s.hours.sat.split("-")[0]!, close: s.hours.sat.split("-")[1]! }
          : null,
      sun: null,
    };

    const user = await db.user.create({
      data: {
        email: `supplier${i + 1}@threadwyn.dev`,
        passwordHash,
        name: s.businessName,
        role: "SUPPLIER",
        avatarHue: (i * 47) % 360,
        supplierProfile: {
          create: {
            businessName: s.businessName,
            slug: s.slug,
            businessType: s.businessType,
            tagline: s.tagline,
            description: s.description,
            contactEmail: s.contactEmail,
            contactPhone: s.contactPhone,
            addressLine1: s.addressLine1,
            addressLine2: "addressLine2" in s ? (s.addressLine2 as string) : null,
            city: s.city,
            state: s.state,
            postalCode: s.postalCode,
            country: "India",
            operatingHours: hours as unknown as Prisma.InputJsonValue,
            categories: [...s.categories],
            fabricTypes: [...s.fabricTypes],
            moqMetres: s.moqMetres,
            leadTimeDays: s.leadTimeDays,
            yearEstablished: s.yearEstablished,
            certifications: [...s.certifications],
            verified: s.verified,
            rating: s.rating,
            ratingCount: s.ratingCount,
            onboardingMode: "form",
            onboardedAt: new Date(Date.now() - between(60, 900) * 86_400_000),
          },
        },
      },
      include: { supplierProfile: true },
    });

    supplierBySlug.set(s.slug, { id: user.supplierProfile!.id, name: s.businessName });
  }

  /* ------------------------------------------------------------- products */

  console.log("→ products");
  const productIds: { id: string; supplierId: string; price: number; name: string; slug: string }[] = [];

  for (const p of PRODUCTS) {
    const supplier = supplierBySlug.get(p.supplier)!;
    const categoryId = categoryBySlug.get(p.category)!;
    const categoryName = CATEGORIES.find((c) => c.slug === p.category)!.name;
    const colors = p.colors.map(colorValue);

    const doc = searchDocument({
      name: p.name,
      description: p.description,
      composition: p.composition,
      weave: p.weave,
      finish: p.finish,
      handFeel: p.handFeel,
      useCases: p.useCases,
      fibres: p.fibres,
      sustainability: p.sustainability ?? [],
      gsm: p.gsm,
      categoryName,
      supplierName: supplier.name,
      colorNames: colors.map((c) => c.name),
    });

    // Stock lives on the colourways; the product-level figure is their sum.
    const perColor = colors.map((_, idx) =>
      p.stock === 0 ? 0 : Math.max(0, Math.round((p.stock / colors.length) * (0.72 + rnd() * 0.56)) - idx * 3),
    );
    const totalStock = perColor.reduce((a, b) => a + b, 0);

    const product = await db.product.create({
      data: {
        supplierId: supplier.id,
        categoryId,
        name: p.name,
        slug: slugify(`${p.name}-${p.supplier}`),
        description: p.description,
        composition: p.composition,
        fibres: p.fibres,
        weave: p.weave,
        gsm: p.gsm,
        widthCm: p.widthCm,
        finish: p.finish,
        handFeel: p.handFeel,
        useCases: p.useCases,
        sustainability: p.sustainability ?? [],
        pricePerMetre: p.price,
        compareAtPrice: p.compareAt ?? null,
        moqMetres: p.moq,
        stockMetres: totalStock,
        leadTimeDays: p.leadTime,
        status: p.status ?? "ACTIVE",
        featured: p.featured ?? false,
        searchText: doc.toLowerCase(),
        embedding: embedLocal(doc),
        viewCount: between(18, 940),
        colorways: {
          create: colors.map((c, idx) => ({
            name: c.name,
            hex: c.hex,
            stockMetres: perColor[idx]!,
            position: idx,
          })),
        },
      },
    });

    productIds.push({
      id: product.id,
      supplierId: supplier.id,
      price: p.price,
      name: p.name,
      slug: product.slug,
    });
  }

  /* ---------------------------------------------------------------- users */

  console.log("→ demo buyers");
  const buyerSeeds = [
    {
      email: "buyer@threadwyn.dev",
      name: "Anaya Rao",
      businessName: "Marigold Apparel",
      businessType: "BRAND",
      industry: "Womenswear",
      city: "Bengaluru",
      categoryInterest: ["linen", "silk-satin", "shirting"],
      preferredFabrics: ["linen", "silk", "cotton"],
      typicalOrderQty: "500-2000",
      budgetMin: 200,
      budgetMax: 900,
      notes: "Small-batch resort collections. Cares about natural fibres and certification.",
    },
    {
      email: "buyer2@threadwyn.dev",
      name: "Devansh Mehta",
      businessName: "Northline Uniforms",
      businessType: "MANUFACTURER",
      industry: "Corporate uniforms",
      city: "Pune",
      categoryInterest: ["suiting", "shirting", "canvas-workwear"],
      preferredFabrics: ["polyester", "cotton", "blend"],
      typicalOrderQty: "10000-plus",
      budgetMin: 100,
      budgetMax: 400,
      notes: "Volume tenders. Optimises for repeatable shade matching and price.",
    },
  ];

  const buyers: { id: string; name: string }[] = [];
  for (const [i, b] of buyerSeeds.entries()) {
    const user = await db.user.create({
      data: {
        email: b.email,
        passwordHash,
        name: b.name,
        role: "BUYER",
        avatarHue: (i * 137) % 360,
        buyerProfile: {
          create: {
            businessName: b.businessName,
            businessType: b.businessType,
            industry: b.industry,
            city: b.city,
            categoryInterest: b.categoryInterest,
            preferredFabrics: b.preferredFabrics,
            typicalOrderQty: b.typicalOrderQty,
            budgetMin: b.budgetMin,
            budgetMax: b.budgetMax,
            notes: b.notes,
            onboardingMode: "conversation",
            onboardedAt: new Date(Date.now() - between(10, 200) * 86_400_000),
          },
        },
        cart: { create: {} },
      },
    });
    buyers.push({ id: user.id, name: b.name });
  }

  /* --------------------------------------------------------------- orders */

  console.log("→ order history");
  const STATUSES = ["COMPLETED", "COMPLETED", "READY_FOR_DISPATCH", "PREPARING", "ACCEPTED", "PENDING"] as const;

  let orderSeq = 4310;
  for (let o = 0; o < 14; o++) {
    const buyer = buyers[o % buyers.length]!;
    const placedAt = new Date(Date.now() - between(1, 120) * 86_400_000);

    // Two or three lines, sometimes spanning suppliers — which is exactly the
    // case the SupplierOrder split exists to handle.
    const lineCount = between(2, 4);
    const chosen = new Map<string, typeof productIds>();
    for (let i = 0; i < lineCount; i++) {
      const p = pick(productIds);
      const list = chosen.get(p.supplierId) ?? [];
      if (!list.some((x) => x.id === p.id)) list.push(p);
      chosen.set(p.supplierId, list);
    }

    let subtotal = 0;
    const groups: { supplierId: string; items: { p: (typeof productIds)[number]; qty: number }[] }[] = [];
    for (const [supplierId, list] of chosen) {
      const items = list.map((p) => ({ p, qty: between(1, 12) * 100 }));
      subtotal += items.reduce((sum, it) => sum + it.p.price * it.qty, 0);
      groups.push({ supplierId, items });
    }

    const shippingFee = subtotal > 100_000 ? 0 : 1800;
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    orderSeq += between(3, 29);
    const orderNumber = `TW-${orderSeq.toString(36).toUpperCase().padStart(5, "0")}`;

    const order = await db.order.create({
      data: {
        orderNumber,
        buyerId: buyer.id,
        subtotal,
        shippingFee,
        tax,
        total: subtotal + shippingFee + tax,
        shippingName: buyer.name,
        shippingCompany: o % 2 === 0 ? "Marigold Apparel" : "Northline Uniforms",
        shippingPhone: "+91 98450 22119",
        shippingEmail: buyerSeeds[o % buyers.length]!.email,
        shippingLine1: o % 2 === 0 ? "14 Residency Road" : "Plot 22, MIDC Bhosari",
        shippingCity: o % 2 === 0 ? "Bengaluru" : "Pune",
        shippingState: o % 2 === 0 ? "Karnataka" : "Maharashtra",
        shippingPostalCode: o % 2 === 0 ? "560025" : "411026",
        placedAt,
      },
    });

    for (const [gi, group] of groups.entries()) {
      const status = STATUSES[Math.min(STATUSES.length - 1, Math.floor(rnd() * STATUSES.length))]!;
      const groupSubtotal = group.items.reduce((sum, it) => sum + it.p.price * it.qty, 0);

      const supplierOrder = await db.supplierOrder.create({
        data: {
          orderId: order.id,
          supplierId: group.supplierId,
          reference: `${orderNumber}-${gi + 1}`,
          status,
          subtotal: groupSubtotal,
          createdAt: placedAt,
          expectedReadyAt:
            status === "PENDING" ? null : new Date(placedAt.getTime() + between(6, 22) * 86_400_000),
          items: {
            create: await Promise.all(
              group.items.map(async (it) => {
                const full = (await db.product.findUnique({
                  where: { id: it.p.id },
                  include: { colorways: true },
                }))!;
                const cw = full.colorways[0];
                return {
                  productId: full.id,
                  productName: full.name,
                  productSlug: full.slug,
                  colorwayName: cw?.name ?? null,
                  colorwayHex: cw?.hex ?? null,
                  composition: full.composition,
                  gsm: full.gsm,
                  widthCm: full.widthCm,
                  weave: full.weave,
                  unitPrice: full.pricePerMetre,
                  quantityMetres: it.qty,
                  lineTotal: Number(full.pricePerMetre) * it.qty,
                };
              }),
            ),
          },
        },
      });

      // Rebuild the timeline up to the current status so the tracker has a
      // real history rather than one lonely dot.
      const ladder = ["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_DISPATCH", "COMPLETED"] as const;
      const upTo = ladder.indexOf(status as (typeof ladder)[number]);
      for (let s = 0; s <= upTo; s++) {
        await db.orderEvent.create({
          data: {
            supplierOrderId: supplierOrder.id,
            status: ladder[s]!,
            actor: s === 0 ? "buyer" : "supplier",
            note:
              s === 0
                ? "Order placed"
                : s === 1
                  ? "Accepted — stock confirmed against this lot"
                  : s === 2
                    ? "Cutting and rolling in progress"
                    : s === 3
                      ? "Rolled, wrapped and labelled for dispatch"
                      : "Handed to carrier",
            createdAt: new Date(placedAt.getTime() + s * between(1, 4) * 86_400_000),
          },
        });
      }
    }
  }

  /* ------------------------------------------------------------- warm cart */

  console.log("→ demo cart");
  const demoBuyer = buyers[0]!;
  const cart = await db.cart.findUnique({ where: { buyerId: demoBuyer.id } });
  if (cart) {
    const featured = await db.product.findMany({
      where: { featured: true, status: "ACTIVE" },
      include: { colorways: true },
      take: 2,
    });
    for (const p of featured) {
      await db.cartItem.create({
        data: {
          cartId: cart.id,
          productId: p.id,
          colorwayId: p.colorways[0]?.id ?? null,
          quantityMetres: Math.max(p.moqMetres, 500),
        },
      });
    }
  }

  const counts = {
    categories: await db.category.count(),
    suppliers: await db.supplierProfile.count(),
    products: await db.product.count(),
    colorways: await db.productColorway.count(),
    orders: await db.order.count(),
    supplierOrders: await db.supplierOrder.count(),
  };

  console.log("\n✓ seed complete");
  console.table(counts);
  console.log("\n  buyer     buyer@threadwyn.dev / threadwyn");
  console.log("  supplier  supplier1@threadwyn.dev / threadwyn\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
