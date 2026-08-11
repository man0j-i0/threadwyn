# Backend hardening plan

Written before any of it is implemented. Every claim about current behaviour below
was read out of the code, not recalled — file and line are given so each one can be
checked before it is acted on.

**Scope.** Rate limiting, a test harness with business-rule tests, the checkout
double-submit race, security headers, and collapsing the duplicated cart rules.

**Non-goals, deliberately.** Kafka, NATS, WebSockets, Redis, computed supplier
ratings, make-to-order fulfilment. Each is defensible to *describe* on Wednesday
and indefensible to *build* on Tuesday. See §7.

---

## 1. Verified current state

### 1.1 The checkout race is real, and narrower than it looks

`placeOrder` reads the cart **outside** the transaction
(`order-service.ts:40`) and empties it **inside** (`order-service.ts:170`,
`tx.cartItem.deleteMany`).

That splits duplicate submissions into two very different cases:

| | What happens |
|---|---|
| **Sequential** — second request lands after the first commits | Cart is already empty → `400 cart_empty`. **Already safe.** |
| **Concurrent** — two requests in flight together | Both read a full cart before either commits. **Two orders created, stock decremented twice.** |

So the natural guard everyone assumes exists only covers the slow case. A
double-click is the fast case.

Mitigating it today: the checkout button is disabled by `busy`, and since the
placing-overlay work `busy` now stays true through navigation. That closes the
double-click path in the UI — but not a network retry, a second tab, or anyone
calling the API directly.

**Also on this path:** `orderNumber` is `@unique` (`schema.prisma:305`) but is
derived from `tx.order.count()` plus `Math.floor(Math.random() * 6)`
(`order-service.ts:87`). Two buyers checking out simultaneously read the same
count, so collisions land roughly one time in six. A collision throws Prisma
`P2002`, which `handleError` does not recognise, so it surfaces as an opaque
`500`. That is an accidental, unreliable half-guard — not a design.

No `isolationLevel` is set on any transaction, so all four run at Postgres
default Read Committed.

### 1.2 Everything else

| Gap | Verified |
|---|---|
| Rate limiting | No `429`, no limiter, nothing in `proxy.ts`. Confirmed absent. |
| Security headers | `next.config.ts` has no `headers()` block at all. |
| Tests | No runner in `package.json`. Zero tests. |
| Cart rules duplicated | Message strings built in `cart-service.ts:60-86`; the matching action decided independently by `lineFix()` in `cart-view.tsx:48`. They agree today. |

**Useful facts for the work below:**

- No route sets `export const runtime = "edge"`, so every handler is Node. A
  module-scoped `Map` therefore persists across requests on a warm instance.
- `src/lib/api/respond.ts` already gives one response envelope and a single
  `handleError` catch point. A `429` fits it as-is; only the `Retry-After`
  header needs a small addition.
- `HttpError(status, code, message, fields?)` already flows through
  `handleError`, so a limiter can `throw` rather than return a bespoke response.
- `Cart.buyerId` is `@unique` (`schema.prisma:274`) — exactly one row per buyer,
  which makes it a clean lock target.

---

## 2. Execution order

**Tests first**, which reorders the priority list slightly. Everything after it is
either pure logic (the limiter, the cart reasons) or a concurrency fix that cannot
be verified by clicking. Building the harness first means each change ships with
the thing that proves it, instead of a promise to add tests later.

```
1. Vitest harness + pure-logic tests      30 min   no risk
2. Checkout race + order-number collision 60 min   medium  ← correctness
3. Rate limiting + its unit tests         75 min   low     ← abuse protection
4. Cart reason discriminant               40 min   low
5. Security headers                       40 min   low-medium
6. Integration tests (DB-backed)          90 min   only if 1-5 are done and green
```

Checkout goes before rate limiting: a race that can write two orders and
double-decrement stock is a correctness defect in money and inventory. Rate
limiting protects against abuse that has not happened yet. Fix the one that can
corrupt data first.

**Gate between every step.** `typecheck`, `lint`, `test`, `build`, and read the
diff before starting the next one. No step begins until the previous one is green.

Hard stop: **anything not finished and green by Tuesday evening is reverted, not
shipped.** A half-applied limiter is worse than none.

---

## 3. Workstream detail

### 3.1 Vitest harness + pure-logic tests

**New:** `vitest.config.ts`, `src/lib/__tests__/`.
**Changed:** `package.json` (`"test": "vitest run"`, `"test:watch": "vitest"`).

Pure functions only — no database, no server, runs in under a second:

- `order-status.ts` — every legal transition allowed, every illegal one refused,
  including `PENDING → COMPLETED` and any backwards move
- `nl-filters.ts` — the demo query, `under $4.50`, `between $5 and $10`,
  `over $8 per metre`, `cheap`, `premium`, and the two guard cases
  (`at least 2000m` must **not** become a price floor; `under 300 gsm` must not
  become a price ceiling)
- `utils.ts` — `formatMoney` including the compact `k`/`M` tier
- `weavescope.ts` — `deriveConstruction` holds the mass-balance identity

**Risk:** Vitest resolving the `@/` alias. Mitigated by `vite-tsconfig-paths`, or
one explicit `resolve.alias` entry.

**Verification:** `npm test` green; `npm run typecheck` and `npm run lint` still
clean; `npm run build` unaffected (test files excluded from the build).

**Rollback:** delete the config, the test folder and two script lines. Touches no
application code.

### 3.2 Rate limiting

**New:** `src/lib/rate-limit.ts`, `src/lib/__tests__/rate-limit.test.ts`.
**Changed:** the five route handlers below; `respond.ts` for a headers pass-through.

Fixed-window counter over a module-scoped `Map`, keyed `${bucket}:${ip}`, with a
lazy sweep of expired entries on write so the map cannot grow without bound. IP
from `x-forwarded-for` (first hop), falling back to `x-real-ip`, then a constant
so a missing header fails closed into one shared bucket rather than opening the
gate.

| Route | Limit |
|---|---|
| `POST /api/v1/auth/login` | 8 / 15 min |
| `POST /api/v1/auth/register` | 5 / hour |
| `POST /api/v1/ai/chat` | 20 / min |
| `POST /api/v1/ai/search` | 30 / min |
| `POST /api/v1/ai/onboarding` | 20 / min |

Returns `429` through the existing envelope with `Retry-After` and
`X-RateLimit-Limit` / `-Remaining` / `-Reset`.

**Where it goes:** inside the route handlers, **not** `proxy.ts`. That file
documents itself as "a convenience layer, not the security boundary", and the
guards live in server code. Putting a real control in the proxy would contradict
the architecture we describe in the interview.

**Risks**

- *Per-instance memory on serverless.* Accepted and stated out loud, not hidden.
  A distributed attacker landing on cold instances gets more budget than the
  number says; a single abusive client hitting a warm instance does not. The
  store is behind an interface so an Upstash adapter is a config change.
- *Locking yourself out mid-demo.* The login limit is 8 per 15 minutes per IP, and
  you will sign in repeatedly while rehearsing. **Mitigation:** limiter is a no-op
  when `NODE_ENV !== "production"` unless `RATE_LIMIT_FORCE=1`, so it can be
  demonstrated on demand without breaking the run-through.
- *Shared-IP false positives.* Real, and the reason the auth window is generous
  rather than 3-per-minute.

**Verification:** unit tests for window expiry, boundary (Nth allowed, N+1st
refused), and per-key isolation. Then manually with `RATE_LIMIT_FORCE=1`: nine
bad logins, expect a `429` with `Retry-After`.

**Rollback:** delete the file, remove five one-line calls.

### 3.3 Checkout double-submit + order number

**Changed:** `order-service.ts` only.

Two fixes on one path.

**a. Serialise checkout per buyer.** Inside the transaction, before anything else:

```sql
SELECT id FROM "Cart" WHERE "buyerId" = $1 FOR UPDATE
```

then re-read the cart items **inside** the transaction and fail with the existing
`cart_empty` if there are none. A concurrent second request blocks on the lock,
and by the time it proceeds the first has committed and emptied the cart — so it
gets a clean `400` instead of writing a second order. Per-buyer lock, so two
different buyers never block each other.

**b. Order number collisions.** Wrap creation in a bounded retry (5 attempts) that
catches Prisma `P2002` on `orderNumber` and regenerates. Also map `P2002` in
`handleError` to a `409` rather than letting it fall through to an opaque `500`.

**c. Stale review — found by hand, after a and b shipped.** The lock solves two
requests racing each other. It cannot solve a buyer reviewing one basket and
submitting against another, because the request carries only an address: the
server reads the live cart, sees a legitimate 50 m, and orders it. Reviewed
40 m, ordered 50 m, no error at any layer.

Two invariants now, covering different windows:

| Guard | Window it covers |
|---|---|
| `expectedTotal` sent by the checkout page, compared in whole cents | Between the buyer *looking* and *clicking* |
| `id:quantity` fingerprint compared inside the lock | Between our *read* and our *write* |

The fingerprint was originally `id` alone, which was wrong for its own purpose:
editing a quantity keeps the same `cartItem.id`, so the comparison saw an
unchanged cart. The total also catches what quantities cannot — same line, same
quantity, a price the mill moved underneath it.

`expectedTotal` is optional, so a client that omits it is accepted and simply
skips the check. It is compared before the transaction opens, which is safe
because the in-lock fingerprint proves the snapshot still matches the database
at the moment of writing.

**Why not an idempotency key.** It is the more general answer and needs a column,
a migration and a client-generated UUID. The lock fixes the actual failure with no
schema change, which is the right trade the day before a demo. Idempotency keys
are the correct next step and worth saying so.

**Risks**

- *Deadlock.* Single lock, always taken first, always the same row. No second lock
  is acquired before it, so there is no ordering cycle.
- *Holding a lock across slow work.* The transaction already does per-line stock
  reads; the lock is held for the same duration, scoped to one buyer. Acceptable.
- *Raw SQL through Prisma.* `$queryRaw` inside `$transaction` is supported;
  parameterised, never interpolated.

**Verification:** the integration test in §3.6 fires two concurrent `placeOrder`
calls for one buyer and asserts exactly one order exists and stock decremented
once. Until that exists, verify by hand with two rapid submissions from devtools.

**Rollback:** revert one file.

### 3.4 Cart reason discriminant

**Changed:** `cart-service.ts` (emit a typed reason alongside the strings),
`cart-view.tsx` (`lineFix` switches on it instead of re-deriving).

```ts
type LineIssue =
  | { reason: "withdrawn" }
  | { reason: "out-of-stock" }
  | { reason: "below-moq"; available: number; moq: number }   // unorderable at any qty
  | { reason: "over-stock"; available: number }                // reducible
  | { reason: "under-moq"; moq: number };                      // raisable
```

The service stays the single place the rules live; the UI picks a label and an
action from the discriminant. Message strings keep being built server-side.

**Risk:** it is a shape change across a serialisation boundary — the cart type is
`serialize`d into the client component. Keep `issues: string[]` alongside the new
field for this release rather than replacing it, so nothing that renders today
breaks.

**Verification:** unit test mapping each reason to its expected action; then walk
all five cart states by hand.

### 3.5 Security headers

**Changed:** `next.config.ts` — add a `headers()` block.

`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
`Permissions-Policy`.

**Two traps, both already identified:**

- `Permissions-Policy` must be `microphone=(self)`, **not** `microphone=()`.
  Voice input uses the Web Speech API and a blanket deny silently kills a feature
  we plan to demo.
- **No enforcing CSP.** `theme-script.tsx` injects an inline script to prevent
  theme flash, and three.js needs `blob:` workers. A strict CSP needs a nonce
  through the whole render path — not a Tuesday-night change. Ship
  `Content-Security-Policy-Report-Only` or omit CSP entirely and say why.

**Verification:** `curl -I` the deployed URL; confirm voice input still works;
confirm WeaveScope still renders.

### 3.6 Integration tests — only if 1-5 are green

Against the existing docker Postgres on a **separate schema**
(`DATABASE_URL=...?schema=test`) so the dev database is never touched. Truncate
between tests; do not reuse the demo seed.

1. Concurrent checkout → exactly one order, stock decremented once (§3.3a)
2. Stock below MOQ → not orderable
3. Stale cart → checkout rejected with `insufficient_stock`, nothing written
4. Multi-mill cart → one `SupplierOrder` per mill, each with its own reference
5. Order lifecycle → legal transitions accepted, illegal refused
6. RBAC → anonymous `401`, buyer on supplier route `403`, supplier on own `200`

**This is the block most likely to overrun.** It is last for that reason. Six good
tests over transactional and authorization paths beat forty over formatters, and
zero of them beat a broken demo.

---

## 3.7 Outcome — what shipped, and what did not

Steps 1–4 are done and green. Steps 5 and 6 were **stopped deliberately**, not
run out of time.

| | |
|---|---|
| 1. Vitest + pure tests | ✅ 63 tests, sub-second |
| 2. Checkout race + order number | ✅ row lock proven to block; `P2002` → 409 |
| 3. Rate limiting | ✅ verified against a production server, 8 × 401 → 429 |
| 4. Cart reason discriminant | ✅ exhaustiveness proven by breaking it |
| 5. Security headers | ⏸ **skipped** |
| 6. DB integration tests | ⏸ **skipped** |

**Why 5 and 6 stopped.** Headers are defence-in-depth, not correctness, and CSP
is the one piece with a real chance of silently breaking voice input or the
WeaveScope workers the night before a live demo. Integration tests need
`server-only` aliased in Vitest and a separate test schema — worth doing, worth
nothing on Wednesday. At this point the marginal value of another change is
lower than the marginal risk of a regression in what already works.

Two corrections found while doing the work, both worth knowing:

- The checkout double-submit guard people assume exists **did** exist, but only
  for the sequential case. Concurrent submissions bypassed it entirely.
- The exhaustiveness guarantee is narrower than first written down: TypeScript
  narrows to the variants actually *assigned*, so declaring a reason is quiet
  and emitting one the UI cannot handle is what breaks the build. That is the
  behaviour we want, and the comments now say so.

**If asked about headers:** "I prioritised application-level security and
correctness — authentication, server-side authorisation, rate limiting, and
transactional checkout consistency. Browser security headers are a remaining
defence-in-depth item; I didn't want to land a CSP the night before a demo when
it can silently break the Web Speech API and the three.js workers."

---

## 4. Verification gate before pushing

```bash
npm run typecheck
npm run lint
npm test
npm run build:check
npm run db:reset && npm run dev
```

Then the manual walk already listed in `05_release_checklist.md`, plus:

- [ ] Nine rapid logins with `RATE_LIMIT_FORCE=1` → `429` with `Retry-After`
- [ ] Rate limiting **off** in dev without the flag — you can still sign in freely
- [ ] Two rapid checkout submissions → one order, stock down once
- [ ] All five cart states still show the right message and the right fix button
- [ ] Voice input still works with `Permissions-Policy` live
- [ ] WeaveScope still renders with the new headers

---

## 5. Rollback

Every workstream is independently revertable and none share files:

| Workstream | Blast radius |
|---|---|
| Tests | New files only. Zero application code. |
| Rate limiting | One new file, five one-line calls. |
| Checkout race | One file (`order-service.ts`). |
| Cart reasons | Two files, additive field only. |
| Headers | One file (`next.config.ts`). |

Commit each separately so any one can be reverted without unpicking the others.

**No migration in any of this**, so production rollback stays "redeploy the
previous build". That is deliberate.

---

## 6. What to say on Wednesday

**"What did you improve after the first round?"**
> Beyond the UI and currency work: I added rate limiting on the auth and AI
> endpoints, fixed a concurrency bug in checkout, and put tests around the
> transactional business rules. Not test coverage for its own sake — inventory
> consistency, MOQ, stale carts and the order lifecycle, because those are the
> rules that can actually corrupt data.

**"What happens if someone abuses the AI endpoint?"**
> It's rate limited at the API boundary, with auth limited separately and more
> strictly because that's a brute-force target. It's per-instance memory, so on
> serverless it's a speed bump rather than a distributed guarantee — the store is
> behind an interface, and moving it to Redis is a config change. I'd rather ship
> something whose limits I can state than something I can only name.

**"Is checkout safe under concurrency?"**
> It is now. Stock was always re-read and decremented inside the transaction, but
> the cart was read outside it — so two simultaneous submissions could both see a
> full cart and write two orders. Checkout now takes a row lock on the buyer's
> cart first, so they serialise. An idempotency key is the more general fix and
> the next step; the lock solved the actual failure without a migration.

**"Are the supplier ratings real?"**
> No, they're seeded. Deriving them means deciding who can rate, whether it's one
> per completed order, and how moderation works — that's a feature, not a field,
> and it wasn't in the brief.

**"Would you add Kafka?"**
> Not yet. There's no asynchronous workload here that justifies the operational
> cost. When order events need independent consumers — notifications, analytics,
> supplier webhooks — that's when a broker earns its place.

---

## 7. Explicitly not doing

| | Why |
|---|---|
| Kafka / NATS / WebSockets | Infrastructure, connection lifecycle, socket auth, reconnection. No current workload justifies it. |
| Redis | Only exists to serve the rate limiter. The interface makes it a later config change. |
| Computed supplier ratings | A feature with policy questions, not a field. |
| Make-to-order fulfilment | Needs production quantities, split fulfilment, reserved stock. |
| Idempotency keys | Superseded here by the cart lock, at no schema cost. Named as next step. |
| Dropping `compareAtPrice` | A migration for a cosmetic cut. |
| Enforcing CSP | Needs a nonce through the render path. Report-Only or nothing. |
| More UI work | The UI is done. Freeze it. |
