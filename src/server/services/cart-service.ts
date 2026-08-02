import "server-only";

import { db } from "@/lib/db";
import { HttpError, notFound } from "@/lib/auth/guards";
import { money } from "@/lib/serialize";

/**
 * Cart rules that belong on the server, not in a component:
 *
 *  - Quantity is in metres and is always raised to the mill's MOQ. A buyer who
 *    types 50 against a 300m minimum gets 300, with the cart saying why —
 *    rather than a checkout failure three screens later.
 *  - Adding a product that is already in the cart in the same colourway
 *    increments the existing line instead of creating a duplicate.
 *  - Lines for archived or out-of-stock products stay visible but are flagged,
 *    so a buyer is never silently missing something they chose.
 */

const FREE_SHIPPING_THRESHOLD = 100_000;
const SHIPPING_FEE = 1_800;
const TAX_RATE = 0.05;

export async function getOrCreateCart(buyerId: string) {
  const existing = await db.cart.findUnique({ where: { buyerId }, select: { id: true } });
  if (existing) return existing;
  return db.cart.create({ data: { buyerId }, select: { id: true } });
}

export async function getCart(buyerId: string) {
  const cart = await getOrCreateCart(buyerId);

  const items = await db.cartItem.findMany({
    where: { cartId: cart.id },
    orderBy: { addedAt: "asc" },
    include: {
      colorway: { select: { id: true, name: true, hex: true, stockMetres: true } },
      product: {
        select: {
          id: true, slug: true, name: true, weave: true, gsm: true, widthCm: true,
          composition: true, pricePerMetre: true, moqMetres: true, stockMetres: true,
          leadTimeDays: true, status: true,
          colorways: { select: { id: true, name: true, hex: true }, orderBy: { position: "asc" } },
          images: { select: { url: true, alt: true }, orderBy: { position: "asc" }, take: 1 },
          category: { select: { name: true, slug: true } },
          supplier: { select: { id: true, slug: true, businessName: true, city: true, verified: true, leadTimeDays: true } },
        },
      },
    },
  });

  const lines = items.map((item) => {
    const unitPrice = Number(item.product.pricePerMetre);
    const available = item.colorway?.stockMetres ?? item.product.stockMetres;

    const issues: string[] = [];
    if (item.product.status === "ARCHIVED") issues.push("This fabric has been withdrawn by the mill.");
    else if (item.product.status === "OUT_OF_STOCK" || item.product.stockMetres <= 0) {
      issues.push("Out of stock — the mill needs to weave a fresh lot.");
    } else if (item.quantityMetres > available) {
      issues.push(`Only ${available.toLocaleString("en-IN")}m available in this colourway.`);
    }
    if (item.quantityMetres < item.product.moqMetres) {
      issues.push(`Below this mill's ${item.product.moqMetres}m minimum.`);
    }

    return {
      id: item.id,
      quantityMetres: item.quantityMetres,
      unitPrice,
      lineTotal: money(unitPrice * item.quantityMetres),
      addedAt: item.addedAt,
      colorway: item.colorway,
      product: item.product,
      available,
      issues,
      orderable: issues.length === 0,
    };
  });

  // Grouped by mill, because that is how the order will actually be split and
  // how MOQ and lead time are actually assessed.
  const groups = new Map<string, { supplier: (typeof lines)[number]["product"]["supplier"]; lines: typeof lines; subtotal: number }>();
  for (const line of lines) {
    const key = line.product.supplier.id;
    const group = groups.get(key) ?? { supplier: line.product.supplier, lines: [], subtotal: 0 };
    group.lines.push(line);
    group.subtotal = money(group.subtotal + line.lineTotal);
    groups.set(key, group);
  }

  const subtotal = money(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const shippingFee = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const tax = money(subtotal * TAX_RATE);

  return {
    id: cart.id,
    lines,
    groups: [...groups.values()],
    itemCount: lines.length,
    totalMetres: lines.reduce((sum, l) => sum + l.quantityMetres, 0),
    subtotal,
    shippingFee,
    tax,
    total: money(subtotal + shippingFee + tax),
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    blockers: lines.filter((l) => !l.orderable).length,
  };
}

export async function addToCart(
  buyerId: string,
  input: { productId: string; colorwayId?: string | null; quantityMetres: number },
) {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { id: true, status: true, moqMetres: true, stockMetres: true, name: true },
  });
  if (!product) throw notFound("Fabric");
  if (product.status === "ARCHIVED") {
    throw new HttpError(409, "unavailable", `${product.name} has been withdrawn by the mill.`);
  }

  if (input.colorwayId) {
    const colorway = await db.productColorway.findFirst({
      where: { id: input.colorwayId, productId: product.id },
      select: { id: true },
    });
    if (!colorway) throw notFound("Colourway");
  }

  const cart = await getOrCreateCart(buyerId);
  const quantity = Math.max(input.quantityMetres, product.moqMetres);

  const existing = await db.cartItem.findFirst({
    where: { cartId: cart.id, productId: product.id, colorwayId: input.colorwayId ?? null },
    select: { id: true, quantityMetres: true },
  });

  if (existing) {
    await db.cartItem.update({
      where: { id: existing.id },
      data: { quantityMetres: existing.quantityMetres + quantity },
    });
  } else {
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        colorwayId: input.colorwayId ?? null,
        quantityMetres: quantity,
      },
    });
  }

  return getCart(buyerId);
}

export async function updateCartItem(buyerId: string, itemId: string, quantityMetres: number) {
  const item = await db.cartItem.findFirst({
    where: { id: itemId, cart: { buyerId } },
    select: { id: true, product: { select: { moqMetres: true } } },
  });
  if (!item) throw notFound("Cart item");

  await db.cartItem.update({
    where: { id: item.id },
    data: { quantityMetres: Math.max(quantityMetres, item.product.moqMetres) },
  });

  return getCart(buyerId);
}

export async function removeCartItem(buyerId: string, itemId: string) {
  // Scoped through the cart relation so one buyer can never delete another's
  // line by guessing an id.
  const item = await db.cartItem.findFirst({ where: { id: itemId, cart: { buyerId } }, select: { id: true } });
  if (!item) throw notFound("Cart item");

  await db.cartItem.delete({ where: { id: item.id } });
  return getCart(buyerId);
}

export async function clearCart(buyerId: string) {
  const cart = await getOrCreateCart(buyerId);
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  return getCart(buyerId);
}

export type CartView = Awaited<ReturnType<typeof getCart>>;
