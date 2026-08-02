import type { OrderStatus } from "@prisma/client";

/**
 * Order status vocabulary — pure data, no server dependencies.
 *
 * This lives outside `server/services/order-service.ts` deliberately. The
 * supplier's status control is a client component and needs to know which
 * transitions are legal in order to render the right buttons; importing that
 * from the service would drag `server-only`, Prisma and the whole data layer
 * into the browser bundle. Keeping the vocabulary here means both sides read
 * from one definition and neither pulls the other's dependencies.
 *
 * The client uses this to decide what to *show*. The server uses the same map
 * to decide what to *allow* — see `updateOrderStatus`.
 */

export const STATUS_LADDER: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_DISPATCH",
  "COMPLETED",
];

/** Legal next states. A supplier cannot skip a stage or walk one backwards. */
export const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY_FOR_DISPATCH: "Ready for dispatch",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const STATUS_TONES: Record<
  OrderStatus,
  "neutral" | "info" | "warn" | "brand" | "positive" | "danger"
> = {
  PENDING: "warn",
  ACCEPTED: "info",
  PREPARING: "brand",
  READY_FOR_DISPATCH: "brand",
  COMPLETED: "positive",
  CANCELLED: "danger",
};

/**
 * A buyer's order fans out to several mills at different stages. The status
 * they see is the *least advanced* one — telling someone their order is
 * complete while a mill is still cutting would be a lie.
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

export function defaultStatusNote(status: OrderStatus) {
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
