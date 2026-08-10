# Threadwyn — Master Build Plan

> Source of truth for architecture, scope, and sequencing.
> Derived from `hackathon_details.md` (requirements) and `00_founding_engineer.md` (standards).

---

## 1. Positioning

**Threadwyn is an AI-native B2B textile procurement marketplace.**

Buyers (garment manufacturers, brands, tailoring houses) discover and order fabric by the metre from
verified mills and suppliers. Suppliers run their catalogue, inventory and order pipeline from one console.

The wedge is **decision speed**. Textile procurement is slow because fabric is hard to evaluate remotely:
specs are inconsistent, MOQs are buried, and comparison means twelve browser tabs. Threadwyn compresses
that into one grounded surface.

**Deliberately out of scope** (stated in the brief): payments, escrow, logistics, delivery, admin console.

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 App Router | One deployable, RSC for fast first paint, route handlers are Node — satisfies "Node.js backend" |
| Language | TypeScript, strict | End-to-end type safety from Prisma → service → API → client |
| Database | PostgreSQL + Prisma | Relational integrity for orders/inventory; Prisma gives schema clarity + migrations |
| API | REST under `/api/v1/*` | Brief asks for "well-structured RESTful APIs"; versioned, resource-oriented, zod-validated |
| Auth | JWT in httpOnly cookie (`jose`) + bcrypt | Edge-verifiable in middleware, no session store, RBAC via role claim |
| Validation | zod, shared client/server | One schema, two consumers — no drift |
| Styling | Tailwind v4 + design tokens | Tokens in CSS vars, Tailwind maps to them; no raw hex in components |
| Motion | Framer Motion + CSS | Spring physics, `whileInView`, respects `prefers-reduced-motion` |
| AI | Provider abstraction: HF Router → Ollama → deterministic | Brief prefers Hugging Face; local Ollama for dev; **deterministic fallback so the demo never breaks** |
| Search | Postgres filters + in-process vector rerank | pgvector-shaped without the extension; honest about the scale path |
| Images | Procedural SVG weave renderer + optional upload | True-to-colour swatches beat mismatched stock photos, zero latency, never broken |
| State | URL search params + RSC; Context for cart | Shareable/back-button-correct filters; no client state library needed |

### Why not a separate Express server

The brief says Node.js backend and RESTful APIs. Next.js route handlers **are** Node.js handlers. Splitting
into a second process would double the deploy surface, break end-to-end types, and buy nothing at this scale.
The API is still a real API: versioned routes, a service layer, a repository boundary, zod contracts, and no
business logic in components. If it needed to move to Express or Nest later, only the thin route shim changes.

### Layering

```
app/api/v1/*      route handler   → parse, authorise, delegate, serialise
server/services/* domain logic    → the only place business rules live
server/repos/*    data access     → Prisma queries, nothing else
lib/*             cross-cutting   → auth, ai, validation, formatting
components/*      presentation    → no fetch of business logic, no Prisma
```

---

## 3. Data Model

```
User ─┬─ BuyerProfile
      └─ SupplierProfile ─┬─ Product ─┬─ ProductImage
                          │           ├─ ProductColorway
                          │           └─ ProductEmbedding (Float[])
                          └─ SupplierOrder ─── OrderItem
Category ─── Product
Cart ─── CartItem
Order ─── SupplierOrder ─── OrderEvent  (status timeline)
AiConversation ─── AiMessage
```

**Key modelling call — `SupplierOrder`.** A buyer's cart can span multiple mills. A single flat `Order` would
force every supplier to see the whole basket and would make "order status" meaningless. So one `Order` (the
buyer's purchase) fans out into one `SupplierOrder` per supplier, each with its own status lifecycle and event
timeline. The buyer tracks the parent; each supplier only ever sees and mutates their own child. This is the
correct real-world shape and it's what makes RBAC on orders enforceable rather than cosmetic.

**Status lifecycle** (per `SupplierOrder`): `PENDING → ACCEPTED → PREPARING → READY_FOR_DISPATCH → COMPLETED`,
with `CANCELLED` reachable from the first three. Transitions are validated server-side against an explicit
adjacency map — a supplier cannot jump a stage or move backwards.

**Inventory.** `stockMeters` is decremented inside the same transaction that creates the order, with a
row-level check so two concurrent orders cannot oversell. Stock hitting zero flips `status` to `OUT_OF_STOCK`
and raises a dashboard inventory alert.

---

## 4. API Surface (`/api/v1`)

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Create buyer or supplier |
| POST | `/auth/login` | — | Issue JWT cookie |
| POST | `/auth/logout` | — | Clear cookie |
| GET | `/auth/me` | any | Current user + profile + onboarding state |
| GET | `/categories` | — | Category tree with counts |
| GET | `/products` | — | Search, filter, sort, paginate |
| GET | `/products/:slug` | — | Full PDP payload |
| GET | `/products/:slug/similar` | — | Vector-ranked neighbours |
| POST | `/products/compare` | — | Normalised side-by-side matrix |
| GET/POST/PATCH/DELETE | `/supplier/products*` | SUPPLIER | Inventory CRUD |
| PATCH | `/supplier/products/:id/stock` | SUPPLIER | Fast stock adjust |
| GET | `/supplier/orders` | SUPPLIER | Incoming queue |
| PATCH | `/supplier/orders/:id/status` | SUPPLIER | Guarded transition |
| GET | `/supplier/metrics` | SUPPLIER | Dashboard widgets |
| GET/PUT | `/supplier/profile` | SUPPLIER | Business profile |
| GET/POST/PATCH/DELETE | `/cart*` | BUYER | Cart operations |
| POST | `/orders` | BUYER | Checkout → fan out to SupplierOrders |
| GET | `/orders`, `/orders/:number` | BUYER | History + tracking |
| GET/PUT | `/buyer/profile` | BUYER | Preferences |
| POST | `/ai/chat` | any | Streaming, tool-calling assistant |
| POST | `/ai/search` | — | Natural language → structured filters |
| POST | `/ai/onboarding` | any | Conversational profile extraction |

Every response is `{ data }` or `{ error: { code, message, fields? } }`. Every mutation is zod-validated at
the boundary. Every protected route re-checks role server-side — middleware is a UX convenience, not the
security boundary.

---

## 5. AI Layer

**Principle from the founding doc: AI exists because friction exists.** Four places friction is real:

1. **Onboarding** — a 12-field form is the worst first impression. Instead: a short conversation (typed or
   spoken) that extracts a structured profile. The extracted fields are shown as **editable chips** before
   saving. AI proposes, the user confirms. Nothing is written silently.
2. **Natural-language search** — "breathable cotton for summer shirting under $5, at least 500m available"
   → structured filter object → the *same* deterministic query path the filter sidebar uses. The AI translates
   intent into filters; it never invents products. The applied filters render as removable chips so the user
   can see exactly what the model decided.
3. **Comparison** — buyers compare fabric on GSM, composition, weave, hand-feel, MOQ, lead time, price/m.
   The assistant returns a normalised matrix plus a short "which to pick when" rationale grounded in the rows.
4. **Product Q&A** — grounded strictly in that product's spec row + supplier profile. If the answer isn't in
   the data, it says so and offers to ask the supplier. No hallucinated fabric specs.

**Provider chain.** `HF_TOKEN` → Hugging Face Router (OpenAI-compatible, Qwen2.5-7B-Instruct).
Else `OLLAMA_HOST` → local Qwen. Else **deterministic engine**: BM25-ish lexical scoring + rule-based filter
extraction + template rationales. The fallback is not a stub — it answers, searches, and recommends. This is
deliberate: a hackathon demo that dies because an inference endpoint rate-limited is a self-inflicted wound.

**Retrieval.** Each product gets an embedding over `name + composition + weave + use-cases + category`.
Stored as `Float[]`. Cosine similarity computed in-process over a cached index — at catalogue scale this is
sub-millisecond and needs no extension. Documented upgrade path: pgvector + HNSW past ~50k SKUs.

**Voice.** Web Speech API (`SpeechRecognition` + `speechSynthesis`) — native, zero-latency, zero-cost, no key.
Push-to-talk with a live waveform, interim transcript shown as it forms, and a visible text fallback on
unsupported browsers. Voice is an *input method* for the same assistant, not a separate feature.

**Safety.** Model output is treated as untrusted: tool arguments are zod-parsed, product IDs are re-resolved
against the DB, and nothing the model returns is rendered as HTML.

---

## 6. Screens

**Public** — Landing, Marketplace, Category, PDP, Compare, Login, Register
**Buyer** — AI Onboarding, Dashboard, Orders, Order Detail (timeline), Cart, Checkout, Confirmation, Profile
**Supplier** — AI Onboarding, Dashboard, Products (list/new/edit), Orders (queue/detail), Profile
**Global** — AI assistant dock, command palette (`⌘K`), toasts, 404, error boundary

Every screen ships its loading skeleton, empty state (which *teaches*, per principle 9), and error state.

---

## 7. Build Sequence

1. Foundation — tokens, fonts, primitives, motion, layout shells
2. Data — Prisma schema, migration, seed (12 categories, 8 suppliers, ~90 products)
3. Auth — register/login/logout, JWT, middleware, RBAC
4. API — products, cart, orders, supplier, profiles
5. Buyer surface — landing → marketplace → PDP → cart → checkout → dashboard
6. Supplier surface — dashboard → inventory → orders → profile
7. AI — provider, tools, chat dock, voice, NL search, compare, onboarding
8. Polish — a11y sweep, perf, responsive QA at 375/768/1024/1440
9. Ship — env, migrations, seed, README, demo script

---

## 8. Quality Gates (from the founding doc)

- Flow is understandable without explanation
- Visuals cohere with the Threadwyn brand
- The AI feature actually saves time
- Loading, empty and error states are intentional
- Contrast ≥ 4.5:1, visible focus rings, full keyboard path
- No layout shift; animations use `transform`/`opacity` only
- `prefers-reduced-motion` respected everywhere
- No secrets in the client bundle; every mutation authorised server-side
</content>
</invoke>
