"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { WEAVE_LABELS, type WeaveKey } from "@/lib/weave";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { Spinner } from "@/components/ui/spinner";

/**
 * three.js is ~150 KB gzipped, which is far too much to put in the bundle of
 * every page. It is loaded only here, only on the client, and only once the
 * stage is actually on screen — so the marketplace and product pages never pay
 * for it.
 */
const LoomScene = dynamic(() => import("./loom-scene"), {
  ssr: false,
  loading: () => null,
});

type Stage = { at: number; label: string; body: string };

const noopSubscribe = () => () => {};

/** Commentary beats, written from this fabric's own construction figures. */
function buildStages(opts: {
  weave: WeaveKey;
  gsm: number;
  productName: string;
  composition: string;
  endsPerCm: number;
  picksPerCm: number;
  interlacing: string;
}): Stage[] {
  return [
    {
      at: 0,
      label: "One thread",
      body: `Every metre of ${opts.productName} starts with a single plied thread in the final colour.`,
    },
    {
      at: 0.28,
      label: "Fibre",
      body: `Unravelled, the yarn becomes thousands of loose filaments. On their own, they have almost no strength.`,
    },
    {
      at: 0.55,
      label: "Twist",
      body: `Twisting the fibres gives the yarn its strength and structure. This yarn is built to handle the tension of the loom at ${opts.endsPerCm} ends per centimetre.`,
    },
    {
      at: 0.84,
      label: "Cloth",
      body: `${WEAVE_LABELS[opts.weave]}, ${opts.interlacing}, with ${opts.picksPerCm} picks per centimetre. ${opts.composition}, ${opts.gsm} gsm. These are the same specifications used to render the product swatch.`,
    },
  ];
}

export function LoomStage({
  weave,
  hex,
  gsm,
  seed,
  productName,
  composition,
  endsPerCm,
  picksPerCm,
  interlacing,
}: {
  weave: WeaveKey;
  hex: string;
  gsm: number;
  seed: string;
  productName: string;
  composition: string;
  endsPerCm: number;
  picksPerCm: number;
  interlacing: string;
}) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);

  const [ready, setReady] = useState(false);
  const [posterGone, setPosterGone] = useState(false);
  const [inView, setInView] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [stageIndex, setStageIndex] = useState(0);

  // "Are we on the client?" without a setState-in-effect cascade.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const STAGES = useMemo(
    () =>
      buildStages({ weave, gsm, productName, composition, endsPerCm, picksPerCm, interlacing }),
    [weave, gsm, productName, composition, endsPerCm, picksPerCm, interlacing],
  );

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });

  // The finale hands off from WebGL to the actual product swatch — the same
  // component the cards and the product page use, so the sequence lands on the
  // exact image a buyer sees everywhere else. Driven by MotionValues rather
  // than state so scrolling never triggers a React render.
  const swatchOpacity = useTransform(scrollYProgress, [0.78, 0.9], [0, 1]);
  const swatchScale = useTransform(scrollYProgress, [0.78, 1], [1.12, 1]);
  const canvasOpacity = useTransform(scrollYProgress, [0.76, 0.88], [1, 0]);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    progress.current = v;
    let next = 0;
    for (let i = 0; i < STAGES.length; i++) if (v >= STAGES[i]!.at) next = i;
    setStageIndex((prev) => (prev === next ? prev : next));
  });

  // Two signals, not one, because they answer different questions.
  //
  // `inView` decides when to *fetch and mount* the three.js chunk, and wants a
  // generous margin so the scene is ready before it is needed.
  //
  // `onScreen` decides whether to *render frames*, and wants no margin at all.
  // This wrapper is 560vh tall, so a 200px margin marks it visible while the
  // visitor is still a whole screen away. Driving the render loop off that
  // signal meant the GPU was drawing filaments nobody could see for an entire
  // viewport of scrolling.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const mount = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: "200px" },
    );
    const paint = new IntersectionObserver(
      ([entry]) => setOnScreen(Boolean(entry?.isIntersecting)),
      { rootMargin: "0px" },
    );

    mount.observe(el);
    paint.observe(el);
    return () => {
      mount.disconnect();
      paint.disconnect();
    };
  }, []);

  // Drop shadows and antialiasing on machines that will not enjoy them.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const cores = navigator.hardwareConcurrency ?? 4;
      const small = window.matchMedia("(max-width: 768px)").matches;
      if (cores <= 4 || small) setQuality("low");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!inView) return;
    // Give the dynamic chunk a beat to arrive before crossfading the poster out.
    const t = window.setTimeout(() => setReady(true), 450);
    return () => window.clearTimeout(t);
  }, [inView]);

  // Then take the poster out of the tree entirely, once its fade has finished.
  //
  // It was previously left mounted at opacity 0 forever, and it is not a cheap
  // thing to leave lying around: a viewport-sized `blur-2xl` over a FabricSwatch
  // that is itself painting an feTurbulence filter and two blend modes. A
  // transparent layer still gets composited, so every frame after this point
  // was paying for a 40px blur of a filtered SVG that nobody could see. That is
  // what made scrolling out of the stage and into the sections below it
  // stutter.
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setPosterGone(true), 1100);
    return () => window.clearTimeout(t);
  }, [ready]);

  const stage = STAGES[stageIndex]!;

  /* -------------------------------------------------- reduced motion --- */

  if (reduced) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-28 sm:px-6">
        <p className="eyebrow text-accent">WeaveScope</p>
        <h1 className="font-display mt-3.5 text-4xl leading-[1.05] font-medium text-balance text-ink sm:text-5xl">
          {productName}
        </h1>
        <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted">
          {composition} · {gsm} gsm · {WEAVE_LABELS[weave]}
        </p>
        <div className="mt-8 overflow-hidden rounded-[var(--radius-xl)] border border-line">
          <div className="aspect-video">
            <FabricSwatch weave={weave} hex={hex} gsm={gsm} seed={seed} alt={`${productName} swatch`} />
          </div>
        </div>
        <ol className="mt-8 space-y-4">
          {STAGES.map((s) => (
            <li key={s.label} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
              <p className="text-[14px] font-medium text-ink">{s.label}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  /* ---------------------------------------------------------- the rig --- */

  return (
    <div ref={wrapRef} className="relative h-[560vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-[#14120f]">
        {/* Poster: the real swatch, blurred and dimmed. Holds the frame while
            the 3D chunk loads so there is never an empty black box, then leaves
            the tree completely once the canvas has faded up. */}
        {!posterGone ? (
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-[var(--ease-out-expo)]",
              ready ? "opacity-0" : "opacity-100",
            )}
          >
            <div className="size-full scale-110 opacity-40 blur-2xl">
              <FabricSwatch weave={weave} hex={hex} gsm={gsm} seed={seed} alt="" drape={false} />
            </div>
            {mounted && inView ? (
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex items-center gap-2.5 rounded-full bg-black/40 px-4 py-2.5 backdrop-blur-md">
                  <Spinner className="size-4 text-white/70" />
                  <span className="text-[12.5px] text-white/70">Warping the loom…</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {mounted && inView ? (
          <motion.div
            style={{ opacity: canvasOpacity }}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-[var(--ease-out-expo)]",
              ready ? "opacity-100" : "opacity-0",
            )}
          >
            <LoomScene
              weave={weave}
              hex={hex}
              gsm={gsm}
              seed={seed}
              progress={progress}
              quality={quality}
              active={onScreen}
            />
          </motion.div>
        ) : null}

        {/* The finished cloth: the real catalogue swatch, not a 3D stand-in. */}
        <motion.div
          style={{ opacity: swatchOpacity, scale: swatchScale }}
          className="pointer-events-none absolute inset-0 will-change-transform"
        >
          <FabricSwatch weave={weave} hex={hex} gsm={gsm} seed={seed} alt={`${productName} swatch`} />
        </motion.div>

        {/* Vignette so the type never sits on a busy patch of thread. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(12,10,8,0.72)_100%)]"
        />

        {/* Opening title — fades as the first pick is thrown. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 px-6 pt-24 text-center transition-opacity duration-700 sm:pt-28",
            stageIndex === 0 ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="eyebrow text-white/55">WeaveScope</p>
          <h1 className="font-display mx-auto mt-4 max-w-3xl text-4xl leading-[1.05] font-medium text-balance text-white sm:text-6xl">
            {productName}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] text-pretty text-white/65">
            {composition} · {gsm} gsm · {WEAVE_LABELS[weave]}
          </p>
          <p className="mt-9 inline-flex items-center gap-2 text-[13px] text-white/55">
            <ArrowDown size={14} weight="bold" className="animate-bounce" />
            Scroll to weave it
          </p>
        </div>

        {/* Running commentary, keyed so each stage animates in cleanly. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <div
            key={stage.label}
            className="animate-fade-up mx-auto max-w-3xl rounded-[var(--radius-lg)] bg-[#14120f]/65 p-4 backdrop-blur-md sm:p-5"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] text-white/45 tabular-nums">
                {String(stageIndex + 1).padStart(2, "0")}
              </span>
              <p className="text-[14px] font-medium text-white sm:text-[15px]">{stage.label}</p>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/70 sm:text-[13.5px]">{stage.body}</p>
          </div>

          <div className="mx-auto mt-2 flex max-w-3xl gap-1">
            {STAGES.map((s, i) => (
              <span
                key={s.label}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors duration-500",
                  i <= stageIndex ? "bg-white/75" : "bg-white/20",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
