import "server-only";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { readSession, type SessionPayload } from "./session";

/**
 * Authorisation is enforced here, in server code, on every protected read and
 * write. `middleware.ts` also redirects unauthenticated users, but that is a
 * UX convenience — it is not the security boundary and must never be the only
 * check standing between a buyer and a supplier's order queue.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const unauthorized = () => new HttpError(401, "unauthorized", "Sign in to continue.");
export const forbidden = () => new HttpError(403, "forbidden", "You do not have access to this resource.");
export const notFound = (what = "Resource") => new HttpError(404, "not_found", `${what} not found.`);

/* ------------------------------------------------------------ API guards */

export async function requireSession(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) throw unauthorized();
  return session;
}

export async function requireBuyer(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "BUYER") throw forbidden();
  return session;
}

/** Returns the session plus the supplier's *profile id*, which is what every
 *  supplier-scoped query filters on. Resolving it here means no route handler
 *  has to remember the user-id → profile-id hop. */
export async function requireSupplier(): Promise<{ session: SessionPayload; supplierId: string }> {
  const session = await requireSession();
  if (session.role !== "SUPPLIER") throw forbidden();

  const profile = await db.supplierProfile.findUnique({
    where: { userId: session.sub },
    select: { id: true },
  });
  if (!profile) throw new HttpError(409, "profile_missing", "Complete supplier onboarding first.");

  return { session, supplierId: profile.id };
}

/* ------------------------------------------------- page-level guards (RSC) */

export async function pageSession() {
  return readSession();
}

export async function requirePageSession(next?: string) {
  const session = await readSession();
  if (!session) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return session;
}

export async function requireBuyerPage(next?: string) {
  const session = await requirePageSession(next);
  if (session.role !== "BUYER") redirect("/supplier");
  return session;
}

export async function requireSupplierPage(next?: string) {
  const session = await requirePageSession(next);
  if (session.role !== "SUPPLIER") redirect("/marketplace");

  const profile = await db.supplierProfile.findUnique({
    where: { userId: session.sub },
    select: { id: true, onboardedAt: true, businessName: true },
  });
  if (!profile) redirect("/supplier/onboarding");

  return { session, profile };
}
