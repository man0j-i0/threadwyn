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
| Colour | measured pixels | by measurement | **yes** |
| Weave | vision model | likely | **yes** |
| Weight | vision model | likely | **yes** |
| Likely fibre | vision model | uncertain, always | no |
| Surface | vision model | likely | no |

Withheld on purpose, and said so on screen:

> GSM, composition and width are physical measurements — they come from the
> mill, not the photograph. Price, lead time and certification are supplier data.

**Fibre is pinned to `uncertain` in code, not by the model's own judgement.**
Cotton, viscose and spun polyester are close to indistinguishable in a
photograph; the difference is a burn test or a lab, not a camera.

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
        └── model ───► weave, weight, fibre, surface                    WHEN UP
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

The browser takes the **modal colour of the centre crop**, not a flat average.
A flat average is wrong twice: a swatch photographed on a desk averages the desk
in, and the mean of a patterned cloth lands on a colour that is nowhere in it.
So: middle 60% of the frame, a coarse 3-D histogram, the fullest bucket, then
the true mean of only the pixels inside it.

Naming uses [`src/lib/colour.ts`](../src/lib/colour.ts) with **redmean**
distance — a cheap perceptual approximation. Plain Euclidean RGB treats a shift
in blue as being as visible as the same shift in green, which pushes two
near-identical neutrals apart; on a catalogue this full of ecrus and naturals
that matters.

The palette is not hardcoded. `getColourwayPalette()` reads the distinct
colourways **currently in stock on live products**, so the colour reported is
always one a supplier actually listed, always orderable, and always a term that
appears in `searchText` — which is what makes `q=Ecru` work at all.

Distance also sets certainty: `≤40` confident, `≤110` likely, beyond that
uncertain — and an uncertain colour is shown but not filtered on.

---

## 3. The rule worth defending

> **An uncertain reading is displayed but never filtered on.**

One line in `scanFabric`, and it is the difference between "here is what I think
I see" and "I have hidden everything that disagrees with what I think I see". It
is what stops a shaky fibre guess from emptying the grid.

It is also invisible when it works, which is why it has its own tests in
[`fabric-scan.test.ts`](../src/lib/ai/fabric-scan.test.ts).

---

## 4. Matching degrades too

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

## 5. Where it sits

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

## 6. The model

`Qwen2.5-7B-Instruct` — the chat tier — is text-only. Vision is a different
*model*, not a different provider: same HF router, same token, same
OpenAI-compatible body, `content` becomes an array of parts.

Probed against a synthetic plain-weave swatch before any UI was written:

| Model | Latency | Read |
|---|---|---|
| **`google/gemma-3-27b-it`** | **1.9s** | `plain` / `pale beige` / `cotton` / `light` ✅ |
| `Qwen/Qwen2.5-VL-72B-Instruct` | 2.2s | called it `twill` ✗ |
| `zai-org/GLM-4.5V` | 4.3s | empty content ✗ |
| `Qwen2.5-VL-7B`, `Llama-3.2-11B-Vision` | — | not served on this token |

Gemma is first in `visionCandidates()`, Qwen-VL-72B behind it as a second
opinion. Both resolve as bare ids — unlike the chat tier, neither needed a
provider pin. Override with `HF_VISION_MODEL`.

The empty-content case is handled explicitly: a model that answers with nothing
is treated as a miss so the next candidate gets a turn.

Vision timeout is **15s**, tighter than the chat tier's 20s, because the
fallback is instant. If gemma has not answered in fifteen seconds it is not
worth waiting for and the measured colour is already in hand.

---

## 7. Not built

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
