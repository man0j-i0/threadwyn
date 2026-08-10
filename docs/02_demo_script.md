# Threadwyn — demo script

Target: **6 minutes.** Two browser profiles side by side (buyer, supplier) so you never sign out on camera.

**Before you record**

```bash
docker compose up -d && npm run db:reset && npm run dev
```

Two windows: buyer signed in as `buyer@threadwyn.dev`, supplier as `supplier1@threadwyn.dev`
(password `threadwyn` on both). Zoom to 90%. Close the assistant dock so you can open it deliberately.

---

## 0 · The problem (20s)

> "Procurement teams buy fabric from a photograph and a spec line, and meet the material when the roll turns
> up. Threadwyn is a B2B textile marketplace built around one question: can a buyer decide on a fabric without
> opening twelve tabs?"

Land on the homepage. Let the hero settle.

> "Sixty live fabrics, eight verified Indian mills. Everything you're looking at is real seeded data."

---

## 1 · WeaveScope — the differentiator (75s)

**Do it first.** It is the thing they will remember, and it earns attention for everything after.

Hover a hero card → the reticle resolves → **click**.

> "Every swatch on Threadwyn is *generated* from the fabric's specification, not photographed. Which means we
> can go further than a picture."

Scroll slowly. The warp is strung; the shuttle starts flying; cloth appears behind it.

> "This is that fabric's actual weave being made. The interlacing follows its real lift plan — a plain weave
> alternates every end, a twill steps one each pick, a satin scatters its binding points across five. Warp
> count comes from the GSM. It's procedural, so it runs on all sixty fabrics, not one hand-built demo."

Keep scrolling into the analysis.

> "Then it explains itself. Thread count, cover factor, fibres per yarn — derived from the stored weight and
> weave, and every estimate is labelled as an estimate with the arithmetic shown."

Open the derivation `<details>` for one beat.

> "And this is why it costs $5.70 a metre: this much yarn, spun this fine, on a loom running this slowly."

**If asked why not a downloaded 3D model:** it would be one fabric, a licence, and an asset that can render
the wrong cloth. Procedural runs on all sixty and is always correct.

---

## 2 · Natural-language search (50s)

Go to the marketplace. Click the search bar.

Type: **`breathable cotton for summer shirting under $4 with at least 2000m in stock`**

> "That becomes structured filters — and here's the part that matters."

Point at the chips.

> "It shows you exactly what it decided, and every one is removable. The AI writes filters into the URL and
> then the *same* deterministic query runs that the sidebar uses. It never gets its own private results, and
> it can't surface something normal browsing would have hidden."

Remove one chip — results update.

> "Filters live in the URL, so this is a link you can paste to a colleague, and the back button works."

---

## 3 · The assistant (40s)

Press **⌘K**.

Ask: **"Compare linen against linen-cotton for a resort shirt."**

> "Tool-calling against the live catalogue. Every product it names came back from a database query — it can't
> invent a price or a stock figure."

Point at the provenance line under the answer.

> "It tells you which model answered. And if there's no key configured at all, a rule-based engine still
> parses the query, runs the search and writes a grounded summary. The demo can't be broken by a rate limit."

Optionally hit the mic and say something — Web Speech, native, nothing leaves the browser.

---

## 4 · Buy something (60s)

Open a product. Switch colourway — the weave re-renders in the new dyed colour.

> "True to colour, because it's rendered from the hex, not lit by whoever held the camera."

Add to cart. Go to **/cart**.

> "Grouped by mill, because that's how the order will actually split. Quantities are raised to each mill's
> minimum automatically, with the reason shown — not a checkout failure three screens later."

Checkout → delivery → review → **Place order**.

> "One basket, two mills, two orders. Each one gets its own reference and its own status ladder, so a delay
> at one never hides progress at the other."

---

## 5 · The supplier side (70s)

Switch window.

> "The mill sees only their half. They physically cannot query another supplier's rows — every query is scoped
> by supplier id."

Dashboard: point at the pending count and the inventory alerts.

> "One line telling them whether anything needs doing today."

**Orders → the new PENDING order → Accept.** Add an expected ready date.

Switch back to the buyer window, refresh **/orders**.

> "Live on the buyer's tracker."

Back to supplier. **Inventory → adjust stock on a fabric → set it to zero.**

> "Zero stock takes it off the marketplace automatically. Restock and it comes back. The supplier never has to
> remember to flip a status field."

Show **Add a fabric** briefly — the live swatch preview updating as you change weave and GSM.

> "They never need a photographer. Enter the specs and the swatch renders itself."

---

## 6 · Onboarding (35s)

> "One more. Registration ends in a conversation, not a twelve-field form."

Show `/onboarding` (a fresh account, or just describe it).

> "Four scripted questions — scripted, so it can't wander, and it works with no model at all. What the AI does
> is the tedious part: reading a free-form answer back into structured fields."

Land on the review step.

> "And then it shows you everything it inferred, highlighted, editable, before anything is saved. The AI
> proposes. The user disposes. That rule holds everywhere in this product."

---

## 7 · Close (20s)

> "Postgres and Prisma, a versioned REST API with a service layer, JWT with role-based access enforced
> server-side on every route. Typecheck and lint clean, production build green.
>
> Payments, escrow and logistics are out of scope — the brief excluded them, and I'd rather have depth on
> order fan-out and inventory correctness than a fake Stripe button."

---

## Questions you should expect

**Why not MERN?**
Postgres, because orders and inventory are relational and I need transactional stock decrement. Next.js route
handlers are Node handlers, so the backend requirement is met without a second process. Same architecture,
better fit.

**Is the AI real?**
Yes, and it degrades on purpose. Hugging Face when a token is set, a local Ollama in development, and a
deterministic engine when neither is available. All three paths answer.

**How does this scale?**
Search is a lexical prefilter plus in-process cosine rerank — fine to tens of thousands of SKUs. Past that it
moves to pgvector with HNSW; the ranking code doesn't change. Cart and order writes are already
transactional.

**How long did it take?**
One build. The seed is 60 fabrics with real mill specifications — GSM, composition, MOQ and lead times that
an Indian mill would actually quote — because a marketplace demo full of "Product 1, $1" tells you nothing
about whether the filters do useful work.
