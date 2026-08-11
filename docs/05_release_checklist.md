# Release checklist — final-round polish

Everything changed after the hackathon submission, and the exact order to ship it.

Baseline: `2dc4ece` *Quote the catalogue in dollars* — committed, **not pushed**.
Everything below that commit is still in the working tree.

---

## ⚠️ Read first

**Production is stale on purpose.** Do not seed it until the code is deployed and
frozen. `prisma/seed.ts` runs `deleteMany()` across every table before it writes,
so seeding wipes any account or order created on the live URL. That is fine for a
demo environment — it just has to happen **once**, at the end.

**`db:reset` is local-only.** `.env` points at `localhost:5433` and the Prisma CLI
reads only `.env`, never `.env.production`. The single way this becomes dangerous
is pasting the Neon string into `.env` — don't. Use an inline env var instead.

---

## 1. What changed

### Committed — `2dc4ece`

**Currency: INR → USD.** Not a relabel. All 60 catalogue prices restated as
realistic per-metre export quotes (poplin $2.80, not $238), monotonic so sort
order is unchanged. Locale and currency centralised in `src/lib/utils.ts`;
`en-IN` digit grouping removed everywhere it would have produced `$1,20,000`.
Shipping $25 / free over $1,200. GST relabelled *Duties & handling* (exports are
zero-rated). Filter bands, the NL parser, model prompts and onboarding extraction
all moved with the catalogue.

Two bugs surfaced by that work:

- **Price params were truncated.** `int()` turned a `$4.50` ceiling into `$4` and
  silently dropped every fabric between. Prices now parse as decimals; weights and
  quantities still don't.
- **The price-floor regex matched quantities.** `"at least 2000m in stock"` was
  read as a `$2000` price floor, so the demo script's headline query returned
  nothing. The ceiling branch had a metres/gsm guard; the floor branch now does too.

### Uncommitted — working tree

**Copy reduction** (the founders' second note). Landing page 544 → 425 lines: hero,
categories, featured, both-sides and CTA all rewritten; the AI marketing section
removed entirely. Marketplace, suppliers, product and orders headers tightened.
All 12 category blurbs rewritten. 30 product and mill descriptions rewritten to
remove em-dashes without losing meaning.

**WeaveScope** 504 → 333 lines. Four stage captions rewritten. Cut: the derivation
`<details>`, *Cotton under magnification*, *From cotton to cloth*, *How it will
behave*. Kept and tightened: the loom, the construction figures, why it costs what
it costs, the CTA. The redundant brand pill in the header is gone.

**Discount removed from the UI.** The `−12%` badge, the strike-through price and
the supplier's *"Was (strike-through)"* field. Reason is domain fit, not
incompleteness: strike-through pricing is a retail signal, and the B2B equivalent
is volume price breaks. `compareAtPrice` stays in the schema — dropping a nullable
column is a migration, and it isn't worth running one for a cosmetic cut.

**Cart: stale-inventory handling.** Messages now name the delta (*"Your cart has
500 m, and only 10 m is available now"*) and, when stock falls below the mill's
MOQ, say the line cannot be ordered at all — because at that point no quantity
works. Each flagged line gets a one-tap fix: `Reduce to X m`, `Raise to X m`, or
`Remove from cart`. Checkout button reads `Fix 1 line to continue` and drops its
arrow while disabled.

**Checkout consistency.** The buyer's cart row is locked for the duration of the
checkout transaction, so two simultaneous submissions serialise instead of writing
two orders and decrementing stock twice. The checkout page also sends the total it
rendered, and the server refuses with `409 cart_changed` if the basket moved
between review and submission — a cart edited in another tab used to be ordered
silently at the new figure. Order numbers retry on a unique-constraint collision,
and `P2002` now maps to `409` rather than an opaque `500`. Full reasoning in
[`06_hardening_plan.md`](06_hardening_plan.md) §3.3.

**Order placement overlay.** New `src/components/cart/placing-overlay.tsx` — warp
strung, weft picks thrown across, "Notifying 2 mills". Held to a 1100 ms floor so
a ~80 ms local commit doesn't flash. Only `scaleX` animates. `busy` now stays true
on success so the overlay covers navigation instead of flashing the form back.

**Compare, made usable.** The comparison table was already good — spec matrix,
best-cell highlighting, four verdict cards, and it refuses to rank weight or
composition because neither direction is better. But its only entry point pushed
a single slug with no accumulation, so a second fabric could never be added from
the UI and every comparison had one column. Now there is a shortlist:
`src/lib/use-compare.ts` (localStorage + `useSyncExternalStore`, capped at four),
a toggle on every product card and on the product page, and a floating
`Compare (n)` bar that carries you to the table. The URL stays the source of
truth for the table itself, so a comparison is still a shareable link.

**One stock rule, everywhere.** Threadwyn sells stock that exists: a fabric is
orderable when available stock is at or above the mill's MOQ, and the quantity is
within stock. The product page previously offered to have the mill *"weave the
balance"* of anything beyond stock — genuinely how a mill works, but nothing
downstream honoured it. The cart flagged the line and the checkout transaction
rejected it, so the page was promising what checkout refused. Worst case: a
colourway holding 141 m against a 200 m minimum had no valid quantity at all,
and Add to cart was still live.

Now the product page disables the CTA and names the reason (*"Below the mill's
minimum"* / *"Reduce quantity to continue"*), and quick-add on the cards is
disabled when stock is under MOQ, since it always adds exactly one MOQ. The
server-side re-check inside the checkout transaction is unchanged and still the
real boundary — another buyer can take the stock between page load and submit.

Make-to-order is the better long-term model. It needs production quantities,
split fulfilment and reserved stock on the order line, not a relaxed check on
the client.

**Fixes**

- Focus ring: `:focus-visible` was unlayered, so it beat every Tailwind utility —
  `focus-visible:outline-none` was dead in all 19 places it was used. It also set
  `border-radius: 4px`, which squared off the *element*, not the outline. Now in
  `@layer base` with the radius gone, so composite controls draw one ring that
  follows their own shape.
- Native `type="search"` clear button suppressed — search fields were showing two
  crosses.
- Assistant dock hides behind the open mobile menu (`data-nav-open` on `<body>`).
- Supplier fabric strip: `items-start`, so tiles stop stretching to the text
  column's height and rendering as half-loaded images.
- Order group counts sit in a chip instead of floating as a bare numeral.
- Unescaped apostrophe in `marketplace/page.tsx` that was failing lint.

---

## 2. Before pushing

```bash
npm run typecheck        # must be clean
npm run lint             # must be clean
npm run build:check      # production build, own dist dir
npm run db:reset         # local only — picks up new prices, blurbs, descriptions
npm run dev
```

Then walk it. **`db:reset` is not optional** — the category blurbs and the 30
rewritten descriptions live in the database, not the code.

- [ ] Marketplace: price filter presets ($5 / $5–10 / $10–20 / $20+) return results
- [ ] Search: `breathable cotton for summer shirting under $4 with at least 2000m in stock`
      → chips show `≤ $4/m`, `≤ 160 gsm`, `Stock ≥ 2,000m`, and **no** `≥ $2000/m`
- [ ] Product page → cart → checkout → **placing overlay** → order detail
- [ ] Checkout failure path: drop a fabric's stock in another tab, place the order,
      confirm the overlay dismisses and the toast appears
- [ ] Cart with a flagged line: the one-tap fix clears it and enables checkout
- [ ] Stock rule: drop a colourway below its MOQ in the supplier console, then
      open that product as a buyer. Add to cart should read *"Below the mill's
      minimum"* and be disabled, and quick-add on the card should be dead too.
      Raise the quantity above stock on a healthy fabric — CTA should read
      *"Reduce quantity to continue"*.
- [ ] Compare: shortlist two fabrics from the marketplace grid, confirm the
      `Compare (2)` bar appears, open it, remove a column, confirm the bar count
      follows. Try adding a fifth — it should refuse with a toast.
- [ ] Supplier: accept an order, adjust stock to zero, confirm it leaves the marketplace
- [ ] Tab through a form — the focus-ring change is global; confirm every input
      still shows a visible ring
- [ ] Mobile: open the nav, confirm the assistant dock hides and returns
- [ ] WeaveScope on a real phone: sticky stage, scroll length, crossfade

---

## 3. Deploy, in this order

**Code first, then data.** Seeding first would show `₹20.95` on the live site until
the deploy landed.

```bash
# 1. commit and push — Vercel builds from main
git add . && git commit -m "..." && git push

# 2. wait for the deployment to go green

# 3. snapshot production first
#    Neon console → branch from `main` → name it `pre-final-seed`
#    Copy-on-write, ten seconds, free. Restoring means pointing at the branch.

# 4. seed production ONCE, with the DIRECT (non-pooled) Neon string
npx cross-env DATABASE_URL="<neon-direct-string>" npx tsx prisma/seed.ts
```

Direct, not `-pooler`: this is ~90 sequential writes and PgBouncer in transaction
mode is the wrong thing in front of them. Setting the variable inline means it
never touches a file and the local `db:*` scripts stay pointed at docker.

No schema change in this release, so **no migration** — `db:seed`, never
`db:reset`, against production.

**Then:** open the deployed marketplace. It verifies the seed and warms Neon out of
auto-suspend at the same time. Do this again ~10 minutes before the call.

---

## 4. Known issues, deliberately not fixed

Each of these is a better answer than a rushed fix.

**Duplicated cart rules.** Issue text is generated in `cart-service.ts`; the
matching fix button is decided by `lineFix()` in `cart-view.tsx`. Two places
encoding one ruleset. They agree today. The fix is a typed `reason` discriminant
from the service that the UI switches on.

**Dead code from the WeaveScope cuts.** `deriveBehaviour` and `parseComposition`
in `src/lib/weavescope.ts` have no callers. Left in place: if asked whether
Threadwyn could show how a fabric behaves, the answer is *"the derivation is
written, I pulled the UI because I couldn't defend the absolute numbers."*

**`compareAtPrice`** — retained, never written. See above.

**No verification on compare-at pricing** (were it re-enabled): nothing proves the
"was" price was ever charged. A production version needs price history and a rule
like the EU Omnibus 30-day lowest price.

**Backend hardening** — tests, the checkout race, rate limiting and the cart reason
discriminant — is described in [`06_hardening_plan.md`](06_hardening_plan.md) and
is in this release. Security headers and DB-backed integration tests are the two
steps of that plan deliberately **not** taken; see its §4.

**Still open:** supplier ratings are seeded rather than computed, `--ease-back` is
a dead CSS token, and `compareAtPrice` is a retained-but-unwritten column.

---

## 5. If something breaks live

```bash
# roll the code back
git revert <sha> && git push          # or redeploy the previous build in Vercel

# roll the data back
# Neon console → restore from the `pre-final-seed` branch
```
