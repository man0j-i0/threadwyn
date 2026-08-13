# Fabric scan

A photograph of a swatch becomes the same `ProductFilters` a click would.

Added after the final-round feedback. The rest of Threadwyn assumes a buyer can
already name what they want — "cotton poplin, 120 gsm, under $4". A buyer holding
a swatch cut off an existing garment usually cannot, and that is the more common
starting point in sourcing. So this is a second door into the same catalogue.

---

## 1. The claim, and its limits

The demo-friendly version of this feature reads a photo and reports material,
GSM, quality, sustainability and a price band. Most of that is not knowable from
an image, and asserting it would be the most fragile thing in the app.

What a camera can genuinely resolve:

| Reading | Source | Certainty | Filters? |
|---|---|---|---|
| Colour | measured pixels | from the match distance | **yes** |
| Weave | vision model | likely | **yes** |
| Surface | vision model | likely | no |
| Weight | vision model | uncertain, always | no |

Withheld on purpose, and said so on screen:

> GSM, composition and width are physical measurements — they come from the
> mill, not the photograph. Fibre is not guessed here: cotton, viscose and spun
> polyester are near identical in a photo. Price, lead time and certification
> are supplier data.

**Fibre is not asked at all.** An earlier version asked and labelled the answer
"uncertain", but a fibre question is inherently multi-option, and multi-option
questions are exactly what this model fails at (§3). It would have returned
"cotton" for everything. Not asking is more honest than asking and hedging.

**Weight is pinned to `uncertain` in code.** The question that produces it —
*open or dense?* — is a fair thing to ask a photograph, but it is a proxy for
weight rather than a reading of it, and both test swatches came back "dense".
Not enough evidence to let it narrow the catalogue.

### Why there are no confidence percentages

A chat model asked for "91%" emits a plausible-looking number. There is no
softmax behind it — it is not a classifier, and the figure is not calibrated.
Printing it on a card styled as a metric would make a guess look like a
measurement.

So certainty is three words: **confident / likely / uncertain**. For the model's
readings it is a fixed property of the attribute. For colour it is derived from
an actual distance — see below.

---

## 2. Two tiers, same as everywhere else

```
      photo
        │
        ├── pixels ──► dominant colour ──► nearest colourway in stock   ALWAYS
        │
        └── model ───► weave, surface, weight                           WHEN UP
                                    │
                                    ▼
                          ProductFilters
                                    │
                                    ▼
                    searchProducts()  ── the marketplace's own query
```

Every other AI surface in this app degrades to the deterministic engine when the
provider is down. **There is no regex that reads a photograph**, so this one
degrades to the colour tier instead. That is the reason colour is measured in
the browser rather than asked of the model — and it is also just the better
answer, because pixels beat inference at naming a colour.

`completeVision()` returns `null` rather than throwing, so a dead token, a 500
or a timeout all land in the same place: `mode: "colour-only"`, and the page
says so in plain words rather than showing an error.

### The colour tier

A cloth in a photograph is one colour under uneven light. The job is to discard
the lighting and keep the cloth, and it took two fixes to get there — both found
by a real photo of undyed cotton coming back **"Powder Blue"**.

**Measuring.** The browser crops to the middle 60% (losing the desk), sorts the
pixels by luminance, and averages the **45th–75th percentile band**. That drops
the shadowed valleys of the folds below and, on anything with sheen, the blown
ridges above.

The first version took the modal colour from a coarse RGB histogram. It was
badly wrong: fixed-width buckets concentrate dark pixels into a handful of bins
while spreading light ones across many, so the fullest bucket is biased toward
shadow. On a warm ecru cloth it returned a cool near-navy. Across five test
cloths, matte and satin, its total error was **962** against the band's **303**.

An earlier candidate scored a perfect zero and was rejected for it — the band
70–95% matched the synthetic exactly because that scene's brightest pixels were
unshaded cloth *by construction*. Adding a satin with specular highlights sent
it from best to nearly worst. A test you designed to pass is not evidence.

**Naming.** [`src/lib/colour.ts`](../src/lib/colour.ts) uses **redmean**
distance, a cheap perceptual approximation — plain Euclidean RGB treats a shift
in blue as being as visible as the same shift in green, which pushes two
near-identical neutrals apart, and this catalogue is full of ecrus and naturals.

But redmean alone was still wrong, because **a swatch is flat colour and a photo
is a lit object**. Every honest estimate reads darker than the swatch it should
match, and that darkness dominated the score: warm ecru scored closer to Silver
Grey than to Ecru — a hue error produced entirely by brightness. So
`litDistance` rescales the measurement to each swatch's brightness before
comparing, leaving colour rather than lighting, and adds back a small lightness
term so a dim cloth cannot match a pale swatch of the same hue outright.

That term has to be *small*. A 70-unit luminance gap is unremarkable indoors; at
weight 0.35 it contributed 24 to the score while a near-perfect hue match
contributed 2, which put undyed cotton back on Silver Grey. At **0.15** hue
decides and lightness only breaks ties. Every swatch still matches itself
exactly, Camel and Espresso stay apart, and a genuinely cool cloth stays cool.

The palette is not hardcoded. `getColourwayPalette()` reads the distinct
colourways **currently in stock on live products**, so the colour reported is
always one a supplier actually listed, always orderable, and always a term that
appears in `searchText` — which is what makes `q=Ecru` work at all.

Distance also sets certainty: `≤40` confident, `≤110` likely, beyond that
uncertain — and an uncertain colour is shown but not filtered on.

---

## 3. The model will not classify, so it doesn't have to

This is the part worth telling. The first version of the prompt asked for one
JSON object with a ten-option weave enum:

```
{"weave":"plain|twill|satin|jacquard|...|unknown", "weight":..., "fibre":..., "surface":...}
```

Tested against two generated swatches — an ecru plain weave and an indigo 2/1
twill with an obvious diagonal — it returned `"weave":"plain"` for **both**.

The control run is what settled it: **the same prompt with no image attached at
all** returned the same JSON. The leading option in the enum was outscoring the
photograph.

The model is not the problem. Asked plainly, it reads those images correctly:

| Question asked | plain swatch | twill swatch |
|---|---|---|
| "What colour is this?" | Beige ✅ | Navy blue ✅ |
| "Describe the interlacing" | grid ✅ | diagonal ✅ |
| "grid or diagonal?" — 3 runs each | grid ×3 ✅ | diagonal ×3 ✅ |
| **the ten-option JSON enum** | plain ✅ | **plain** ❌ |

Four prompt shapes were tried before landing: reordering the enum so `plain` was
last, adding a `structure` field to force an observation first, prose-then-JSON,
and splitting into two parallel calls. **Every one of them still said "plain"
for the twill.** Only low-cardinality questions worked.

So the prompt asks three binaries and nothing else:

```
grid or diagonal
matte or glossy
open or dense
```

and `composeWeave()` turns the answers into a catalogue weave in ordinary,
unit-tested code:

```
diagonal        → TWILL
grid + glossy   → SATIN
grid + matte    → PLAIN
anything else   → null, and no weave filter at all
```

4/4 on the swatches that the JSON version got 50% on, in ~2s.

A fourth question — *knitted or woven* — was tried and cut. It called the twill
swatch "knitted" on the same request where the interlacing line correctly said
"diagonal", and because construction was checked first it overrode the good
answer. One unreliable input outranking a reliable one is worse than not asking.

Jacquard, dobby, herringbone, rib, canvas and crepe are simply not claimed. They
resolve to `null`, which means no weave filter — the honest outcome, and one the
relaxation ladder already handles.

**The generalisable point:** the model reports what it sees; deciding what that
makes the fabric is not its job. That is also what makes the decision testable —
`composeWeave` and `parseBinaryReading` are pure functions with unit tests, and
none of that would be possible if the classification lived inside the prompt.

---

## 4. The rule worth defending

> **An uncertain reading is displayed but never filtered on.**

One line in `scanFabric`, and it is the difference between "here is what I think
I see" and "I have hidden everything that disagrees with what I think I see". It
is what stops a soft visual impression from emptying the grid.

It is also invisible when it works, which is why it has its own tests in
[`fabric-scan.test.ts`](../src/lib/ai/fabric-scan.test.ts).

---

## 5. Matching degrades too

The first real photo tested read correctly — ecru, plain weave, midweight — and
matched **zero** fabrics. Three ANDed constraints against a 60-item catalogue
returns nothing far more often than it returns something, and an empty grid is
the wrong answer to "find me cloth like this".

`relaxationLadder()` gives up one reading at a time:

| Rung | Given up | Why it goes first |
|---|---|---|
| 1 | — | the full reading |
| 2 | weight | a band inferred from how open the cloth looks; excludes the most rows |
| 3 | + colour | real, but the same fabric usually exists in other colourways |
| 4 | + weave | structural, and the last to go: a twill is not a substitute for a poplin |

The route walks it **tightest-first and tops up** rather than stopping at the
first hit. Both halves matter:

- Stopping at the first non-empty rung is precise but returned *one* row, which
  reads as a broken recommender.
- Jumping straight to a loose query fills the list but loses the exact match —
  with `q` dropped there is no relevance signal left to rank it up, so the best
  answer falls out of the top four.

So exact hits keep their place at the head of the list, looser rungs fill the
rest, and the page states what was set aside.

---

## 6. Where it sits

```
POST /api/v1/ai/fabric-scan      rate limited 10/min — tighter than the text
                                 routes, because a vision call ships an image
GET  /scan                       the page
```

Open to signed-out visitors on purpose: a buyer holding a swatch has no reason
to have an account yet. Rate limiting, not authentication, is what stops it
being a free vision endpoint.

**The image is never stored.** It is held for one request and dropped — no row,
no blob, no log line. The existing `POST /api/v1/images` was not reused: it is
supplier-only and writes to `UploadedImage`, which is right for a product photo
and wrong for a buyer's throwaway reference.

Results return as a filter set and a `/marketplace` href, so a scan is a
shareable link and its chips are editable — exactly like the `?ask=` path. The
scan never gets its own results page and cannot surface a fabric the ordinary
search would hide.

One deviation: `describeFilters` omits a chip for `q` because the marketplace
renders the text query in its search box. There is no search box on `/scan`, so
`chipsFor()` adds it locally rather than changing the shared behaviour.

---

## 7. The model

`Qwen2.5-7B-Instruct` — the chat tier — is text-only. Vision is a different
*model*, not a different provider: same HF router, same token, same
OpenAI-compatible body, `content` becomes an array of parts.

Probed against a synthetic plain-weave swatch before any UI was written:

| Model | Latency | Read |
|---|---|---|
| **`google/gemma-3-27b-it`** | **1.9s** | `plain` / `pale beige` / `cotton` / `light` |
| `Qwen/Qwen2.5-VL-72B-Instruct` | 2.2s | called it `twill` ✗ |
| `zai-org/GLM-4.5V` | 4.3s | empty content ✗ |
| `Qwen2.5-VL-7B`, `Llama-3.2-11B-Vision` | — | not served on this token |

Worth recording that **this probe was more flattering than it deserved**. It ran
the ten-option JSON prompt, so gemma's `"plain"` was the enum's leading option,
not a reading of the cloth — right answer, wrong reason, and it took the twill
swatch in §3 to expose that. The colour it returned was genuine. Model selection
happened to land correctly; the reasoning behind it did not survive scrutiny.

Gemma is first in `visionCandidates()`, Qwen-VL-72B behind it as a second
opinion. Both resolve as bare ids — unlike the chat tier, neither needed a
provider pin. Override with `HF_VISION_MODEL`.

**The second opinion is currently unavailable.** Qwen-VL-72B began returning
`402` partway through this work — its serving provider bills separately, and
that budget is spent while gemma's is not. It stays in the list because the
cost of a dead candidate is one wasted request per process, and only when gemma
has already failed.

The empty-content case is handled explicitly: a model that answers with nothing
is treated as a miss so the next candidate gets a turn.

Vision timeout is **15s**, tighter than the chat tier's 20s, because the
fallback is instant. If gemma has not answered in fifteen seconds it is not
worth waiting for and the measured colour is already in hand.

---

## 8. Not built

- **Camera capture.** Upload only. `capture="environment"` on the input is a
  one-line addition if a phone demo needs it.
- **Image embeddings / vector search.** Matching goes through the existing
  lexical + hashing-embedding path. A real visual-similarity search wants CLIP
  embeddings stored per product and a proper ANN index — that is a different
  project, not a flag.
- **Storing scans.** Nothing to learn from until there is traffic, and it would
  turn a zero-retention feature into a data-protection question.
- **Fibre confirmation.** The honest version is the mill's spec sheet, which is
  already on the product page.
