# Threadwyn

**An AI-native B2B textile marketplace.** Buyers source fabric by the metre from verified Indian mills;
suppliers run catalogue, inventory and orders from one console.

Built for the Marketplace Hackathon. Payments, escrow, logistics and admin are deliberately out of scope —
the brief excludes them, and pretending otherwise would have cost depth on the parts that matter.

---

## Run it

```bash
cp .env.example .env          # AUTH_SECRET is the only value you must set
docker compose up -d          # Postgres 16 on :5433
npm install
npm run db:migrate            # create the schema
npm run db:seed               # 12 categories, 8 mills, 60 fabrics, 14 orders
npm run dev
```

Open <http://localhost:3000>.

| Role | Email | Password |
|---|---|---|
| Buyer | `buyer@threadwyn.dev` | `threadwyn` |
| Buyer (volume) | `buyer2@threadwyn.dev` | `threadwyn` |
| Supplier | `supplier1@threadwyn.dev` … `supplier8@threadwyn.dev` | `threadwyn` |

**No AI key is required.** Every AI surface works without one — see [AI](#ai) below.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16, App Router | One deployable; route handlers *are* Node handlers, satisfying the Node.js backend requirement without a second process to deploy and keep in sync |
| Language | TypeScript, strict | End-to-end types from Prisma → service → API → client |
| Database | PostgreSQL 16 + Prisma 6 | Relational integrity for orders and inventory; migrations in version control |
| API | REST at `/api/v1/*` | Versioned, resource-oriented, zod-validated, one response envelope |
| Auth | JWT in an httpOnly cookie (`jose`) + bcrypt | Verifiable at the edge, no session store, role claim drives RBAC |
| Styling | Tailwind v4 + CSS custom properties | Semantic tokens, full light/dark parity |
| Motion | Motion (Framer) | Spring physics, `whileInView`, honours `prefers-reduced-motion` |
| 3D | three.js + react-three-fiber | Only on `/weavescope/[slug]`, dynamically imported |
| AI | HF Router → Ollama → deterministic engine | Three tiers, degrading rather than failing |

### Why not a separate Express server

The brief asks for Node.js and RESTful APIs. Next.js route handlers are Node handlers. Splitting into a
second process would double the deploy surface, break end-to-end types, and buy nothing at this scale. The
API is still a real API — versioned routes, a service layer, zod contracts, and no business logic in
components. Moving it to Express later changes only the thin route shim.

---

## Architecture

```
src/app/api/v1/*      route handlers  → parse, authorise, delegate, serialise
src/server/services/* domain logic    → the only place business rules live
src/lib/*             cross-cutting   → auth, ai, validation, formatting
src/components/*      presentation    → no data access, no Prisma
```

### The data model call worth knowing

A buyer's cart can span several mills. A single flat `Order` would leak every supplier's lines to every other
supplier and make "order status" meaningless.

```
Order  ──┬── SupplierOrder (Coimbatore) ── OrderItem × n ── OrderEvent × n
         └── SupplierOrder (Erode)      ── OrderItem × n ── OrderEvent × n
```

One purchase fans out into one `SupplierOrder` per mill, each with its own reference, status lifecycle and
event timeline. The buyer tracks the parent — whose rolled-up status is the **least advanced** child, because
"your order is complete" is a lie while one mill is still cutting. Each supplier sees and mutates only their
own child. That is what makes RBAC on orders enforceable rather than cosmetic.

`OrderItem` snapshots the spec (price, composition, GSM, width) at checkout. A supplier editing a product must
never silently rewrite history on a placed order.

### Status transitions

`PENDING → ACCEPTED → PREPARING → READY_FOR_DISPATCH → COMPLETED`, with `CANCELLED` reachable from the first
three. Legal transitions live in one adjacency map (`src/lib/order-status.ts`) that the client reads to decide
what to *show* and the server reads to decide what to *allow*. A supplier cannot skip a stage, walk one
backwards, or cancel something already dispatched — not even by hand-rolling the API call. Cancelling returns
the metres to stock.

### Authorisation

Enforced in server code on every protected read and write (`src/lib/auth/guards.ts`). `src/proxy.ts` also
redirects at the route level, but that is a UX convenience, never the security boundary. Every supplier query
is scoped by `supplierId` in the `WHERE` clause, so one mill physically cannot read another's rows.

Verified: anonymous → `/dashboard` redirects to login; buyer → `/supplier` redirects to marketplace;
anonymous → API returns 401; buyer → supplier API returns 403.

### Checkout

One transaction: stock is re-read (the cart view was a snapshot), decremented, the order written, the cart
emptied. If any line went out of stock while the buyer was on the page, the whole thing rolls back and names
the fabric that caused it. Stock hitting zero flips the listing to `OUT_OF_STOCK`, which is what raises the
supplier's inventory alert.

---

## Fabric is rendered, not photographed

Stock photography lies about colour — two mills shoot the same navy poplin under different lights and a buyer
cannot compare them. So every swatch is **generated from the product's specification**: weave structure, yarn
coarseness implied by GSM, and the colourway's exact hex.

`src/lib/weave.ts` builds an SVG pattern tile per weave — plain, twill, satin, jacquard, herringbone, jersey,
rib, dobby, canvas, crepe — each with its correct geometry, plus fibre noise and directional sheen scaled to
the fibre.

The result is true-to-colour, loads instantly, never 404s, stays consistent across the catalogue, and cannot
show the wrong cloth. Suppliers can still upload photographs; those take precedence and the weave becomes the
fallback.

---

## WeaveScope

Click any hero card on the homepage, or **Look inside** on any product.

A procurement team buys fabric from a photograph and a spec line, then meets the material when the roll
arrives. WeaveScope shows the cloth being made — warp under tension, the shuttle flying, weft appearing behind
it — then explains what those threads cost and how the fabric will behave because of them.

- **The loom is procedural.** Warp count follows GSM, colour follows the colourway, and the interlacing
  follows *this fabric's* lift plan — plain alternates every end, twill steps one each pick, satin scatters
  its binding points across five. It runs for all 60 fabrics, ships no downloadable asset, and can never
  render the wrong cloth.
- **Two draw calls.** Warp and weft are each merged into one buffer geometry; picks are revealed with
  `setDrawRange`, one integer per frame — no geometry rebuilt on scroll, no clipping planes.
- **three.js is dynamically imported**, client-only, and not started until the stage is in view, so no other
  page pays for it. Quality drops automatically on ≤4 cores or a small viewport.
- **`prefers-reduced-motion` collapses it** to a stacked article with the same content.

Below the loom, every figure is derived from stored spec, and anything estimated says so **with its
derivation shown** (`src/lib/weavescope.ts`). Thread count comes from the standard mass balance
`gsm = (ends/m × tex + picks/m × tex) ÷ 1000`; that is one equation with two unknowns, so yarn count is
bracketed by weight class and the ends-to-picks split comes from the weave's warp bias. Fibre morphology is
drawn per fibre — cotton's convoluted ribbon, linen's growth nodes, silk's triangular prism, wool's cuticle
scales — because those differences are real and they explain the behaviour.

---

## AI

Threadwyn resolves a provider in this order:

1. `HF_TOKEN` → Hugging Face Router (Qwen2.5-7B-Instruct)
2. `OLLAMA_HOST` → a local model, no key, no cost
3. neither → **a deterministic engine**

Tier 3 is a product decision, not a shortcut. A demo that dies because an inference endpoint rate-limited is a
self-inflicted wound, and a buyer whose search box stops working because a GPU is busy does not come back. The
rule-based path is not a stub: it parses queries, runs the same search, and writes grounded summaries from the
actual rows. **Everything below works with no key configured.**

| Surface | What AI does | What it never does |
|---|---|---|
| Natural-language search | Turns "breathable cotton for summer shirting under ₹300" into structured filters | Get its own results page — it writes filters into the URL and the *same* deterministic query runs |
| Assistant (`⌘K`) | Tool-calling over `search_fabrics`, `get_fabric`, `compare_fabrics`, `find_similar` | Invent a product, price or stock figure; every claim comes from a tool result |
| Product Q&A | Answers from that one product's row | Drift onto a neighbouring SKU, or guess a value that is not in the data |
| Onboarding | Converts free-form answers into profile fields | Write anything — the draft is shown as editable fields and the user saves it |
| Voice | Web Speech API — native, instant, free, no audio leaves the browser | Be the only path; a text input is always visible |

Two principles run through all of it. **Applied filters are always shown as removable chips** — the AI
proposes, the buyer disposes. And **provenance is labelled**: every reply states whether it came from the
model or the rule engine.

Semantic search uses a deterministic hashing embedding (`src/lib/ai/embed.ts`) with cosine reranking over a
lexical prefilter — sub-millisecond at catalogue scale, no extension needed. Documented upgrade path: pgvector
with HNSW past ~50k SKUs.

---

## Accessibility & performance

- Every colour pair checked against WCAG AA; the categorical chart palette was run through a CVD validator,
  which is *why* the supplier dashboard trend is single-series — the brand hues fail adjacent-pair separation
  as a categorical set, and a single series does not need one
- Visible focus rings everywhere, full keyboard path, skip link, focus trapping in dialogs with focus returned
  to the trigger
- Status and stock carry text and shape, never colour alone
- `prefers-reduced-motion` honoured globally; animations use only `transform` and `opacity`
- Skeletons match real geometry, so nothing shifts on load
- Tabular figures on every price, quantity and ID so columns don't jitter
- Filters live in the URL: shareable, back-button-correct, server-rendered

---

## Scripts

```bash
npm run dev          # dev server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run db:up        # start Postgres
npm run db:migrate   # apply migrations
npm run db:seed      # reseed
npm run db:reset     # drop, migrate, reseed
npm run db:studio    # Prisma Studio
```

---

## Deploying

1. Provision Postgres (Neon, Supabase or RDS) and put the pooled connection string in `DATABASE_URL`.
2. Set `AUTH_SECRET` (`openssl rand -base64 48`) and `NEXT_PUBLIC_APP_URL`.
3. Optionally set `HF_TOKEN` to enable hosted inference. Without it the app runs on the deterministic engine.
4. `npx prisma migrate deploy && npx tsx prisma/seed.ts`
5. Deploy. `postinstall` runs `prisma generate`.

Uploaded product photos are stored as bytes in Postgres and served from `/api/v1/images/[id]` with an
immutable cache header — serverless hosts have an ephemeral filesystem, and an uploaded photo has to survive a
cold start.

---

## Known limits

- Construction figures in WeaveScope are **estimates** derived from GSM and weave, clearly labelled as such
  with the derivation shown. They are a sourcing aid, not a test report.
- Behaviour scores are indicative and derived consistently — comparing two Threadwyn fabrics on them is
  meaningful, the absolute numbers are not.
- Voice input needs the Web Speech API (Chrome/Edge solid, Firefox not). Detected, with a text input always
  present.
- `npm audit` reports advisories in `postcss` and `sharp`, both transitive build-time dependencies of Next
  itself. Not reachable at runtime; fixing them means overriding Next's own pins.
- Supplier ratings are seeded, not computed — there is no review system, which is out of scope.

---

## Docs

- [`docs/hackathon_details.md`](docs/hackathon_details.md) — the brief
- [`docs/00_founding_engineer.md`](docs/00_founding_engineer.md) — the standards this was built to
- [`docs/01_master_plan.md`](docs/01_master_plan.md) — architecture decisions and scope
- [`docs/02_demo_script.md`](docs/02_demo_script.md) — the walkthrough
