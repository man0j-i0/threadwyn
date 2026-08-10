# Threadwyn — Technical & Functional Reference

Everything in this document was read out of the code, not recalled. Where
something is missing or weak, it says so.

- [1. Tech stack](#1-tech-stack)
- [2. Why this stack](#2-why-this-stack)
- [3. Alternatives considered](#3-alternatives-considered)
- [4. Production readiness](#4-production-readiness)
- [5. Reusable components](#5-reusable-components)
- [6. SOLID](#6-solid)
- [7. What to improve next](#7-what-to-improve-next)
- [8. Functional flows](#8-functional-flows)
- [9. Technical reference](#9-technical-reference)
- [10. Landing page, header and the WeaveScope entry point](#10-landing-page-header-and-the-weavescope-entry-point)

Scale: 4,516 lines under `src/app`, 12,374 under `src/components`, 3,207 under
`src/lib`, 1,586 in `prisma`. 20 Prisma models and enums, 21 database indexes,
19 API route handlers, 23 pages, 51 components.

---

## 1. Tech stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router (RSC, Turbopack) | 16.2.12 |
| Runtime | React | 19.2.4 |
| Language | TypeScript (strict) | 5.x |
| Backend | Next.js route handlers on Node | — |
| ORM | Prisma | 6.16.2 (pinned) |
| Database | PostgreSQL (Neon, serverless) | 17 |
| Auth | `jose` HS256 JWT in an httpOnly cookie | 6.2.7 |
| Hashing | `bcryptjs` | 3.0.3 |
| Validation | `zod`, shared client + server | 4.4.3 |
| Styling | Tailwind CSS v4 (`@theme inline`) | 4.x |
| Animation | Motion (Framer) | 12.43.0 |
| 3D | three.js + React Three Fiber + postprocessing | 0.185 / 9.7 |
| Icons | Phosphor | 2.1.10 |
| AI | Hugging Face Inference Router → Ollama → rules | — |
| Model | `Qwen/Qwen2.5-7B-Instruct` (Apache 2.0) | — |
| Hosting | Vercel `sin1` + Neon `ap-southeast-1` | — |

No UI component library. No state management library. No API layer library.
Those are absences by choice, explained below.

---

## 2. Why this stack

**Next.js App Router as both frontend and backend.** The brief asked for a
React frontend and a Node backend. Running a separate Express service would
mean two deploys, a CORS surface, duplicated types across a network boundary,
and hand-written data fetching for every page. Route handlers *are* Node — the
same runtime, the same `src/server/services/*` modules — reached by an import
on a page and by HTTP from the browser. One type system end to end, one deploy,
one URL.

**Server Components as the default.** A marketplace is read-heavy and its data
is not secret-per-keystroke: catalogue, facets, supplier profiles. Rendering
those on the server means the browser downloads markup, not a JSON payload plus
the code to turn it into markup. Client components are used only where
interactivity demands it — filters, cart, the assistant, the 3D scene — and
each is a leaf, not a wrapper.

**Prisma.** The schema is the single source of truth for the database *and* the
TypeScript types. `OrderStatus` is one enum, understood by Postgres, by the
service layer, and by the supplier's status buttons. Getting that alignment by
hand across raw SQL and hand-written interfaces is where drift lives.

**Postgres.** The domain is relational to its core — an order fans out to
several suppliers, each with its own line items and its own event timeline.
That is three joins and a foreign key, not a document. Decimal columns for
money, enums for status, and real transactional guarantees at checkout.

**`jose` rather than `jsonwebtoken`.** `src/proxy.ts` runs on the Edge runtime,
where Node's `crypto` is unavailable. `jose` uses WebCrypto and therefore
verifies the same token in both the Edge gate and the Node route handlers —
one implementation, no second code path to keep in sync.

**Zod once, used twice.** `src/lib/validation/schemas.ts` is imported by the
forms and by the route handlers. The browser gets instant field errors; the
server re-validates because the browser is not trustworthy. One schema, so the
two can never disagree about what a valid product is.

**Tailwind v4 with a design token layer.** `@theme inline` puts the palette,
type ramp and radii in CSS custom properties, so `bg-surface` and `text-ink`
resolve differently in light and dark without a single `dark:` variant in most
components. Dark mode is a token swap, not a second stylesheet.

**A hand-built component layer instead of a library.** The brief rewards visual
distinctiveness. Shipping shadcn or MUI means shipping a look that a judge has
already seen several times that day, and then fighting it to look otherwise.
`src/components/ui/*` is ten primitives, roughly 1,200 lines total — less than
the CSS we would have written to override someone else's opinions.

**Three-tier AI, not one.** `src/lib/ai/provider.ts` tries Hugging Face, then a
local Ollama, then a deterministic rule engine. The demo therefore works with
no token, with no network, and when a rate limit is hit mid-judging. The AI is
an enhancement to the product, never a dependency of it.

---

## 3. Alternatives considered

| Decision | Alternative | Why not |
|---|---|---|
| Next.js fullstack | React SPA + separate Express API | Two deploys, CORS, duplicated types, manual data fetching. No gain at this size. |
| Next.js fullstack | Remix | Comparable. Next has the larger RSC ecosystem and first-class Vercel deployment. |
| Prisma | Drizzle | Faster and lighter, closer to SQL. Prisma's generated types and migration ergonomics matter more here than raw query speed. |
| Prisma | Raw `pg` + SQL | Full control, no engine binary. Hand-maintaining types across 20 models is exactly the drift Prisma removes. |
| PostgreSQL | MongoDB | The domain is relational. Order → SupplierOrder → OrderItem with per-supplier isolation is a join problem. |
| JWT cookie | NextAuth / Auth.js | Heavy for two roles and email+password. Also opaque — hand-rolling made the RBAC boundary explicit and reviewable. |
| JWT cookie | Server-side session table | More revocable, but adds a database read to every request. A 14-day JWT with role claims is the right trade for a marketplace demo. |
| Own components | shadcn/ui | Excellent, and instantly recognisable. Distinctiveness was a scoring criterion. |
| Own components | MUI / Chakra | Opinionated visual language that would fight the design direction. |
| Tailwind v4 | CSS Modules | No token layer, no dark-mode-by-variable, far more files. |
| Local embeddings | pgvector | The right answer at scale. Requires an extension and a re-embed pipeline; 60 products rank fine in memory. |
| Hugging Face | OpenAI / Anthropic | The brief explicitly preferred an open-source model. Qwen2.5-7B is Apache 2.0. |
| three.js | Pre-rendered video | Cheaper, but not interactive, and the fabric parameters come from real catalogue rows. |

---

## 4. Production readiness

### What is genuinely production-grade

**Authorisation is enforced server-side, on every protected read and write.**
`src/lib/auth/guards.ts` is the boundary. `src/proxy.ts` also redirects, and
its own comment says it is "a convenience layer, not the security boundary".
Verified four ways: anonymous → `/dashboard` redirects to `/login`; a buyer →
`/supplier` redirects to `/marketplace`; anonymous API call returns 401; a
buyer calling a supplier API returns 403.

**Supplier data isolation.** `requireSupplier()` resolves the session's user id
to a `SupplierProfile.id` once, and every supplier query filters on it —
`findFirst({ where: { reference, supplierId } })`, never `findUnique({ where:
{ reference } })` followed by a check. A supplier cannot read another mill's
order even by guessing a reference, because the row is not in their result set
to begin with.

**Checkout is transactional.** `placeOrder` runs inside `db.$transaction`,
re-reads stock *inside* the transaction rather than trusting the cart snapshot,
and fails with a 409 rather than overselling. Cancellation returns stock and
flips `OUT_OF_STOCK` back to `ACTIVE`.

**The order state machine is enforced, not suggested.** `STATUS_FLOW` in
`src/lib/order-status.ts` defines legal transitions. The client reads it to
decide which buttons to render; the server reads the same map to decide what to
allow, and returns a 409 `invalid_transition` otherwise. A crafted request
cannot skip a stage.

**Errors never leak internals.** `handleError` maps `HttpError` and `ZodError`
to their statuses; anything else is logged server-side and returned as an
opaque 500. No stack traces, no Prisma messages.

**Price is snapshotted at checkout.** `OrderItem` copies price, composition,
GSM, width and weave onto the line. A supplier editing a product cannot rewrite
the history of an order already placed.

**Money is `Decimal`, never float.** Prisma `Decimal` in the schema,
`Prisma.Decimal` at write time, serialised at the edge by `src/lib/serialize.ts`.

**Indexes exist and match the queries.** 21 of them, including the composite
`[categoryId, status]`, `[supplierId, status]`, `[status, featured]` and
`[buyerId, placedAt]` that the actual filter and sort paths use.

**Secrets fail loudly.** `AUTH_SECRET` under 32 characters throws at boot
rather than signing with a weak key.

**Graceful degradation is real, not claimed.** The AI falls back through three
tiers and the UI reports honestly which one answered. `AI_TIMEOUT_MS` keeps our
own timeout below the platform's function ceiling so the fallback always wins
the race.

### Performance

Measured on the live deployment, warm, after the region fix:

| Route | Before | After |
|---|---|---|
| `/` | 4.3 – 9.3 s | **0.27 – 0.54 s** |
| `/marketplace` | 1.0 – 1.3 s | **0.23 – 0.50 s** |
| `/marketplace?category=…&gsmMax=…` | 0.85 – 1.09 s | **0.22 – 0.28 s** |

The fix was that Vercel defaulted functions to `iad1` (Washington DC) while the
database is in Singapore, so every query crossed the Pacific. `vercel.json`
pins `sin1`. The landing page additionally had a second sequential `await` that
paid that toll twice; it now joins the existing `Promise.all`.

Other performance properties:

- Queries are parallelised with `Promise.all` wherever they are independent.
- `readSessionCached` is `React.cache()`, so a 24-card grid verifies the JWT
  once per request rather than 24 times.
- The 256-float embedding vector is stripped from every product row before it
  crosses the wire.
- three.js is dynamically imported, client-only, and gated on in-view.
- Marketplace results are paginated in the database when no text query is
  present; with one, 240 candidates are ranked in memory and then sliced.
- `optimizePackageImports` for Phosphor and Motion.

### What is not production-grade — honestly

| Gap | Impact |
|---|---|
| **Zero automated tests** | The largest gap by far. Everything above was verified by hand. Nothing stops a regression. |
| **No rate limiting** | `/api/v1/auth/login` can be brute-forced. Needs a limiter before real users. |
| **No CSRF tokens** | Mitigated by `sameSite: "lax"` and JSON-only endpoints, not eliminated. |
| **No CI** | Typecheck, lint and build are run manually. |
| **No dependency injection** | Services import the `db` singleton directly. Testable only by mocking the module. |
| **JWT cannot be revoked** | A 14-day token stays valid until expiry. No session table, no denylist. |
| **Unpaginated lists** | `getBuyerOrders`, `listSupplierProducts` and the supplier directory return every row. Fine at seed scale, not at 10,000. The directory filters client-side for the same reason. |
| **Images in Postgres** | `UploadedImage` stores bytes in the database, against Neon's 0.5 GB. |
| **No observability** | No error tracking, no structured logging, no metrics. |
| **`embed()` is dead code** | The Hugging Face embedding upgrade is written and wired but never called — search uses `embedLocal` throughout. |
| **No payment integration** | Checkout records an order; it does not take money. |

---

## 5. Reusable components

### `src/components/ui/*` — the primitive layer

| Component | Reused by | What makes it reusable |
|---|---|---|
| `button.tsx` | Every form, dialog, toolbar, empty state | `Button` and `ButtonLink` share variants/sizes; the link version renders `<a>` so navigation is never a fake button. |
| `field.tsx` | Every form in the app | `Field`, `Input`, `Select`, `Textarea`, `ChipGroup`, `CheckboxControl`. `Field` owns the label/hint/error/`aria-describedby` wiring via a render prop, so no form re-implements accessible labelling. |
| `card.tsx` | Dashboards, marketplace, orders | `Card`, `SectionHeading` — consistent surface, radius, shadow. |
| `badge.tsx` | Order status, stock, verification, categories | Tone-driven (`neutral`/`info`/`warn`/`brand`/`positive`/`danger`) rather than colour-driven, so status semantics live in one map. |
| `dialog.tsx` | Confirm destructive actions, product editor | Focus trap, escape handling, scroll lock. |
| `toast.tsx` | Every mutation across both consoles | Context provider + `useToast()`. Any component signals success or failure without owning the UI. |
| `empty-state.tsx` | Empty cart, no orders, no results, no inventory | One shape for "nothing here yet" including the recovery action. |
| `skeleton.tsx` / `spinner.tsx` | Route `loading.tsx` files, in-flight buttons | Consistent loading vocabulary. |

### Domain components reused across roles or routes

| Component | Used in |
|---|---|
| `product/product-card.tsx` | Landing, marketplace, similar products, compare |
| `product/fabric-swatch.tsx` | Cards, PDP, cart lines, order lines, supplier inventory |
| `product/stock-pill.tsx` | Cards, PDP, inventory table, cart |
| `orders/status-timeline.tsx` | Buyer order detail **and** supplier order detail |
| `motion/reveal.tsx` | `Reveal`, `Stagger`, `StaggerItem`, `MaskedHeading` — the entire scroll-animation vocabulary, used across every marketing surface |
| `layout/site-header.tsx` | Every buyer-facing page; splits server (session read) from `site-header-client.tsx` (interaction) |
| `ai/assistant-dock.tsx` | Mounted globally; takes an optional `productSlug` to narrow its context |
| `home/fabric-wheel.tsx` | The dial on the landing page: every hero fabric on an arc, the selected one lifted out, and the only entry point to WeaveScope |
| `home/category-card.tsx` | Category tile that cross-fades to the real rendered material on hover |
| `suppliers/supplier-directory.tsx` | The mill list plus its client-side search |
| `weavescope/*` | `loom-scene`/`loom-stage` on `/weavescope/[slug]`, reached from the dial |

### Reusable non-component modules

- `src/lib/order-status.ts` — status vocabulary and the transition map, shared
  by client and server *specifically* so the client doesn't import the service
  and drag Prisma into the browser bundle.
- `src/lib/validation/schemas.ts` — every zod schema, imported by both sides.
- `src/lib/api/respond.ts` — `ok`/`created`/`fail`/`handleError`/`parseBody`,
  used by all 19 route handlers.
- `src/lib/ai/mode-label.ts` — the three-state provenance label, used by four
  client components.
- `src/lib/marketplace-params.ts` — URL ↔ filter object, used by the page, the
  filter panel, the toolbar and the assistant's `searchHref`.
- `src/lib/weave.ts` / `weavescope.ts` — weave geometry derived from real
  product rows, used by the swatch renderer and the 3D scene.

---

## 6. SOLID

### Single Responsibility — followed closely

The clearest evidence is the layering: **route handler → guard → service →
Prisma**. A handler parses, authorises and responds; it never contains business
logic. `src/app/api/v1/ai/onboarding/route.ts` is 30 lines and its only
decisions are "is this the right role" and "hand it to `extractProfile`".

`src/lib/auth/session.ts` does tokens and cookies. `guards.ts` does
authorisation. `respond.ts` does HTTP shape. `order-service.ts` does order
lifecycle. Nothing overlaps.

The sharpest instance is `src/lib/order-status.ts`, extracted precisely because
a client component needed the transition map and importing it from the service
pulled `server-only` and Prisma into the browser bundle — a production build
caught it.

### Open/Closed — followed in the extension points

- `provider.ts` exposes `ProviderKind = "huggingface" | "ollama" | "none"`.
  Adding a provider means adding a branch and a URL, not touching `assistant.ts`
  or `onboarding.ts`.
- `buildWhere(filters)` in `product-service.ts` composes a Prisma `where` from a
  filter object. A new facet is a new clause; no caller changes.
- `STATUS_FLOW` is data. A new order stage is a map entry — the UI derives its
  buttons and the server derives its permission from the same edit.
- `badge.tsx` is tone-driven, so a new status needs a map entry, not a new
  component.

### Liskov — barely exercised

There is almost no inheritance. The one hierarchy is `HttpError extends Error`,
and it substitutes correctly: `handleError` catches `unknown`, and code that
only knows about `Error` still reads `.message`. `ButtonLink` and `Button` share
a props contract and are interchangeable wherever either is valid.

### Interface Segregation — followed via Prisma `select`

No route receives a fat object it doesn't need. `PRODUCT_CARD_SELECT` is the
narrow projection for grids; the PDP uses a wider include; `requireSupplier()`
selects `{ id: true }` and nothing else. Consumers depend on exactly the shape
they use. `Field`'s render prop passes only the wiring a control needs.

### Dependency Inversion — **partially, and this is the weakest of the five**

*Where it holds:*

- Callers of `complete()` depend on an abstraction, not on Hugging Face. Swap
  the provider and `assistant.ts` is untouched.
- `extractProfile` depends on the `complete()` contract and the zod schema, not
  on a vendor SDK.
- Client components depend on `modeLabel(mode, model)`, not on how provenance
  is determined.
- The client depends on `STATUS_FLOW` as data, not on the service that enforces it.

*Where it does not:*

Services import the `db` singleton directly from `@/lib/db`. There is no
repository interface and no injected client:

```ts
import { db } from "@/lib/db";
export async function getBuyerOrders(buyerId: string) {
  return db.order.findMany({ … });
}
```

Testing `placeOrder` in isolation would require mocking the module, not passing
a fake. A repository interface plus constructor injection would fix it. It was
not done, and at this size the honest trade was fewer layers over textbook
inversion — but it is the reason "no automated tests" and "no DI" are the same
finding wearing two hats.

---

## 7. What to improve next

**Ordered by value, highest first.**

1. **Tests.** Start with `placeOrder` (oversell, blocked cart, multi-supplier
   fan-out, stock decrement) and `updateOrderStatus` (illegal transitions,
   cancellation restock). Then RBAC: assert 401/403 per route × role. Vitest
   plus a disposable Postgres.
2. **Dependency injection at the service boundary.** Define a repository
   interface, pass the Prisma client in. Makes (1) cheap and stops the service
   layer being welded to Prisma.
3. **Rate limiting** on `/api/v1/auth/login` and `/api/v1/auth/register`, and a
   modest budget on the AI routes.
4. **CI** running typecheck, lint, build and tests on every push.
5. **Pagination** on `getBuyerOrders` and `listSupplierProducts`.
6. **Revocable sessions** — a session table or a token version claim, so
   sign-out and password change actually invalidate.
7. **Observability** — Sentry, structured request logs, slow-query logging.
8. **pgvector**, and actually call `embed()`. The Hugging Face embedding path is
   written and dead; wiring it plus a re-embed script is roughly an hour and
   turns "search feels smart" into "search is semantic".
9. **Move images to object storage** (S3/R2). Bytes in Postgres will not scale.
10. **Payments** — Razorpay or Stripe, with orders becoming `PENDING_PAYMENT`
    until a webhook confirms.
11. **Supplier notifications** — email on a new order; the timeline exists but
    nobody is told.
12. **PPR or a client-side header** so the landing page can be cached. Right now
    `SiteHeader`'s session read forces every page dynamic.

---

## 8. Functional flows

### 8.1 Anonymous discovery

```
/ (landing)
  ├─ FabricWheel ─────────────► /weavescope/[slug]   3D fabric breakdown
  │    scroll / arrows / click a card to change the selection
  ├─ HeroSearch ──────────────► /marketplace?q=…
  ├─ category tiles ──────────► /marketplace?category=…
  └─ AssistantDock (⌘K) ──────► POST /api/v1/ai/chat
/marketplace
  ├─ FilterPanel  → URL params → RSC re-render
  ├─ ProductCard  ────────────► /product/[slug]
  └─ Pagination   → ?page=N
/product/[slug]
  ├─ ProductQA ───────────────► POST /api/v1/ai/chat  (productSlug scoped)
  ├─ QuickAdd ────────────────► POST /api/v1/cart/items   (401 if signed out)
  ├─ CompareActions ──────────► /compare?slugs=a,b,c
  └─ similar products ────────► /product/[slug]
```

Anonymous users may browse everything, use the assistant, and open WeaveScope.
They cannot add to cart — `/api/v1/cart/items` requires a buyer session.

### 8.2 Registration → onboarding → first order

```
/register
  └─ POST /api/v1/auth/register  { name, email, password, role }
       ├─ bcrypt hash (10 rounds)
       ├─ User row created
       ├─ BuyerProfile or SupplierProfile shell created
       ├─ JWT signed  { sub, email, name, role, onboarded: false }
       └─ Set-Cookie: threadwyn_session (httpOnly, sameSite=lax, 14d)
            │
            ▼  proxy sees onboarded=false
       /onboarding  (BUYER)         or  /supplier/onboarding  (SUPPLIER)
            │
            ├─ OnboardingChat: 4 scripted questions, voice input optional
            ├─ POST /api/v1/ai/onboarding { role, transcript }
            │     └─ extractProfile → model + rule pass → editable draft
            ├─ user reviews and corrects every field
            └─ POST /api/v1/buyer/profile   (or /api/v1/supplier/profile)
                  └─ onboardedAt set; new JWT with onboarded=true
            │
            ▼
       /dashboard  (BUYER)          or  /supplier  (SUPPLIER)
```

The onboarding questions are a fixed script, never model-generated. The model's
only job is turning free-form answers into structured fields, and **nothing it
produces is saved without the user seeing and confirming it.**

### 8.3 Cart → checkout → fan-out

```
/product/[slug]  QuickAdd
  └─ POST /api/v1/cart/items { productId, colorwayId?, quantityMetres }
       ├─ requireBuyer()
       ├─ getOrCreateCart(buyerId)
       ├─ validate MOQ and stock
       └─ upsert CartItem
/cart
  ├─ PATCH /api/v1/cart/items/[id]   quantity change
  ├─ DELETE /api/v1/cart/items/[id]
  └─ lines grouped by supplier; blockers counted
/checkout
  └─ POST /api/v1/orders { shipping… }
       └─ placeOrder() inside db.$transaction:
            1. re-read stock per line INSIDE the transaction
            2. 409 if archived / insufficient (product or colourway)
            3. create Order  (subtotal, shippingFee, tax, total as Decimal)
            4. per supplier → create SupplierOrder  ref "TW-xxxx-N"
                 └─ create OrderItem rows (spec snapshotted)
                 └─ create OrderEvent  PENDING, actor "buyer"
            5. decrement colourway stock, then product stock
            6. if stock ≤ 0 and status ACTIVE → OUT_OF_STOCK
            7. delete all CartItem rows
       ◄─ { orderNumber }
/orders/[number]
```

One cart spanning three mills produces **one** `Order` and **three**
`SupplierOrder` rows, each with its own reference, status, timeline and
subtotal. Each supplier sees only their own.

### 8.4 Supplier fulfilment

```
/supplier                       metrics: revenue, pending, low stock, trend
/supplier/orders                filter by status
/supplier/orders/[reference]
  └─ OrderActions → PATCH /api/v1/supplier/orders/[reference]
       ├─ requireSupplier() → supplierId
       ├─ findFirst({ reference, supplierId })      ← isolation
       ├─ STATUS_FLOW[current].includes(next)?  else 409 invalid_transition
       └─ db.$transaction:
            ├─ update SupplierOrder.status
            ├─ create OrderEvent (actor "supplier", note or default)
            └─ if CANCELLED → increment stock back, OUT_OF_STOCK → ACTIVE
```

Buyer-visible status is `rollupStatus()` — the **least advanced** of the
non-cancelled supplier orders. Telling a buyer their order is complete while
one mill is still cutting would be a lie.

### 8.5 Supplier catalogue management

```
/supplier/products              InventoryTable, search + status filter
/supplier/products/new          POST   /api/v1/supplier/products
/supplier/products/[id]         PATCH  /api/v1/supplier/products/[id]
                                DELETE /api/v1/supplier/products/[id]
inline stock edit               PATCH  /api/v1/supplier/products/[id]/stock
image upload                    POST   /api/v1/images  → UploadedImage row
```

Every one of these resolves `supplierId` from the session first and scopes the
query to it. A supplier cannot mutate another mill's product by id.

### 8.6 The AI assistant

```
User message
  └─ POST /api/v1/ai/chat { message, history[≤6], productSlug? }
       │
       ├─ productSlug present → askAboutProduct()
       │     ├─ load that ONE product row
       │     ├─ no provider → deterministicProductAnswer()   mode "rules"
       │     ├─ model answers strictly from that row's JSON  mode "model"
       │     └─ model returns nothing usable                 mode "fallback"
       │
       └─ otherwise → ask()
             ├─ parseQuery() extracts filters from natural language
             ├─ clean parse → searchProducts() and answer from the results
             │                                                mode "rules"
             │   (deliberate: we know the numbers exactly; asking a 7B model
             │    to restate them adds latency and a chance of being wrong)
             └─ otherwise → complete() with 4 tools:
                   search_fabrics · get_fabric · compare_fabrics · find_similar
                                                                 mode "model"
  ◄─ { message, citations[], chips[], searchHref, mode, model }
       └─ persisted to AiConversation + AiMessage, keyed by session id or
          anon id. A logging failure never breaks the reply.
```

Provenance is shown in the UI for every answer. Three states, never conflated:
`model`, `rules` (deterministic by design), `fallback` (a model was asked and
let us down).

---

## 9. Technical reference

### 9.1 Data model

```
User ──1:1── BuyerProfile
  │
  └──1:1── SupplierProfile ──1:N── Product ──1:N── ProductColorway
                    │                  │       └──1:N── ProductImage
                    │                  └──N:1── Category
                    │
                    └──1:N── SupplierOrder ──1:N── OrderItem
                                    │        └──1:N── OrderEvent
                                    └──N:1── Order ──N:1── User (buyer)

Cart ──1:N── CartItem ──N:1── Product
AiConversation ──1:N── AiMessage
UploadedImage  (standalone; bytes + mime)
```

**Enums:** `Role` (BUYER, SUPPLIER) · `ProductStatus` (ACTIVE, OUT_OF_STOCK,
DRAFT, ARCHIVED) · `OrderStatus` (PENDING, ACCEPTED, PREPARING,
READY_FOR_DISPATCH, COMPLETED, CANCELLED) · `Weave` (PLAIN, TWILL, SATIN,
JACQUARD, JERSEY, …).

**Two modelling decisions worth knowing:**

1. **`Order` → `SupplierOrder` → `OrderItem`.** One flat order would leak every
   supplier's lines to every other supplier and make "order status" meaningless
   when three mills are at three stages. So a purchase fans out into one
   `SupplierOrder` per mill, each with its own lifecycle. The buyer tracks the
   parent; a supplier can only read and mutate their own child.

2. **`OrderItem` snapshots the spec.** Price, composition, GSM, width and weave
   are copied onto the line at checkout, so a supplier editing a product cannot
   silently rewrite the history of an order already placed.

**Indexes (21):** `[role]`, `[verified]`, `[position]`, `[categoryId, status]`,
`[supplierId, status]`, `[status, featured]`, `[pricePerMetre]`, `[gsm]`,
`[productId]`, `[productId, position]`, `[cartId]`, `[buyerId, placedAt]`,
`[supplierId, status]`, `[orderId]`, `[supplierOrderId]`,
`[supplierOrderId, createdAt]`, `[sessionId, surface]`, `[userId]`,
`[conversationId, createdAt]`.

### 9.2 Authentication

**Token.** HS256 JWT via `jose`. Claims: `sub`, `email`, `name`, `role`,
`onboarded`. Issuer `threadwyn`, audience `threadwyn-app`, expiry 14 days.

**Cookie.** `threadwyn_session` — `httpOnly`, `secure` in production,
`sameSite: "lax"`, `path: "/"`, `maxAge` 1,209,600s. Not readable from JS.

**Anonymous continuity.** `threadwyn_anon` holds `anon_<uuid>` for 30 days so
the assistant can keep conversation context before signup. It carries no
authority — only continuity.

**Password.** bcrypt via `bcryptjs`. Hash never leaves the server; no route
selects it into a response.

**Secret.** `AUTH_SECRET`, minimum 32 characters, throws at boot otherwise.

**Why `jose`.** `src/proxy.ts` runs on Edge, where Node `crypto` is absent.
WebCrypto means one verification implementation for both runtimes.

### 9.3 Authorisation — two layers

**Layer 1 — `src/proxy.ts` (Edge, UX only).**

Matcher: `/dashboard/*`, `/cart/*`, `/checkout/*`, `/orders/*`,
`/onboarding/*`, `/supplier/*`, `/login`, `/register`.

| Condition | Action |
|---|---|
| Signed in on `/login` or `/register` | → role home |
| Protected route, no session | → `/login?next=<path>` |
| Buyer route, role ≠ BUYER | → `/supplier` |
| Supplier route, role ≠ SUPPLIER | → `/marketplace` |
| `onboarded === false` | → the role's onboarding path |

**This is not the security boundary.** It can be bypassed by calling the API
directly, which is exactly why layer 2 exists.

**Layer 2 — `src/lib/auth/guards.ts` (Node, the real boundary).**

| Guard | Enforces | Failure |
|---|---|---|
| `requireSession()` | a valid session | `401 unauthorized` |
| `requireBuyer()` | session + `role === BUYER` | `403 forbidden` |
| `requireSupplier()` | session + `role === SUPPLIER` + profile exists; returns `supplierId` | `403`, or `409 profile_missing` |
| `requirePageSession(next)` | RSC equivalent | `redirect("/login?next=…")` |
| `requireBuyerPage()` | RSC | `redirect("/supplier")` |
| `requireSupplierPage()` | RSC + profile | `redirect("/supplier/onboarding")` |

`requireSupplier()` returning `supplierId` rather than the user id is the
detail that makes isolation automatic: no handler has to remember the
user-id → profile-id hop, so no handler can forget it.

### 9.4 API contract

Every endpoint answers in exactly one of two shapes:

```jsonc
{ "data": … }                                        // 200 / 201
{ "error": { "code": "…", "message": "…", "fields"?: {…} } }   // 4xx / 5xx
```

| Code | Status | Meaning |
|---|---|---|
| `unauthorized` | 401 | No valid session |
| `forbidden` | 403 | Wrong role |
| `not_found` | 404 | Absent, or not yours |
| `invalid_json` | 400 | Body was not JSON |
| `validation_failed` | 422 | Zod issues, per-field in `fields` |
| `cart_empty` | 400 | Checkout with no lines |
| `cart_blocked` | 409 | A line is unorderable |
| `insufficient_stock` | 409 | Stock moved between cart and checkout |
| `invalid_transition` | 409 | Illegal order status move |
| `profile_missing` | 409 | Supplier has not onboarded |
| `internal_error` | 500 | Opaque; logged server-side only |

**All 19 handlers**

| Method | Path | Guard |
|---|---|---|
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/logout` | public |
| GET | `/api/v1/auth/me` | session |
| POST | `/api/v1/ai/chat` | public (persists by session or anon id) |
| POST | `/api/v1/ai/search` | public |
| POST | `/api/v1/ai/onboarding` | session; role must match body |
| GET | `/api/v1/cart` | buyer |
| POST | `/api/v1/cart/items` | buyer |
| PATCH·DELETE | `/api/v1/cart/items/[id]` | buyer + ownership |
| POST | `/api/v1/orders` | buyer |
| POST | `/api/v1/buyer/profile` | buyer |
| GET·POST | `/api/v1/supplier/profile` | supplier |
| GET·POST | `/api/v1/supplier/products` | supplier |
| GET·PATCH·DELETE | `/api/v1/supplier/products/[id]` | supplier + ownership |
| PATCH | `/api/v1/supplier/products/[id]/stock` | supplier + ownership |
| PATCH | `/api/v1/supplier/orders/[reference]` | supplier + ownership |
| POST | `/api/v1/images` | session |
| GET | `/api/v1/images/[id]` | public (bytes) |

### 9.5 Database calls per flow

**Landing page `/`** — one `Promise.all`, five queries:
`product.findMany` (8 featured) · `category.findMany` (8 + counts) ·
`product.count` · `supplierProfile.count` · `product.aggregate` ×2 ·
`supplierProfile.findMany` (8 mills) · `product.findMany` (5 hero rows).

**`/marketplace`** — `searchProducts()` + `getFacets()`. Without a text query:
`findMany` (paged in Postgres) + `count`, parallel. With one: `findMany`
(240 candidates incl. embedding) + `count`, then in-memory ranking —
`semantic × 0.45 + lexical × 0.5 + nameHit 0.35 + stocked 0.04` — then slice.

**`/product/[slug]`** — `getProductBySlug` (product + colourways + images +
category + supplier), `getSimilarProducts` (cosine over candidates),
`incrementViewCount` (fire-and-forget).

**Checkout** — inside one transaction: N × `product.findUnique` +
N × `productColorway.findUnique` (fresh stock) · `order.count` ·
`order.create` · M × `supplierOrder.create` (with nested `OrderItem` creates) ·
M × `orderEvent.create` · N × `productColorway.update` · N × `product.update`
(+ conditional status flip) · `cartItem.deleteMany`.

**Status change** — `supplierOrder.findFirst` (scoped), then in a transaction:
`supplierOrder.update` · `orderEvent.create` · on cancel, per item
`product.update` + `findUnique` + conditional `update`.

### 9.6 Rendering model

Every route is `ƒ` (dynamic) except `/sitemap.xml` and `/robots.txt`, because
`SiteHeader` calls `readSession()` — a cookie read — and that opts any route
containing it out of static generation. `revalidate` exports were removed from
`/` and `/suppliers` for exactly this reason: an inert caching directive reads
like caching is happening.

`/sitemap.xml` is the only route that genuinely queries the database at build
time.

### 9.7 AI layer

**Chain.** `HF_TOKEN` → Hugging Face Router · `OLLAMA_HOST` → local · neither →
rules.

**Model resolution.** The HF router usually wants the serving provider pinned,
so `candidateModels()` tries `[base, base:together, base:nebius,
base:hf-inference]` and caches the winner per process.

**Timeout.** `AI_TIMEOUT_MS`, default 20s, deliberately below the route's
`maxDuration = 30` and below Vercel's 60s ceiling, so our own fallback always
fires before the platform kills the function.

**Embeddings.** `embedLocal()` — 256-dim signed random projection over tokens,
character trigrams (so "poplen" finds "poplin") and adjacent pairs. Runs with
no key and no network. `embed()` upgrades to a real sentence-transformer when
`HF_TOKEN` is set but **is currently never called**; vectors from the two
sources must never be mixed, which is why switching requires a full re-embed.

**Extraction resilience.** A 7B model gets the shape right and the types
casually wrong. Field builders coerce delimited strings to arrays and `"$10"`
to `800`; every field is `.catch(undefined)` so an unrescuable value drops
itself rather than the whole draft. The rule pass then overrides anything it
matched, and the user reviews every field before it saves.

---

## 10. Landing page, header and the WeaveScope entry point

The three surfaces most recently reworked, and why.

**`FabricWheel` replaced a stack of five overlapping cards.** The stack buried
four of the five fabrics and its only affordance was a custom cursor that
appeared on hover, so touch and keyboard users never discovered that WeaveScope
existed at all — the site's one genuinely distinctive feature was reachable only
by mouse. The dial shows every fabric at once, lifts the selected one out at
full size, and turns by scroll, by arrow button or by clicking any card. The
entry point is a real `<Link>` labelled with its destination.

Positions come from `left`/`top` percentages computed with sin and cos, not a
`rotate() translateY(-R)` chain: a percentage inside `translateY` resolves
against the element's own height rather than the container's, so the ring would
break as the panel resized. Every computed coordinate is rounded to three
decimals, because `Math.sin` is not required to be correctly rounded and Node
and the browser disagreed in the last digit often enough to trip React's
hydration check.

Wheel events are bound with a non-passive native listener rather than React's
`onWheel`, which is registered passively and therefore cannot `preventDefault`;
without that the page scrolled away underneath the dial while it was turning.

**`CategoryCard` shows the material.** The grid described cloth with a 10px
coloured dot on a site whose argument is that it renders real construction.
Each category now cross-fades to its defining weave at a realistic weight, so
shirting, denim, satin and jersey look like different cloth rather than one
swatch in eight colours. A wipe was tried first and abandoned: it had to travel
to a position just off the card edge, and sub-pixel rounding there left a
hairline of fabric showing under every card.

**The header carries no search control.** It used to hold a pill reading
"Search fabrics…" with a `/` badge beside it, which was never a search: no
field, nothing to submit, just a link to `/marketplace` wearing the shape of an
input. Hiding it on the routes with a real search narrowed the lie without
ending it — everywhere else it still invited a click people expected to focus a
cursor. It is gone, and the `/` shortcut with it: that key binding existed only
to make the printed badge honest, and a global key that hijacks an ordinary
character to navigate somewhere unannounced is worse than no shortcut. Search
now appears only where it can be typed into — the hero field, the marketplace
toolbar, and the mill search below.

**`/suppliers` gained a real search** — name, tagline, city, state, business
type, fabric types, categories and certifications, since someone hunting for a
mill rarely knows its name. Client-side, because the page already loads every
supplier in one query.

**Three WeaveScope performance fixes**, all invisible and all worth knowing:

- The loading poster is a viewport-sized `blur-2xl` over a `FabricSwatch` that
  itself paints an `feTurbulence` filter and two blend modes. It used to fade to
  `opacity: 0` and stay mounted forever, and a transparent layer is still
  composited — every frame for the rest of the session paid for a 40px blur of a
  filtered SVG nobody could see. It now leaves the tree.
- `frameloop` stops when the stage is off screen.
- Mount and paint are separate observers. The wrapper is 560vh tall, so the
  200px margin that correctly preloads the chunk marks it "visible" a whole
  screen early; driving the render loop from that signal meant drawing filaments
  nobody could see.

**Imported images live in `src/assets/`, not `public/`.** Anything in `public/`
is served verbatim *as well as* being emitted hashed into `_next/static/media`,
so importing from there shipped 9.4 MB of photographs twice and referenced the
second copy.

---

## Appendix — verification performed

| Claim | How it was checked |
|---|---|
| RBAC holds | Four manual paths: anon→`/dashboard`, buyer→`/supplier`, anon API 401, buyer→supplier API 403 |
| No dead internal links | Every `href` cross-checked against the route tree (found and fixed a `/suppliers/[slug]` 404) |
| Model is live in production | `POST /api/v1/ai/chat` returned `"mode":"model","model":"Qwen/Qwen2.5-7B-Instruct"` |
| Onboarding extraction bug | Reproduced in three stages against the live model before changing code |
| Negation fix | Two-case probe: "avoid polyester" excluded, "no rush… we buy silk" retained |
| Region latency | `X-Vercel-Id` showed `iad1`; re-measured after pinning `sin1` |
| Checkbox CSS bug | Grepped the compiled stylesheet, found zero `:checked` rules |
| Production build | `npm run build:check` green; typecheck and lint clean |
| No committed secrets | Scanned tracked files for HF tokens, `sk-` keys, Postgres URLs with passwords |
| Hydration is clean | React named the mismatching attributes; fixed by rounding, re-verified in the SSR output |
| Images emit once | Build output checked for duplicate copies after moving them out of `public/` |
| Agent tooling excluded | `.claude`, `.agents`, `.codex`, `.impeccable` confirmed gitignored before pushing |
