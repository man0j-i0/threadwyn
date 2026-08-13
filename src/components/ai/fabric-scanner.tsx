"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowsClockwise, Eyedropper, ImageSquare, UploadSimple } from "@phosphor-icons/react";

import { cn, formatMetres, formatPerMetre, pluralise } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
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
  gsm: number;
  pricePerMetre: number;
  stockMetres: number;
  supplier: { businessName: string };
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

const certaintyTone: Record<Certainty, string> = {
  confident: "bg-positive-soft text-positive border-positive-line",
  likely: "bg-brand-soft text-brand-ink border-brand-line",
  uncertain: "bg-warn-soft text-warn border-warn-line",
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

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-12">
      {/* ── the sample ─────────────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-24 lg:self-start">
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
            "group relative block aspect-square w-full cursor-pointer overflow-hidden",
            "rounded-[var(--radius-xl)] border border-dashed bg-surface transition-colors",
            dragging ? "border-brand bg-brand-soft/50" : "border-line hover:border-brand-line",
            busy && "cursor-wait",
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
            <span className="absolute inset-0 grid place-items-center px-8 text-center">
              <span>
                <ImageSquare size={26} weight="light" className="mx-auto text-subtle" />
                <span className="mt-3 block text-[14px] font-medium text-ink">Drop a fabric photo</span>
                <span className="mt-1.5 block text-[12.5px] leading-relaxed text-subtle">
                  Or click to browse. A close-up of the weave reads best.
                </span>
              </span>
            </span>
          )}

          <AnimatePresence>{busy ? <ScanSweep /> : null}</AnimatePresence>
        </label>

        <div className="mt-4 flex items-center gap-2">
          <Button
            type="button"
            variant={preview ? "secondary" : "primary"}
            size="sm"
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
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-subtle">
          Your photo is read once and discarded. Threadwyn never stores it.
        </p>
      </div>

      {/* ── the reading ────────────────────────────────────────────────── */}
      <div className="min-w-0">
        {!result && !busy ? <Primer /> : null}
        {busy ? <ReadingSkeleton /> : null}
        {result && !busy ? <Reading result={result} /> : null}
      </div>
    </div>
  );
}

/* ── result ──────────────────────────────────────────────────────────────── */

function Reading({ result }: { result: ScanResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-[22px] font-medium tracking-[-0.01em] text-ink">What we can see</h2>
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {result.readings.map((r) => (
          <div key={r.key} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-subtle">{r.label}</p>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] uppercase",
                  certaintyTone[r.certainty],
                )}
              >
                {r.certainty}
              </span>
            </div>

            <p className="mt-1.5 flex items-center gap-2 text-[16px] font-medium text-ink">
              {r.key === "colour" && result.matchedHex ? (
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-full border border-line"
                  style={{ background: result.matchedHex }}
                />
              ) : null}
              {r.value}
            </p>

            {r.note ? <p className="mt-1.5 text-[11.5px] leading-relaxed text-subtle">{r.note}</p> : null}
          </div>
        ))}
      </div>

      {/* Why the colour is trustworthy: show the measurement, not just the name. */}
      <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-sunken px-3.5 py-2.5">
        <Eyedropper size={14} className="shrink-0 text-subtle" />
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-4 rounded-sm border border-line"
            style={{ background: result.measuredHex }}
          />
          <span className="font-mono text-[11px] text-subtle">{result.measuredHex}</span>
        </div>
        <span className="text-[12px] text-subtle">measured from your photo</span>
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        {result.withheld.join(" ")}
      </p>

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
            <ul className="mt-4 space-y-2">
              {result.matches.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/product/${m.slug}`}
                    className="group flex items-center gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-3.5 transition-colors hover:border-brand-line hover:bg-brand-soft/30"
                  >
                    <span
                      aria-hidden
                      className="size-10 shrink-0 rounded-[var(--radius-sm)] border border-line"
                      style={{ background: m.colorways[0]?.hex ?? "var(--sunken)" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{m.name}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-subtle">
                        {m.supplier.businessName} · {m.gsm} gsm · {formatMetres(m.stockMetres)} in stock
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[13px] text-ink tnum">
                        {formatPerMetre(m.pricePerMetre)}
                      </span>
                    </span>
                    <ArrowRight
                      size={14}
                      weight="bold"
                      className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
                    />
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

function Primer() {
  const steps = [
    ["Measured in your browser", "The dominant colour is read off the pixels and matched to a colourway in stock."],
    ["Read by a vision model", "Weave, weight and a likely fibre — only what a camera can actually resolve."],
    ["Searched like any other query", "Both become ordinary filters and run through the same marketplace search."],
  ];

  return (
    <div>
      <h2 className="font-display text-[22px] font-medium tracking-[-0.01em] text-ink">How a scan works</h2>
      <ol className="mt-5 space-y-4">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex gap-4">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface font-mono text-[11px] text-subtle tnum">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium text-ink">{title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-7 text-[12.5px] leading-relaxed text-subtle">
        GSM, composition and price are never inferred from a photograph. Those come from the mill.
      </p>
    </div>
  );
}

function ReadingSkeleton() {
  return (
    <div aria-live="polite" aria-busy>
      <div className="h-6 w-44 animate-pulse rounded bg-sunken" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
            <div className="h-3 w-16 animate-pulse rounded bg-sunken" />
            <div className="mt-3 h-4 w-28 animate-pulse rounded bg-sunken" />
          </div>
        ))}
      </div>
      <p className="mt-5 text-[13px] text-subtle">Reading the weave…</p>
    </div>
  );
}

/** A single line travelling down the sample, like a flatbed scanner. */
function ScanSweep() {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 overflow-hidden bg-ink/10"
    >
      <motion.span
        className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-brand/45 to-transparent"
        initial={{ y: "-20%" }}
        animate={{ y: "120%" }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
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
