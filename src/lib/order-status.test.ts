import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";

import { STATUS_FLOW, STATUS_LADDER, rollupStatus } from "./order-status";

/**
 * The order state machine.
 *
 * This map is read twice: the supplier console reads it to decide which buttons
 * to render, and `updateOrderStatus` reads it to decide what to allow. So these
 * tests are guarding the server boundary, not the UI — a supplier hand-rolling
 * an API call must not be able to skip a stage, reverse one, or cancel cloth
 * that has already left the mill.
 */

const ALL: OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY_FOR_DISPATCH",
  "COMPLETED",
  "CANCELLED",
];

const legal = (from: OrderStatus, to: OrderStatus) => STATUS_FLOW[from].includes(to);

describe("STATUS_FLOW", () => {
  it("advances exactly one rung at a time", () => {
    expect(legal("PENDING", "ACCEPTED")).toBe(true);
    expect(legal("ACCEPTED", "PREPARING")).toBe(true);
    expect(legal("PREPARING", "READY_FOR_DISPATCH")).toBe(true);
    expect(legal("READY_FOR_DISPATCH", "COMPLETED")).toBe(true);
  });

  it("refuses every skipped stage", () => {
    // The obvious abuse: mark it done without ever preparing it.
    expect(legal("PENDING", "COMPLETED")).toBe(false);
    expect(legal("PENDING", "PREPARING")).toBe(false);
    expect(legal("PENDING", "READY_FOR_DISPATCH")).toBe(false);
    expect(legal("ACCEPTED", "READY_FOR_DISPATCH")).toBe(false);
    expect(legal("ACCEPTED", "COMPLETED")).toBe(false);
    expect(legal("PREPARING", "COMPLETED")).toBe(false);
  });

  it("refuses every backwards move", () => {
    for (let i = 0; i < STATUS_LADDER.length; i++) {
      for (let j = 0; j < i; j++) {
        expect(legal(STATUS_LADDER[i]!, STATUS_LADDER[j]!)).toBe(false);
      }
    }
  });

  it("refuses a transition to itself", () => {
    for (const status of ALL) {
      expect(legal(status, status)).toBe(false);
    }
  });

  it("allows cancelling only before dispatch", () => {
    expect(legal("PENDING", "CANCELLED")).toBe(true);
    expect(legal("ACCEPTED", "CANCELLED")).toBe(true);
    expect(legal("PREPARING", "CANCELLED")).toBe(true);
    // Cloth is already wrapped and labelled by this point. Cancelling would
    // return stock the mill has physically committed.
    expect(legal("READY_FOR_DISPATCH", "CANCELLED")).toBe(false);
    expect(legal("COMPLETED", "CANCELLED")).toBe(false);
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(STATUS_FLOW.COMPLETED).toHaveLength(0);
    expect(STATUS_FLOW.CANCELLED).toHaveLength(0);
  });

  it("covers every status, so a new one cannot be added without a decision", () => {
    for (const status of ALL) {
      expect(STATUS_FLOW[status]).toBeDefined();
    }
  });
});

describe("rollupStatus", () => {
  it("reports the least advanced mill, never the most", () => {
    // The whole point: one mill finishing early must not read as the order
    // being done while another is still cutting.
    expect(rollupStatus(["COMPLETED", "PENDING"])).toBe("PENDING");
    expect(rollupStatus(["COMPLETED", "PREPARING"])).toBe("PREPARING");
    expect(rollupStatus(["READY_FOR_DISPATCH", "ACCEPTED"])).toBe("ACCEPTED");
  });

  it("is complete only when every mill is", () => {
    expect(rollupStatus(["COMPLETED", "COMPLETED"])).toBe("COMPLETED");
  });

  it("ignores cancelled children when live ones remain", () => {
    // A mill dropping out does not stall the mills still working.
    expect(rollupStatus(["CANCELLED", "PREPARING"])).toBe("PREPARING");
    expect(rollupStatus(["CANCELLED", "COMPLETED"])).toBe("COMPLETED");
  });

  it("is cancelled only when every child is", () => {
    expect(rollupStatus(["CANCELLED", "CANCELLED"])).toBe("CANCELLED");
    expect(rollupStatus([])).toBe("CANCELLED");
  });

  it("handles a single mill", () => {
    expect(rollupStatus(["PENDING"])).toBe("PENDING");
    expect(rollupStatus(["COMPLETED"])).toBe("COMPLETED");
  });
});
