import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RATE_RULES,
  __resetRateLimits,
  clientKey,
  hit,
  rateLimitEnabled,
  rateLimitHeaders,
  type RateRule,
} from "./rate-limit";

/**
 * Counters live for the life of the process, so every test starts from a clean
 * map. Without this the suite would pass in isolation and fail in order.
 */
beforeEach(__resetRateLimits);

const rule: RateRule = { name: "test", limit: 3, windowMs: 1000 };

describe("hit", () => {
  it("allows exactly the limit, then refuses", () => {
    const now = 1_000_000;
    expect(hit("a", rule, now).ok).toBe(true);
    expect(hit("a", rule, now).ok).toBe(true);
    expect(hit("a", rule, now).ok).toBe(true);
    // The boundary is the whole point: the Nth request is allowed, the N+1st
    // is not. Off by one here is either a lockout or an open door.
    expect(hit("a", rule, now).ok).toBe(false);
  });

  it("counts down remaining and floors it at zero", () => {
    const now = 1_000_000;
    expect(hit("a", rule, now).remaining).toBe(2);
    expect(hit("a", rule, now).remaining).toBe(1);
    expect(hit("a", rule, now).remaining).toBe(0);
    expect(hit("a", rule, now).remaining).toBe(0);
  });

  it("keeps separate keys apart", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) hit("a", rule, now);
    expect(hit("a", rule, now).ok).toBe(false);
    // One caller exhausting their budget must not lock out everyone else.
    expect(hit("b", rule, now).ok).toBe(true);
  });

  it("keeps separate rules apart even for the same caller", () => {
    const now = 1_000_000;
    const other: RateRule = { name: "other", limit: 3, windowMs: 1000 };
    for (let i = 0; i < 4; i++) hit("a", rule, now);
    expect(hit("a", rule, now).ok).toBe(false);
    // Burning the login budget must not also block search.
    expect(hit("a", other, now).ok).toBe(true);
  });

  it("opens a fresh window once the old one expires", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) hit("a", rule, now);
    expect(hit("a", rule, now).ok).toBe(false);

    // One millisecond before the window rolls over, still refused.
    expect(hit("a", rule, now + rule.windowMs - 1).ok).toBe(false);
    // On the boundary, allowed again.
    expect(hit("a", rule, now + rule.windowMs).ok).toBe(true);
  });

  it("reports a retry-after that shrinks as the window drains", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) hit("a", rule, now);

    const early = hit("a", rule, now + 100);
    const late = hit("a", rule, now + 800);
    expect(early.retryAfterSeconds).toBeGreaterThanOrEqual(late.retryAfterSeconds);
    // Never zero — a client told to wait 0 seconds retries immediately.
    expect(late.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("does not let the reset time drift while a window is open", () => {
    const now = 1_000_000;
    const first = hit("a", rule, now);
    const second = hit("a", rule, now + 500);
    // A fixed window, not a sliding one: later requests must not push the
    // reset out, or a steady stream of calls would never let the window close.
    expect(second.resetAt).toBe(first.resetAt);
  });
});

describe("configured rules", () => {
  it("limits auth more tightly than the AI routes", () => {
    expect(RATE_RULES.login.limit).toBeLessThan(RATE_RULES.aiChat.limit);
    expect(RATE_RULES.register.windowMs).toBeGreaterThan(RATE_RULES.login.windowMs);
  });

  it("gives every rule a distinct bucket name", () => {
    const names = Object.values(RATE_RULES).map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("clientKey", () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request("https://threadwyn.test/api", { headers });

  it("takes the first hop from x-forwarded-for", () => {
    expect(clientKey(withHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKey(withHeaders({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("fails closed into one shared bucket when there is no address", () => {
    // Stricter than intended, never looser — the right direction to fail.
    expect(clientKey(withHeaders({}))).toBe("unknown");
  });
});

describe("headers", () => {
  it("sends Retry-After only once the caller is over", () => {
    const now = 1_000_000;
    const allowed = hit("a", rule, now);
    expect(rateLimitHeaders(allowed)["Retry-After"]).toBeUndefined();
    expect(rateLimitHeaders(allowed)["X-RateLimit-Remaining"]).toBe("2");

    for (let i = 0; i < 3; i++) hit("a", rule, now);
    const refused = hit("a", rule, now);
    expect(refused.ok).toBe(false);
    expect(Number(rateLimitHeaders(refused)["Retry-After"])).toBeGreaterThan(0);
  });
});

describe("rateLimitEnabled", () => {
  const original = process.env.RATE_LIMIT_FORCE;
  afterEach(() => {
    if (original === undefined) delete process.env.RATE_LIMIT_FORCE;
    else process.env.RATE_LIMIT_FORCE = original;
  });

  it("is off in development by default, so a rehearsal cannot lock you out", () => {
    delete process.env.RATE_LIMIT_FORCE;
    expect(rateLimitEnabled()).toBe(false);
  });

  it("can be forced on locally to demonstrate it", () => {
    process.env.RATE_LIMIT_FORCE = "1";
    expect(rateLimitEnabled()).toBe(true);
  });
});
