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

/**
 * Why a line cannot be ordered, as a value rather than a sentence.
 *
 * The prose in `issues` is for the buyer to read. This is for the UI to act on.
 * They used to be the same thing: the service produced strings, and the cart
 * re-derived the matching action by comparing stock against MOQ a second time.
 * One ruleset in two places, free to drift the moment either side is edited.
 *
 * The service owns the rule; the UI owns the wording and the affordance. The
 * union is closed and the cart switches on it exhaustively, so the moment this
 * function *emits* a reason the cart does not handle, the build fails rather
 * than rendering a flagged line with no way to clear it. (Declaring a variant
 * without producing it is fine and stays quiet — TypeScript narrows `issue` to
 * the set actually assigned, which is the behaviour we want: there is nothing
 * to handle until something can produce it.)
 *
 *   below-moq   stock has fallen under the mill's own minimum, so no quantity
 *               is both above MOQ and within stock — unorderable at any number
 *   over-stock  more was asked for than remains, but the line is salvageable
 *   under-moq   less was asked for than the mill will run
 */
export type LineIssue =
  | { reason: "withdrawn" }
  | { reason: "out-of-stock" }
  | { reason: "below-moq"; available: number; moq: number }
  | { reason: "over-stock"; available: number }
  | { reason: "under-moq"; moq: number };

// USD, matching the catalogue. Freight on a bulk fabric order is really a
// function of weight and lane, but a flat fee above a threshold is the honest
// simplification for a prototype that does not integrate a carrier.
const FREE_SHIPPING_THRESHOLD = 1_200;
const SHIPPING_FEE = 25;
// Export shipments are zero-rated for GST, so this stands in for the duties
// and handling an importing buyer pays — see the label in the order summary.
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

    /**
     * A cart is a snapshot; stock is not. Between adding a line and opening
     * this page the mill can sell the lot, cut it, or withdraw the fabric.
     *
     * So each message names the delta rather than the limit alone: what the
     * buyer asked for, what is there now, and — where the two cannot be
     * reconciled — why. The case worth spelling out is stock falling below the
     * mill's own minimum, because then no quantity works: anything at or above
     * MOQ exceeds stock, anything at or under stock breaches MOQ. Telling
     * someone to "adjust" that is asking them to solve an equation with no
     * answer, so it says the line cannot be ordered and stops there.
     */
    const m = (n: number) => `${n.toLocaleString("en-US")} m`;
    const qty = item.quantityMetres;
    const moq = item.product.moqMetres;

    const issues: string[] = [];
    let issue: LineIssue | null = null;

    if (item.product.status === "ARCHIVED") {
      issue = { reason: "withdrawn" };
      issues.push("This fabric has been withdrawn by the mill and can no longer be ordered.");
    } else if (item.product.status === "OUT_OF_STOCK" || item.product.stockMetres <= 0) {
      issue = { reason: "out-of-stock" };
      issues.push(`Out of stock. Your cart has ${m(qty)}; the mill needs to weave a fresh lot.`);
    } else if (qty > available) {
      issues.push(`Stock changed. Your cart has ${m(qty)}, and only ${m(available)} is available now.`);
      if (available < moq) {
        issue = { reason: "below-moq", available, moq };
        issues.push(`That is under this mill's ${m(moq)} minimum, so it cannot be ordered right now.`);
      } else {
        issue = { reason: "over-stock", available };
      }
    } else if (qty < moq) {
      issue = { reason: "under-moq", moq };
      issues.push(`Your cart has ${m(qty)}, below this mill's ${m(moq)} minimum.`);
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
      issue,
      orderable: issue === null,
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
