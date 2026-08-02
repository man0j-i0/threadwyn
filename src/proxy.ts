import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Route-level gate (Next 16 renamed this convention from `middleware` to
 * `proxy`). It exists so a signed-out user is bounced to /login before a
 * protected page starts rendering, and so a buyer never sees a flash of the
 * supplier console.
 *
 * It is a convenience layer, not the security boundary: every protected read
 * and write re-checks the session and role in server code (see
 * `lib/auth/guards.ts`). This gate can be sidestepped by calling the API
 * directly, so it is never trusted on its own.
 */

const BUYER_PREFIXES = ["/dashboard", "/cart", "/checkout", "/orders", "/onboarding"];
const SUPPLIER_PREFIXES = ["/supplier"];
const AUTH_PAGES = ["/login", "/register"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  const isBuyerRoute = BUYER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isSupplierRoute = SUPPLIER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Already signed in? Auth pages are pointless — send them where they belong.
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL(homeFor(session.role, session.onboarded), req.url));
  }

  if (!isBuyerRoute && !isSupplierRoute) return NextResponse.next();

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (isBuyerRoute && session.role !== "BUYER") {
    return NextResponse.redirect(new URL("/supplier", req.url));
  }
  if (isSupplierRoute && session.role !== "SUPPLIER") {
    return NextResponse.redirect(new URL("/marketplace", req.url));
  }

  // Nudge unfinished profiles into onboarding, but never trap them there.
  const onboardingPath = session.role === "BUYER" ? "/onboarding" : "/supplier/onboarding";
  if (!session.onboarded && !pathname.startsWith(onboardingPath)) {
    return NextResponse.redirect(new URL(onboardingPath, req.url));
  }

  return NextResponse.next();
}

function homeFor(role: "BUYER" | "SUPPLIER", onboarded: boolean) {
  if (!onboarded) return role === "BUYER" ? "/onboarding" : "/supplier/onboarding";
  return role === "BUYER" ? "/dashboard" : "/supplier";
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/orders/:path*",
    "/onboarding/:path*",
    "/supplier/:path*",
    "/login",
    "/register",
  ],
};
