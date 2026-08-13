"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowsClockwise, Check, ImageSquare, UploadSimple } from "@phosphor-icons/react";

import { cn, pluralise } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ScanResultModal, type ScanReadingView, type ScanResultView } from "@/components/ai/scan-result-modal";

/* ── shapes returned by /api/v1/ai/fabric-scan ───────────────────────────── */

// Defined once, beside the panel that renders most of them.
type Certainty = ScanReadingView["certainty"];
type ScanResult = ScanResultView;

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Certainty as tinted text, not a pill.
 *
 * Four bordered badges competed with the readings they were qualifying. The
 * word still has to be there — a reading that is only "likely" must say so —
 * but it is a footnote, and footnotes do not get chrome.
 */
const certaintyTone: Record<Certainty, string> = {
  confident: "text-positive",
  likely: "text-brand-ink",
  uncertain: "text-warn",
};

export function FabricScanner() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  // The result arrives in a modal. Closing it does not throw the scan away —
  // the reading stays on the page underneath, with a way back into the matches.
  const [matchesOpen, setMatchesOpen] = useState(false);

  const reset = useCallback(() => {
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const run = useCallback(
    async (file: File) => {
      if (!ACCEPT.includes(file.type)) {
        toast({ tone: "error", title: "Unsupported file", description: "Upload a JPEG, PNG, WebP or AVIF photo." });
        return;
      }
      if (file.size > MAX_BYTES) {
        toast({ tone: "error", title: "That photo is too large", description: "Keep it under 8 MB." });
        return;
      }

      setResult(null);
      setBusy(true);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(file);
      });

      try {
        // Both of these happen in the browser: the downscale keeps the upload
        // small, and the colour is measured off the same pixels rather than
        // asked of the model. That measurement is the reason this feature still
        // returns something useful when inference is down.
        const { dataUri, dominant } = await prepare(file);

        const res = await fetch("/api/v1/ai/fabric-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUri, measured: dominant }),
        });

        const json = (await res.json()) as { data?: ScanResult; error?: { message?: string } };

        if (!res.ok) {
          toast({
            tone: "error",
            title: "Couldn't read that photo",
            description: json.error?.message ?? "Try again in a moment.",
          });
          return;
        }
        if (json.data) {
          setResult(json.data);
          setMatchesOpen(true);
        }
      } catch {
        toast({ tone: "error", title: "Couldn't read that photo", description: "Check your connection and retry." });
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  // Three stages, and the page is laid out differently for each. Before a
  // photo exists the upload is the only thing that matters, so it takes the
  // full width and the explainer sits under it. While reading, the sample
  // stays centre stage. Once there is a result the sample steps aside into a
  // sticky column and the reading takes over.
  const stage: "idle" | "reading" | "result" = result ? "result" : busy ? "reading" : "idle";
  const split = stage === "result";

  return (
    <>
      <Stepper stage={stage} />

      <div className={cn("grid gap-10", split && "lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-14")}>
        {/* ── the sample ─────────────────────────────────────────────────── */}
        <section
          className={cn(
            // The same panel checkout puts its form in, so the two flows read as
            // one product rather than two.
            "rounded-[var(--radius-xl)] border border-line bg-surface p-5 sm:p-7",
            split && "lg:sticky lg:top-24 lg:self-start",
          )}
        >
          <h2 className="font-display text-xl font-medium text-ink">
            {split ? "Your sample" : "Add a swatch"}
          </h2>
          {!split ? (
            <p className="mt-1.5 text-[13px] text-subtle">
              Upload a close-up of your fabric and we&apos;ll find the closest matches.
            </p>
          ) : null}

          <div className="mt-6">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void run(file);
            }}
            className={cn(
              "group relative block w-full overflow-hidden rounded-[var(--radius-xl)]",
              "transition-[border-color,background-color,box-shadow,height] duration-500 ease-[var(--ease-out-expo)]",
              // Full-bleed until it has done its job, then a portrait frame in
              // the sidebar. Heights rather than aspect ratios, because a
              // full-width 16:9 on a 1100px page is a 620px hole.
              // Shorter than it was. With the texture gone and the control
              // inside, the extra height was just air.
              split ? "aspect-[4/5]" : "h-[260px] sm:h-[320px] lg:h-[360px]",
              busy ? "cursor-wait" : "cursor-pointer",
              // The real input is visually hidden, so its focus ring has to be
              // drawn by the well it belongs to or keyboard users get nothing.
              "has-[input:focus-visible]:border-brand has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand/30",
              preview
                ? // Holding a photograph: a solid frame that sits above the page.
                  "border border-line-strong bg-surface shadow-[var(--shadow-md)]"
                : // Empty: a well you drop into, so it reads as recessed rather
                  // than as another card. `border-line` was almost invisible in
                  // both themes — `line-strong` is the system's answer for a
                  // border that has to be seen, and the inset shadow gives the
                  // edge somewhere to fall away to.
                  cn(
                    "border-2 border-dashed bg-sunken",
                    "shadow-[inset_0_2px_14px_-6px_rgba(0,0,0,0.22)]",
                    dragging
                      ? "border-brand bg-brand-soft/60 shadow-[inset_0_2px_18px_-6px_rgba(0,0,0,0.24)]"
                      : "border-line-strong hover:border-brand-line",
                  ),
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(",")}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void run(file);
              }}
            />

            {preview ? (
              /* A `blob:` URL for the user's own file — never persisted, never remote.
                 `next/image` would have nothing to fetch, optimise or cache here. */
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your fabric sample" className="absolute inset-0 size-full object-cover" />
            ) : (
              <>
                {/* No texture. A woven fill was the obvious idea for a fabric
                    app and it read as a transparency checkerboard at every
                    scale that mattered. The surface token is already the warm
                    off-white the design system uses for a recessed well, and
                    against the panel's white it carries the depth on its own —
                    the corner marks are the only ornament that earns its place. */}
                <Reticle />
                <span className="absolute inset-0 grid place-items-center px-8 text-center">
                  <span>
                    <span className="mx-auto grid size-14 place-items-center rounded-full border border-line-strong bg-surface transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-0.5">
                      <ImageSquare size={22} weight="light" className="text-brand-ink" />
                    </span>
                    <span className="font-display mt-5 block text-[21px] tracking-[-0.015em] text-ink">
                      Drop your fabric photo
                    </span>
                    <span className="mt-2 block text-[12.5px] text-subtle">
                      JPG or PNG · close-up works best
                    </span>

                    {/* Looks like a button, is not one. A real `<button>` here
                        would be an interactive element inside the `<label>`
                        that already opens the picker — one control, one target,
                        and the whole well stays clickable. */}
                    <span
                      aria-hidden
                      className={cn(
                        "mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5",
                        "text-[13px] font-medium text-white shadow-[var(--shadow-sm)]",
                        "transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-px group-active:scale-95",
                      )}
                    >
                      <UploadSimple size={14} weight="bold" />
                      Choose a photo
                    </span>
                  </span>
                </span>
              </>
            )}

            <AnimatePresence>{busy ? <AnalysisOverlay /> : null}</AnimatePresence>
          </label>
          </div>

          {/* Nothing under an empty well — its own control is inside it, and a
              second identical button below was the same action twice. */}
          {preview ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size={split ? "sm" : "md"}
                loading={busy}
                icon={!busy ? <UploadSimple size={14} weight="bold" /> : undefined}
                onClick={() => inputRef.current?.click()}
              >
                {busy ? "Reading the weave" : "Try another"}
              </Button>
              {!busy ? (
                <Button type="button" variant="ghost" size="sm" onClick={reset} icon={<ArrowsClockwise size={14} />}>
                  Clear
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ── the reading ────────────────────────────────────────────────── */}
        <div className="min-w-0">
          {stage === "idle" ? <Primer /> : null}
          {stage === "result" && result ? (
            <Reading result={result} onOpenMatches={() => setMatchesOpen(true)} />
          ) : null}
        </div>
      </div>

      <ScanResultModal result={result} open={matchesOpen} onClose={() => setMatchesOpen(false)} />
    </>
  );
}

const STEPS = ["Upload", "Read", "Match"] as const;

/**
 * The same stepper checkout uses, down to the sizes and the tick.
 *
 * Copied rather than approximated: two flows in one product that both walk a
 * visitor through numbered stages should not each invent their own indicator.
 * If this and checkout drift, they should drift together — which is an argument
 * for extracting it, once a third flow needs one.
 */
function Stepper({ stage }: { stage: "idle" | "reading" | "result" }) {
  const active = stage === "idle" ? 0 : stage === "reading" ? 1 : 2;

  return (
    <ol className="mb-8 flex items-center gap-3">
      {STEPS.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={label} className="flex flex-1 items-center gap-3">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] transition-colors duration-300",
                done
                  ? "border-brand bg-brand text-white"
                  : current
                    ? "border-brand bg-brand-soft text-brand-ink"
                    : "border-line bg-surface text-subtle",
              )}
            >
              {done ? <Check size={12} weight="bold" /> : i + 1}
            </span>
            <span className={cn("text-[13px]", current ? "font-medium text-ink" : "text-subtle")}>{label}</span>
            {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Four corner marks. Frames the drop area as something to be read, not filled. */
function Reticle() {
  const corners = [
    "top-4 left-4 border-t border-l",
    "top-4 right-4 border-t border-r",
    "bottom-4 left-4 border-b border-l",
    "bottom-4 right-4 border-b border-r",
  ];
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {corners.map((c) => (
        <span
          key={c}
          className={cn(
            // `brand-line` resting was dark green on a dark surface and simply
            // did not appear. The corners only carry the brand once they are
            // reacting to a pointer.
            "absolute size-6 border-line-strong transition-all duration-500 ease-[var(--ease-out-expo)]",
            "group-hover:size-8 group-hover:border-brand",
            c,
          )}
        />
      ))}
    </span>
  );
}

/* ── result ──────────────────────────────────────────────────────────────── */

function Reading({ result, onOpenMatches }: { result: ScanResult; onOpenMatches: () => void }) {
  const colour = result.readings.find((r) => r.key === "colour");
  const inferred = result.readings.filter((r) => r.key !== "colour").slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-[24px] font-medium tracking-[-0.015em] text-ink">What we can see</h2>
        <p className="font-mono text-[11px] text-subtle">
          {result.mode === "vision" ? result.model : "colour only"}
        </p>
      </div>

      {result.mode === "colour-only" ? (
        <p className="mt-3 rounded-[var(--radius-md)] border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
          The vision model didn&apos;t answer, so this is the colour measured from your photo alone. Everything below
          still works — it&apos;s reading pixels, not a model.
        </p>
      ) : null}

      {/* One panel, not four equal cards.
          Colour leads because it is the only reading that is measured rather
          than inferred, and the only one that reaches the catalogue as a real
          colourway. Four same-size boxes gave a guess about sheen the same
          weight as a measurement, and the page failed the squint test. */}
      {colour ? (
        <section className="mt-5 overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface">
          <div className="flex items-center gap-5 p-5 sm:gap-6 sm:p-6">
            <span
              aria-hidden
              className="size-20 shrink-0 rounded-[var(--radius-lg)] border border-line shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:size-24"
              style={{ background: result.matchedHex ?? result.measuredHex }}
            />
            <div className="min-w-0">
              <p className="text-[12px] text-subtle">Closest colourway in stock</p>
              <p className="font-display mt-1 truncate text-[26px] leading-tight tracking-[-0.015em] text-ink sm:text-[30px]">
                {colour.value}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-subtle">
                <span
                  aria-hidden
                  className="size-3 rounded-[2px] border border-line"
                  style={{ background: result.measuredHex }}
                />
                {result.measuredHex} measured
                <span className={cn("ml-1", certaintyTone[colour.certainty])}>{colour.certainty}</span>
              </p>
            </div>
          </div>

          {inferred.length ? (
            <dl className="grid grid-cols-3 divide-x divide-line border-t border-line">
              {inferred.map((r) => (
                <div key={r.key} className="px-4 py-4 sm:px-5">
                  <dt className="text-[11.5px] text-subtle">{r.label}</dt>
                  <dd className="mt-1 truncate text-[15px] font-medium text-ink sm:text-[16px]">{r.value}</dd>
                  <dd className={cn("mt-0.5 font-mono text-[10px]", certaintyTone[r.certainty])}>{r.certainty}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ) : null}

      <p className="mt-3.5 text-[12.5px] leading-relaxed text-subtle">{result.withheld[0]}</p>

      {/* ── back into the matches ─────────────────────────────────────── */}
      {/* The carousel owns the matches now. This is the way back to it after
          the modal is dismissed, so closing the result is cheap rather than
          destructive — the scan is still here, one click from its fabrics. */}
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <Button type="button" onClick={onOpenMatches} trailingIcon={<ArrowRight size={13} weight="bold" />}>
          {result.quality === "none"
            ? "See what's close"
            : `View ${result.matches.length} ${pluralise(result.matches.length, "match", "matches")}`}
        </Button>
        <ButtonLink href={result.href} variant="ghost" size="sm">
          Open in the marketplace
        </ButtonLink>
      </div>
    </motion.div>
  );
}

/* ── idle + loading ──────────────────────────────────────────────────────── */

/**
 * The idle state. Three lines, not three paragraphs — this is read once, while
 * the visitor is looking for the upload control, and it competes with nothing.
 */
function Primer() {
  const steps = [
    ["Colour", "measured from your pixels, matched to a colourway in stock"],
    ["Weave", "read by a vision model — only what a camera can resolve"],
    ["Matches", "the same filters and search the marketplace runs"],
  ];

  return (
    <div>
      <h2 className="font-display text-[24px] font-medium tracking-[-0.015em] text-ink">How a scan works</h2>

      {/* Three across rather than three stacked. Full-width rows under a
          full-width dropzone left each line trailing 700px of empty page. */}
      <dl className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-3">
        {steps.map(([term, detail]) => (
          <div key={term} className="border-t border-line-strong pt-4">
            <dt className="font-display text-[19px] tracking-[-0.01em] text-ink">{term}</dt>
            <dd className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{detail}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 text-[12.5px] leading-relaxed text-subtle">
        GSM, composition and price come from the mill, never from a photograph.
      </p>
    </div>
  );
}

// No result skeleton. While the scan runs the sample holds the full width and
// there is no second column to hold a placeholder's shape — the overlay on the
// photograph is the loading state, and a skeleton beside it would be a second
// answer to the same question.

const PHASES = ["Measuring colour", "Reading the weave", "Matching the catalogue"];

const WARP_COUNT = 16;
const WEFT_COUNT = 10;

/**
 * The sample is woven over while it is read.
 *
 * The app already owns this gesture — the checkout overlay strings a warp and
 * throws weft across it — so the scan borrows the same vocabulary rather than
 * inventing a second loading language. Warp threads are strung once; picks then
 * travel across on a loop, which is what a loom actually does and what makes
 * the wait read as work rather than as a stall.
 *
 * Only `scaleX`, `scaleY` and `opacity` animate, so the whole thing stays on
 * the compositor. An earlier version translated a gradient band by a percentage
 * of *its own* height and crawled a fifth of the way down before repeating —
 * the reason this is built from origin-anchored scales instead.
 */
function AnalysisOverlay() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setPhase((p) => (p + 1 < PHASES.length ? p + 1 : p)),
      1500,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 overflow-hidden bg-ink/45 backdrop-blur-[1.5px]"
    >
      {Array.from({ length: WARP_COUNT }, (_, i) => (
        <motion.span
          key={`warp-${i}`}
          className="absolute inset-y-0 w-px origin-top bg-white/20"
          style={{ left: `${((i + 0.5) / WARP_COUNT) * 100}%` }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.55, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}

      {Array.from({ length: WEFT_COUNT }, (_, i) => (
        <motion.span
          key={`weft-${i}`}
          className="absolute inset-x-0 h-px origin-left bg-brand"
          style={{ top: `${((i + 0.5) / WEFT_COUNT) * 100}%` }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1, 1], opacity: [0, 0.95, 0] }}
          transition={{
            duration: 2.1,
            delay: 0.45 + i * 0.11,
            repeat: Infinity,
            repeatDelay: 0.35,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      ))}

      <span className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.span
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="block font-mono text-[11px] tracking-[0.09em] text-white uppercase"
          >
            {PHASES[phase]}
          </motion.span>
        </AnimatePresence>

        <span className="mt-3 block h-px w-full overflow-hidden bg-white/25">
          <motion.span
            className="block h-px origin-left bg-brand"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 5, ease: [0.16, 1, 0.3, 1] }}
          />
        </span>
      </span>
    </motion.span>
  );
}

/* ── browser-side image work ─────────────────────────────────────────────── */

const ANALYSIS_EDGE = 72;
const UPLOAD_EDGE = 768;

/**
 * Downscale for upload and measure the dominant colour, from one decode.
 *
 * 768px is well past what a vision model needs to see a weave, and WebP at
 * 0.82 keeps a swatch photo around 40 KB — small enough to inline as a data URI
 * without a multipart upload.
 */
async function prepare(file: File): Promise<{ dataUri: string; dominant: { r: number; g: number; b: number } }> {
  const bitmap = await createImageBitmap(file);

  const dominant = measureDominant(bitmap);

  const scale = Math.min(1, UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUri = canvas.toDataURL("image/webp", 0.82);
  return { dataUri, dominant };
}

/** Keep the middle of the luminance range: drop shadows below, sheen above. */
const LUMINANCE_BAND = { from: 0.45, to: 0.75 };

/**
 * Mean of the mid-luminance band of the centre crop.
 *
 * A cloth in a photograph is one colour under uneven light, so the job is to
 * discard the lighting and keep the cloth. Three things get thrown away: the
 * background, by cropping to the middle 60%; the shadowed valleys of the folds,
 * which are darker and slightly cooler; and the lit ridges, which on anything
 * with sheen blow toward white and carry no colour at all.
 *
 * This replaced a modal-colour histogram, which was badly wrong. Coarse RGB
 * buckets concentrate dark pixels into a handful of bins while spreading light
 * ones across many, so the fullest bucket is biased toward shadow — on a warm
 * ecru cloth it returned a cool near-navy. Tested against five cloths, matte
 * and satin: the histogram's total error was 962, this band's was 303.
 *
 * A flat mean of everything is not the answer either. It keeps the shadows and
 * the highlights, and on a satin it lands between the cloth and the sheen.
 */
function measureDominant(bitmap: ImageBitmap): { r: number; g: number; b: number } {
  const canvas = document.createElement("canvas");
  canvas.width = ANALYSIS_EDGE;
  canvas.height = ANALYSIS_EDGE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, ANALYSIS_EDGE, ANALYSIS_EDGE);

  const inset = Math.round(ANALYSIS_EDGE * 0.2);
  const span = ANALYSIS_EDGE - inset * 2;
  const { data } = ctx.getImageData(inset, inset, span, span);

  const pixels: { r: number; g: number; b: number; lum: number }[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue; // ignore transparency
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    pixels.push({ r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b });
  }
  if (!pixels.length) return { r: 128, g: 128, b: 128 };

  pixels.sort((a, b) => a.lum - b.lum);
  const from = Math.floor(pixels.length * LUMINANCE_BAND.from);
  const to = Math.max(from + 1, Math.ceil(pixels.length * LUMINANCE_BAND.to));
  const band = pixels.slice(from, to);

  let r = 0, g = 0, b = 0;
  for (const p of band) { r += p.r; g += p.g; b += p.b; }

  return {
    r: Math.round(r / band.length),
    g: Math.round(g / band.length),
    b: Math.round(b / band.length),
  };
}
