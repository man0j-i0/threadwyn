import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "threadwyn_session";
export const ANON_COOKIE = "threadwyn_anon";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  /** Whether onboarding has been completed — drives the post-login redirect. */
  onboarded: boolean;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Copy .env.example to .env and set it.",
    );
  }
  return new TextEncoder().encode(value);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("threadwyn")
    .setAudience("threadwyn-app")
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

/**
 * Verifies a token. Used both by route handlers (Node) and by middleware
 * (Edge) — which is precisely why this uses `jose` rather than `jsonwebtoken`.
 */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "threadwyn",
      audience: "threadwyn-app",
    });
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      onboarded: Boolean(payload.onboarded),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * Same read, memoised for the lifetime of one request.
 *
 * A product grid renders 24 cards and each needs to know whether the viewer
 * can buy. Without this that is 24 JWT verifications for one answer that
 * cannot change mid-render.
 */
export const readSessionCached = cache(readSession);

/**
 * A stable id for signed-out visitors so the AI assistant can keep conversation
 * context before they create an account. Deliberately not httpOnly-sensitive:
 * it carries no authority, only continuity.
 */
export async function readOrCreateAnonId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(ANON_COOKIE)?.value;
  if (existing) return existing;

  const id = `anon_${crypto.randomUUID()}`;
  store.set(ANON_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return id;
}
