import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodSchema } from "zod";

import { HttpError } from "@/lib/auth/guards";
import { serialize } from "@/lib/serialize";
import {
  clientKey,
  hit,
  rateLimitEnabled,
  rateLimitHeaders,
  type RateRule,
} from "@/lib/rate-limit";

/**
 * Every endpoint answers in one of exactly two shapes:
 *   success → { data: … }
 *   failure → { error: { code, message, fields? } }
 *
 * so a client never has to guess how a given route reports a problem.
 */

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data: serialize(data) }, { status: 200, ...init });
}

export function created<T>(data: T) {
  return NextResponse.json({ data: serialize(data) }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error: { code, message, ...(fields ? { fields } : {}) } },
    { status, ...(headers ? { headers } : {}) },
  );
}

/**
 * Rate-limit gate for a route handler.
 *
 * Returns a ready `429` when the caller is over the limit, or `null` to carry
 * on — so a handler adds one line and an early return, and the limit is visible
 * at the top of the route rather than buried in middleware.
 *
 * It deliberately does not throw. A `429` has to carry `Retry-After` and the
 * `X-RateLimit-*` headers, and `handleError` maps exceptions to bodies, not
 * headers.
 */
export function rateLimit(req: Request, rule: RateRule) {
  if (!rateLimitEnabled()) return null;

  const result = hit(clientKey(req), rule);
  if (result.ok) return null;

  return fail(
    429,
    "rate_limited",
    `Too many requests. Try again in ${result.retryAfterSeconds} seconds.`,
    undefined,
    rateLimitHeaders(result),
  );
}

/**
 * Single catch point for route handlers. Known failures map to their status;
 * anything unexpected is logged server-side and returned as an opaque 500 —
 * stack traces and Prisma messages must never reach a client.
 */
export function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return fail(err.status, err.code, err.message, err.fields);
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".") || "_";
      if (!fields[path]) fields[path] = issue.message;
    }
    return fail(422, "validation_failed", "Please check the highlighted fields.", fields);
  }

  // A unique-constraint violation is a conflict, not a server fault. Left
  // unmapped it reached the client as an opaque 500, which is both the wrong
  // status and the wrong story — the request was answerable, it just lost a
  // race. The field is never echoed back: constraint names are schema detail.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    console.error("[api] unique constraint violation", err.meta?.target);
    return fail(409, "conflict", "That conflicted with an existing record. Please try again.");
  }

  console.error("[api] unhandled error", err);
  return fail(500, "internal_error", "Something went wrong on our side. Please try again.");
}

/** Parses and validates a JSON body, throwing a ZodError that `handleError`
 *  turns into a 422 with per-field messages. */
export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

/** Parses query params against a schema, coercing the usual string-y values. */
export function parseQueryParams<T>(url: string, schema: ZodSchema<T>): T {
  const params = new URL(url).searchParams;
  const raw: Record<string, string> = {};
  for (const [k, v] of params.entries()) raw[k] = v;
  return schema.parse(raw);
}
