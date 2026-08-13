"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowsClockwise, ImageSquare, UploadSimple } from "@phosphor-icons/react";

import type { WeaveKey } from "@/lib/weave";
import { cn, formatMetres, formatPerMetre, pluralise } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { useToast } from "@/components/ui/toast";

/* ── shapes returned by /api/v1/ai/fabric-scan ───────────────────────────── */

type Certainty = "confident" | "likely" | "uncertain";

type ScanReading = {
  key: string;
  label: string;
  value: string;
  certainty: Certainty;
  source: "pixels" | "model";
  note?: string;
};

type Match = {
  id: string;
  slug: string;
  name: string;
  weave: WeaveKey;
  gsm: number;
  widthCm: number;
  pricePerMetre: number;
  stockMetres: number;
  moqMetres: number;
  supplier: { businessName: string; city: string };
  colorways: { id: string; name: string; hex: string }[];
};

type ScanResult = {
  readings: ScanReading[];
  chips: { key: string; label: string; value: string }[];
  href: string;
  mode: "vision" | "colour-only";
  model: string;
  measuredHex: string;
  matchedHex: string | null;
  withheld: string[];
  /** Readings given up to fill the list. */
  relaxed: string[];
  /** How many fabrics matched every reading. */
  exact: number;
  matches: Match[];
  total: number;
};

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
        if (json.data) setResult(json.data);
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
    <div className={cn("grid gap-10", split && "lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-14")}>
      {/* ── the sample ─────────────────────────────────────────────────── */}
      <div className={cn(split && "lg:sticky lg:top-24 lg:self-start")}>
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
            split ? "aspect-[4/5]" : "h-[320px] sm:h-[440px] lg:h-[520px]",
            busy ? "cursor-wait" : "cursor-pointer",
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
              {/* Real cloth behind the prompt rather than an empty rectangle.
                  It is the same renderer the catalogue uses, so the texture is
                  a woven structure and not a stock pattern. */}
              {/* Warp and weft at a fixed 7px, in CSS rather than SVG.
                  `FabricSwatch` was the obvious choice and the wrong one: it
                  slices a 400px viewBox to fill its box, so across a 1020px
                  dropzone the tile magnified into a transparency-grid
                  checkerboard — the single texture a fabric app must not show.
                  A repeating gradient is pinned to real pixels, so the thread
                  count looks the same at any width. */}
              <span
                aria-hidden
                className="absolute inset-0 opacity-50 transition-opacity duration-500 group-hover:opacity-75"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, var(--line-strong) 0 1px, transparent 1px 7px)," +
                    "repeating-linear-gradient(0deg, var(--line-strong) 0 1px, transparent 1px 7px)",
                }}
              />
              <Reticle />
              <span className="absolute inset-0 grid place-items-center px-8 text-center">
                <span>
                  <span className="mx-auto grid size-14 place-items-center rounded-full border border-line bg-surface/80 backdrop-blur-sm transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-0.5">
                    <ImageSquare size={22} weight="light" className="text-brand-ink" />
                  </span>
                  <span className="font-display mt-5 block text-[22px] tracking-[-0.015em] text-ink">
                    Drop a fabric photo
                  </span>
                  <span className="mt-2 block text-[13px] text-subtle">A close-up of the weave reads best</span>
                </span>
              </span>
            </>
          )}

          <AnimatePresence>{busy ? <AnalysisOverlay /> : null}</AnimatePresence>
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={preview ? "secondary" : "primary"}
            size={split ? "sm" : "md"}
            loading={busy}
            icon={!busy ? <UploadSimple size={14} weight="bold" /> : undefined}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Reading the weave" : preview ? "Try another" : "Choose a photo"}
          </Button>
          {preview && !busy ? (
            <Button type="button" variant="ghost" size="sm" onClick={reset} icon={<ArrowsClockwise size={14} />}>
              Clear
            </Button>
          ) : null}
          <span className="text-[12px] text-subtle">Read once, then discarded. Never stored.</span>
        </div>
      </div>

      {/* ── the reading ────────────────────────────────────────────────── */}
      <div className="min-w-0">
        {stage === "idle" ? <Primer /> : null}
        {stage === "result" && result ? <Reading result={result} /> : null}
      </div>
    </div>
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

function Reading({ result }: { result: ScanResult }) {
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

      {/* ── matches ──────────────────────────────────────────────────── */}
      <div className="mt-9">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-[22px] font-medium tracking-[-0.01em] text-ink">
            {result.total > 0 ? "Closest fabrics you can order" : "No close match in stock"}
          </h2>
          {result.total > 0 ? (
            <p className="font-mono text-[11px] text-subtle tnum">{result.total} in the catalogue</p>
          ) : null}
        </div>

        {result.relaxed.length ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-line bg-sunken px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted">
            {result.exact > 0 ? (
              <>
                Only {result.exact} {pluralise(result.exact, "fabric")} matched every reading
                {result.exact === 1 ? " — it's first below" : ""}. The rest are the closest with{" "}
                {formatList(result.relaxed)} set aside.
              </>
            ) : (
              <>
                Nothing in stock matched every reading, so {formatList(result.relaxed)}{" "}
                {result.relaxed.length > 1 ? "were" : "was"} set aside. These are the closest on what&apos;s
                left.
              </>
            )}
          </p>
        ) : null}

        {result.chips.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {result.chips.map((c) => (
              <span
                key={`${c.key}:${c.value}`}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-muted"
              >
                {c.label}
              </span>
            ))}
          </div>
        ) : null}

        {result.matches.length ? (
          <>
            {/* The payoff, sized like it. These were thin rows under a wall of
                caveats, which put the least important thing on the page at the
                top and the reason the buyer came at the bottom. Each card now
                renders the actual cloth — `FabricSwatch` draws the real weave
                at the real colour, so a twill looks like a twill. */}
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {result.matches.map((m, i) => (
                <li key={m.id}>
                  <Link
                    href={`/product/${m.slug}`}
                    className={cn(
                      "group flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] border bg-surface",
                      "transition-[border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]",
                      "hover:border-brand-line hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.18)]",
                      // The exact hit leads and is marked; the rest are near misses.
                      i === 0 && result.exact > 0 ? "border-brand-line" : "border-line",
                    )}
                  >
                    <span className="relative block aspect-[16/10] overflow-hidden bg-sunken">
                      <FabricSwatch
                        weave={m.weave}
                        hex={m.colorways[0]?.hex ?? "#C9C2B4"}
                        gsm={m.gsm}
                        seed={m.slug}
                        alt={`${m.name} in ${m.colorways[0]?.name ?? "its first colourway"}`}
                        className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
                      />
                      {i === 0 && result.exact > 0 ? (
                        <span className="absolute top-3 left-3 rounded-full bg-brand px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-white uppercase">
                          Closest
                        </span>
                      ) : null}
                    </span>

                    <span className="flex flex-1 flex-col p-4 sm:p-5">
                      <span className="font-display block text-[17px] leading-snug tracking-[-0.01em] text-ink">
                        {m.name}
                      </span>
                      <span className="mt-1 block truncate text-[12.5px] text-subtle">
                        {m.supplier.businessName} · {m.supplier.city}
                      </span>

                      <span className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3.5">
                        <span className="font-mono text-[11.5px] leading-relaxed text-subtle tnum">
                          {m.gsm} gsm · {m.widthCm} cm
                          <br />
                          {formatMetres(m.stockMetres)} in stock
                        </span>
                        <span className="text-right">
                          <span className="font-mono block text-[17px] leading-none text-ink tnum">
                            {formatPerMetre(m.pricePerMetre)}
                          </span>
                          <span className="mt-1.5 block font-mono text-[10.5px] text-subtle tnum">
                            min {formatMetres(m.moqMetres)}
                          </span>
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <ButtonLink href={result.href} size="sm" trailingIcon={<ArrowRight size={13} weight="bold" />}>
                See all {result.total} in the marketplace
              </ButtonLink>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            Nothing in stock matches that reading closely. Open the marketplace and lift one constraint — the weave is
            usually the one to drop first.{" "}
            <Link href="/marketplace" className="text-brand-ink underline underline-offset-2">
              Browse everything
            </Link>
            .
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** `["weight", "colour"]` → `"weight and colour"`. */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
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
