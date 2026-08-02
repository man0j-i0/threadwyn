import "server-only";

import { OrderStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { HttpError, notFound } from "@/lib/auth/guards";
import { money } from "@/lib/serialize";
import type { CheckoutInput } from "@/lib/validation/schemas";
import { getCart } from "./cart-service";

/**
 * Status transitions are an explicit adjacency map, not a free-form string
 * update. A supplier cannot skip PREPARING, cannot walk an order backwards,
 * and cannot cancel something already dispatched. Encoding it here — rather
 * than only disabling buttons in the UI — means the rule holds against a
 * hand-rolled API call too.
 */
export const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const STATUS_LADDER: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_DISPATCH",
  "COMPLETED",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY_FOR_DISPATCH: "Ready for dispatch",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const STATUS_TONES: Record<OrderStatus, "neutral" | "info" | "warn" | "brand" | "positive" | "danger"> = {
  PENDING: "warn",
  ACCEPTED: "info",
  PREPARING: "brand",
  READY_FOR_DISPATCH: "brand",
  COMPLETED: "positive",
  CANCELLED: "danger",
};

function orderNumberFrom(seq: number) {
  return `TW-${seq.toString(36).toUpperCase().padStart(5, "0")}`;
}

/**
 * Checkout.
 *
 * Everything below happens inside one transaction: stock is re-read and
 * decremented, the order is written, the cart is emptied. If any line has gone
 * out of stock since the buyer loaded the page, the whole thing rolls back and
 * they are told which fabric caused it — rather than being sold cloth that
 * does not exist.
 */
export async function placeOrder(buyerId: string, input: CheckoutInput) {
  const cart = await getCart(buyerId);

  if (cart.lines.length === 0) {
    throw new HttpError(400, "cart_empty", "Your cart is empty.");
  }
  if (cart.blockers > 0) {
    const first = cart.lines.find((l) => !l.orderable);
    throw new HttpError(
      409,
      "cart_blocked",
      `${first?.product.name ?? "One item"} can't be ordered right now: ${first?.issues[0] ?? "unavailable"}`,
    );
  }

  return db.$transaction(async (tx) => {
    // Re-read stock inside the transaction. The cart view was a snapshot; this
    // is the value we are actually allowed to decrement.
    for (const line of cart.lines) {
      const fresh = await tx.product.findUnique({
        where: { id: line.product.id },
        select: { stockMetres: true, status: true, name: true },
      });
      if (!fresh || fresh.status === "ARCHIVED") {
        throw new HttpError(409, "unavailable", `${line.product.name} is no longer available.`);
      }
      if (fresh.stockMetres < line.quantityMetres) {
        throw new HttpError(
          409,
          "insufficient_stock",
          `${line.product.name} only has ${fresh.stockMetres}m left — please reduce the quantity.`,
        );
      }
      if (line.colorway) {
        const freshColour = await tx.productColorway.findUnique({
          where: { id: line.colorway.id },
          select: { stockMetres: true, name: true },
        });
        if (!freshColour || freshColour.stockMetres < line.quantityMetres) {
          throw new HttpError(
            409,
            "insufficient_stock",
            `${line.product.name} in ${line.colorway.name} only has ${freshColour?.stockMetres ?? 0}m left.`,
          );
        }
      }
    }

    const count = await tx.order.count();
    const orderNumber = orderNumberFrom(4300 + count * 7 + Math.floor(Math.random() * 6));

    const order = await tx.order.create({
      data: {
        orderNumber,
        buyerId,
        subtotal: new Prisma.Decimal(cart.subtotal),
        shippingFee: new Prisma.Decimal(cart.shippingFee),
        tax: new Prisma.Decimal(cart.tax),
        total: new Prisma.Decimal(cart.total),
        shippingName: input.shippingName,
        shippingCompany: input.shippingCompany || null,
        shippingPhone: input.shippingPhone,
        shippingEmail: input.shippingEmail,
        shippingLine1: input.shippingLine1,
        shippingLine2: input.shippingLine2 || null,
        shippingCity: input.shippingCity,
        shippingState: input.shippingState,
        shippingPostalCode: input.shippingPostalCode,
        shippingCountry: input.shippingCountry || "India",
        deliveryNotes: input.deliveryNotes || null,
      },
    });

    // One SupplierOrder per mill — each gets its own reference, status and
    // timeline, and each supplier only ever sees their own.
    for (const [index, group] of cart.groups.entries()) {
      const supplierOrder = await tx.supplierOrder.create({
        data: {
          orderId: order.id,
          supplierId: group.supplier.id,
          reference: `${orderNumber}-${index + 1}`,
          status: "PENDING",
          subtotal: new Prisma.Decimal(group.subtotal),
          items: {
            create: group.lines.map((line) => ({
              productId: line.product.id,
              productName: line.product.name,
              productSlug: line.product.slug,
              colorwayName: line.colorway?.name ?? null,
              colorwayHex: line.colorway?.hex ?? null,
              composition: line.product.composition,
              gsm: line.product.gsm,
              widthCm: line.product.widthCm,
              weave: line.product.weave,
              unitPrice: new Prisma.Decimal(line.unitPrice),
              quantityMetres: line.quantityMetres,
              lineTotal: new Prisma.Decimal(line.lineTotal),
            })),
          },
        },
      });

      await tx.orderEvent.create({
        data: {
          supplierOrderId: supplierOrder.id,
          status: "PENDING",
          actor: "buyer",
          note: "Order placed — awaiting the mill's confirmation",
        },
      });
    }

    // Decrement stock. Colourway-level first, then the product roll-up.
    for (const line of cart.lines) {
      if (line.colorway) {
        await tx.productColorway.update({
          where: { id: line.colorway.id },
          data: { stockMetres: { decrement: line.quantityMetres } },
        });
      }
      const updated = await tx.product.update({
        where: { id: line.product.id },
        data: { stockMetres: { decrement: line.quantityMetres } },
        select: { stockMetres: true, status: true },
      });
      // Hitting zero flips the listing, which is what raises the supplier's
      // inventory alert on their dashboard.
      if (updated.stockMetres <= 0 && updated.status === "ACTIVE") {
        await tx.product.update({ where: { id: line.product.id }, data: { status: "OUT_OF_STOCK" } });
      }
    }

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return { orderNumber: order.orderNumber, orderId: order.id };
  });
}

/* ------------------------------------------------------------- buyer reads */

const ORDER_INCLUDE = {
  supplierOrders: {
    orderBy: { reference: "asc" },
    include: {
      supplier: { select: { businessName: true, slug: true, city: true, verified: true, contactEmail: true, contactPhone: true } },
      items: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  },
} satisfies Prisma.OrderInclude;

export async function getBuyerOrders(buyerId: string) {
  return db.order.findMany({
    where: { buyerId },
    orderBy: { placedAt: "desc" },
    include: ORDER_INCLUDE,
  });
}

export async function getBuyerOrder(buyerId: string, orderNumber: string) {
  const order = await db.order.findFirst({
    where: { orderNumber, buyerId },
    include: ORDER_INCLUDE,
  });
  if (!order) throw notFound("Order");
  return order;
}

/**
 * A parent order has several sub-orders at different stages. The buyer-facing
 * status is the *least advanced* one — "your order is complete" would be a lie
 * while one mill is still cutting.
 */
export function rollupStatus(statuses: OrderStatus[]): OrderStatus {
  const live = statuses.filter((s) => s !== "CANCELLED");
  if (live.length === 0) return "CANCELLED";
  let lowest = STATUS_LADDER.length - 1;
  for (const s of live) {
    const idx = STATUS_LADDER.indexOf(s);
    if (idx !== -1 && idx < lowest) lowest = idx;
  }
  return STATUS_LADDER[lowest]!;
}

/* --------------------------------------------------------- supplier writes */

export async function getSupplierOrders(supplierId: string, status?: OrderStatus) {
  return db.supplierOrder.findMany({
    where: { supplierId, ...(status ? { status } : {}) },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      items: true,
      events: { orderBy: { createdAt: "desc" }, take: 1 },
      order: {
        select: {
          orderNumber: true,
          placedAt: true,
          shippingName: true,
          shippingCompany: true,
          shippingCity: true,
          shippingState: true,
          buyer: { select: { name: true, email: true } },
        },
      },
    },
  });
}

export async function getSupplierOrder(supplierId: string, reference: string) {
  const supplierOrder = await db.supplierOrder.findFirst({
    // Scoped by supplierId as well as reference — guessing a reference from
    // another mill returns a 404, not somebody else's order.
    where: { reference, supplierId },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      order: {
        select: {
          orderNumber: true,
          placedAt: true,
          shippingName: true,
          shippingCompany: true,
          shippingPhone: true,
          shippingEmail: true,
          shippingLine1: true,
          shippingLine2: true,
          shippingCity: true,
          shippingState: true,
          shippingPostalCode: true,
          shippingCountry: true,
          deliveryNotes: true,
          buyer: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!supplierOrder) throw notFound("Order");
  return supplierOrder;
}

export async function updateOrderStatus(
  supplierId: string,
  reference: string,
  next: OrderStatus,
  note?: string,
  expectedReadyAt?: Date | null,
) {
  const current = await db.supplierOrder.findFirst({
    where: { reference, supplierId },
    select: { id: true, status: true, items: { select: { productId: true, quantityMetres: true } } },
  });
  if (!current) throw notFound("Order");

  const allowed = STATUS_FLOW[current.status];
  if (!allowed.includes(next)) {
    throw new HttpError(
      409,
      "invalid_transition",
      `An order that is "${STATUS_LABELS[current.status]}" can only move to ${
        allowed.length ? allowed.map((s) => `"${STATUS_LABELS[s]}"`).join(" or ") : "nothing — it is final"
      }.`,
    );
  }

  return db.$transaction(async (tx) => {
    const updated = await tx.supplierOrder.update({
      where: { id: current.id },
      data: {
        status: next,
        ...(note ? { supplierNote: note } : {}),
        ...(expectedReadyAt !== undefined ? { expectedReadyAt } : {}),
      },
    });

    await tx.orderEvent.create({
      data: {
        supplierOrderId: current.id,
        status: next,
        actor: "supplier",
        note: note || defaultNote(next),
      },
    });

    // Cancelling returns the cloth to stock — otherwise a supplier declining an
    // order would quietly destroy inventory.
    if (next === "CANCELLED") {
      for (const item of current.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stockMetres: { increment: item.quantityMetres } },
        });
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockMetres: true, status: true },
        });
        if (product && product.status === "OUT_OF_STOCK" && product.stockMetres > 0) {
          await tx.product.update({ where: { id: item.productId }, data: { status: "ACTIVE" } });
        }
      }
    }

    return updated;
  });
}

function defaultNote(status: OrderStatus) {
  switch (status) {
    case "ACCEPTED":
      return "Accepted — stock confirmed against this lot";
    case "PREPARING":
      return "Cutting and rolling in progress";
    case "READY_FOR_DISPATCH":
      return "Rolled, wrapped and labelled for dispatch";
    case "COMPLETED":
      return "Handed to carrier";
    case "CANCELLED":
      return "Cancelled by the mill — stock returned";
    default:
      return "Order placed";
  }
}

/* ------------------------------------------------------ supplier dashboard */

export async function getSupplierMetrics(supplierId: string) {
  const [products, active, lowStock, outOfStock, pending, inFlight, completed, recent, revenue] =
    await Promise.all([
      db.product.count({ where: { supplierId, status: { not: "ARCHIVED" } } }),
      db.product.count({ where: { supplierId, status: "ACTIVE" } }),
      db.product.findMany({
        where: { supplierId, status: "ACTIVE", stockMetres: { lt: 500, gt: 0 } },
        select: { id: true, name: true, slug: true, stockMetres: true, moqMetres: true },
        orderBy: { stockMetres: "asc" },
        take: 6,
      }),
      db.product.count({ where: { supplierId, status: "OUT_OF_STOCK" } }),
      db.supplierOrder.count({ where: { supplierId, status: "PENDING" } }),
      db.supplierOrder.count({
        where: { supplierId, status: { in: ["ACCEPTED", "PREPARING", "READY_FOR_DISPATCH"] } },
      }),
      db.supplierOrder.count({ where: { supplierId, status: "COMPLETED" } }),
      db.supplierOrder.findMany({
        where: { supplierId },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          items: { select: { productName: true, quantityMetres: true } },
          order: { select: { orderNumber: true, placedAt: true, shippingName: true, shippingCity: true } },
        },
      }),
      db.supplierOrder.aggregate({
        where: { supplierId, status: { not: "CANCELLED" } },
        _sum: { subtotal: true },
      }),
    ]);

  // Last 12 weeks of order value, for the dashboard trend.
  const since = new Date(Date.now() - 84 * 86_400_000);
  const rows = await db.supplierOrder.findMany({
    where: { supplierId, createdAt: { gte: since }, status: { not: "CANCELLED" } },
    select: { createdAt: true, subtotal: true },
  });

  const weeks: { label: string; value: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const end = new Date(Date.now() - w * 7 * 86_400_000);
    const start = new Date(end.getTime() - 7 * 86_400_000);
    const value = rows
      .filter((r) => r.createdAt >= start && r.createdAt < end)
      .reduce((sum, r) => sum + Number(r.subtotal), 0);
    weeks.push({
      label: end.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      value: money(value),
    });
  }

  return {
    products,
    active,
    outOfStock,
    lowStock,
    pending,
    inFlight,
    completed,
    recent,
    revenue: money(Number(revenue._sum.subtotal ?? 0)),
    trend: weeks,
  };
}
