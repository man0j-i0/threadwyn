/**
 * Fixed-window rate limiting for the endpoints that cost something to abuse.
 *
 * Two kinds of endpoint need it, for different reasons. Authentication is a
 * brute-force target: unlimited password attempts against a known email is the
 * whole attack. The AI routes are expensive — each one can reach an inference
 * provider, so an unthrottled loop is someone else spending your quota.
 *
 * **The store is a module-scoped Map, and that is a real limitation, not an
 * oversight.** Each serverless instance keeps its own counters, so a
 * distributed attacker spread across cold starts gets more budget than the
 * numbers below suggest. What it does stop is the actual threat model here: one
 * client hammering one endpoint, which lands on a warm instance and is counted.
 * Moving to Redis or Upstash means replacing `hit()` with an async call to a
 * shared store; nothing above it changes.
 *
 * Windows are fixed rather than sliding. A fixed window lets a caller burst
 * across a boundary — up to 2× the limit in a short span. That is an accepted
 * trade for a counter that costs one map lookup and holds one integer per key.
 */

export type RateRule = {
  /** Distinguishes counters so login and register never share a bucket. */
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
};

const MINUTE = 60_000;

export const RATE_RULES = {
  login: { name: "login", limit: 8, windowMs: 15 * MINUTE },
  register: { name: "register", limit: 5, windowMs: 60 * MINUTE },
  aiChat: { name: "ai-chat", limit: 20, windowMs: MINUTE },
  aiSearch: { name: "ai-search", limit: 30, windowMs: MINUTE },
  aiOnboarding: { name: "ai-onboarding", limit: 20, windowMs: MINUTE },
} as const satisfies Record<string, RateRule>;

type Counter = { count: number; resetAt: number };

const counters = new Map<string, Counter>();

/**
 * Drop expired counters while writing, so the map cannot grow without bound on
 * a long-lived instance. Cheap because it only runs on a miss, and only walks
 * the map once the entry count is large enough to be worth walking.
 */
const SWEEP_THRESHOLD = 5_000;

function sweep(now: number) {
  if (counters.size < SWEEP_THRESHOLD) return;
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key);
  }
}

export type RateResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms at which the window rolls over. */
  resetAt: number;
  /** Whole seconds until the window rolls over, floored at 1. */
  retryAfterSeconds: number;
};

/**
 * Record one request against a key. Pure apart from the module map and the
 * clock, which is injectable so the window logic can be tested without waiting
 * out real time.
 */
export function hit(key: string, rule: RateRule, now = Date.now()): RateResult {
  const composite = `${rule.name}:${key}`;
  const existing = counters.get(composite);

  if (!existing || existing.resetAt <= now) {
    sweep(now);
    const resetAt = now + rule.windowMs;
    counters.set(composite, { count: 1, resetAt });
    return {
      ok: true,
      limit: rule.limit,
      remaining: rule.limit - 1,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(rule.windowMs / 1000)),
    };
  }

  existing.count += 1;
  const remaining = Math.max(0, rule.limit - existing.count);
  return {
    ok: existing.count <= rule.limit,
    limit: rule.limit,
    remaining,
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Off in development unless asked for.
 *
 * You sign in repeatedly while rehearsing a demo, and eight attempts per
 * quarter hour would lock you out of your own run-through. `RATE_LIMIT_FORCE=1`
 * turns it on locally so it can be demonstrated deliberately.
 *
 * Read per call rather than at module load, so a test can toggle it.
 */
export function rateLimitEnabled(): boolean {
  return process.env.NODE_ENV === "production" || process.env.RATE_LIMIT_FORCE === "1";
}

/**
 * The caller's address, as far as it can be trusted.
 *
 * `x-forwarded-for` is a client-settable header everywhere except behind a
 * proxy that overwrites it — which Vercel does, so on the deployment the first
 * entry is the real peer. With no header at all every caller collapses into one
 * shared bucket: stricter than intended, never looser, which is the right way
 * for this to fail.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitHeaders(result: RateResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.ok ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

/** Test-only. Counters live for the process, so a suite has to clear them. */
export function __resetRateLimits() {
  counters.clear();
}
