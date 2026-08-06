"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CaretDown, CaretUp } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { WEAVE_LABELS, type WeaveKey } from "@/lib/weave";

export type WheelSwatch = {
  id: string;
  slug: string;
  name: string;
  weave: WeaveKey;
  gsm: number;
  composition: string;
  hex: string;
};

/** Degrees between neighbouring cards on the ring. */
const STEP = 42;
/** Ring radius, as a percentage of the container's width. */
const RADIUS = 33;
/** Where the selected card sits, in degrees. 180 is the left of the circle. */
const ACTIVE_ANGLE = 180;
/**
 * The circle's centre, in percent of the container.
 *
 * Pushed right of centre on purpose. With the circle centred, the selected
 * card, which sits at the circle's left, landed near the container's left edge
 * and collided with both the turn control and the copy in the next column.
 * Moving the centre right gives the selected card the middle of the panel and
 * leaves the ring room to breathe around it.
 */
const CX = 62;
const CY = 50;

/**
 * Rounds a computed coordinate before it reaches the DOM.
 *
 * Everything on this dial is positioned with sin and cos, and Node and the
 * browser do not always agree on the last digit of a float. Server-rendered
 * markup carries the value as a string while the client holds a number, so
 * `137.90038609934712` against `137.9003860993471` is enough for React to
 * report a hydration mismatch and refuse to patch the tree. Three decimals is
 * far finer than a pixel at any viewport and makes both sides produce the same
 * text.
 */
const round = (v: number) => Number(v.toFixed(3));

/**
 * A dial of fabrics.
 *
 * Replaces a stack of five cards fanned on top of one another. That stack had
 * two problems: only the top card was really legible, and the only way in was a
 * custom cursor that appeared on hover, so touch and keyboard users never
 * learned it existed.
 *
 * A dial fixes both. Every fabric is visible at once and none is buried, the
 * selected one is lifted out and shown at full size, and turning it is an
 * ordinary interaction: scroll over it, press the arrows, or use the up and
 * down keys. The card that is selected is the one you open, and the button that
 * opens it says where it goes.
 *
 * Geometry note: positions are set with `left`/`top` percentages derived from
 * sin and cos rather than a CSS `rotate(...) translateY(-R)` chain, because a
 * percentage inside `translateY` resolves against the element's own height, not
 * the container's. Percentages on `left`/`top` do resolve against the
 * container, so the ring scales with it and needs no resize observer.
 */
export function FabricWheel({ swatches }: { swatches: WheelSwatch[] }) {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const n = swatches.length;

  const turn = useCallback(
    (delta: number) => setActive((a) => (a + delta + n) % n),
    [n],
  );

  /**
   * Wheel handling is bound natively rather than through React's `onWheel`.
   *
   * React attaches wheel listeners as passive, which means `preventDefault`
   * inside them is ignored and the page scrolls away underneath the dial while
   * it is being turned. A non-passive native listener is the only way to hold
   * the page still, and it is only held when the gesture is actually consumed.
   */
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    let cooling = false;
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) < 2) return;
      e.preventDefault();
      if (cooling) return;
      cooling = true;
      turn(e.deltaY > 0 ? 1 : -1);
      // One card per gesture. A trackpad emits a burst of small deltas and
      // without this the dial spins through the whole set on one flick.
      window.setTimeout(() => {
        cooling = false;
      }, 260);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [turn]);

  const current = swatches[active];
  if (!current) return null;

  /** Signed distance from the active card, wrapped so it takes the short way. */
  function offsetFrom(i: number) {
    let o = i - active;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  }

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label="Choose a fabric to inspect"
      className="relative aspect-square w-full touch-pan-y select-none"
    >
      {/* The dial face: a hairline ring with a tick per fabric, so the wheel
          reads as an instrument with positions rather than as cards floating in
          a circle. */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute inset-0 size-full"
      >
        <circle cx={CX * 2} cy={CY * 2} r={RADIUS + 22} fill="none" stroke="var(--line)" strokeWidth="0.4" />
        <circle cx={CX * 2} cy={CY * 2} r={RADIUS + 18} fill="none" stroke="var(--line)" strokeWidth="0.25" />
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const r1 = RADIUS + 18;
          const r2 = r1 - (i % 5 === 0 ? 3.5 : 1.8);
          return (
            <line
              key={i}
              x1={round(CX * 2 + r1 * Math.cos(a))}
              y1={round(CY * 2 + r1 * Math.sin(a))}
              x2={round(CX * 2 + r2 * Math.cos(a))}
              y2={round(CY * 2 + r2 * Math.sin(a))}
              stroke="var(--line-strong)"
              strokeWidth="0.35"
              opacity={i % 5 === 0 ? 0.9 : 0.45}
            />
          );
        })}
      </svg>

      {/* The ring. Everything except the selected fabric, which is lifted out
          and shown large below. */}
      {swatches.map((s, i) => {
        const offset = offsetFrom(i);
        if (offset === 0) return null;

        const angle = ACTIVE_ANGLE + offset * STEP;
        const rad = (angle * Math.PI) / 180;
        const depth = Math.abs(offset);

        return (
          <motion.button
            key={s.id}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Select ${s.name}`}
            initial={false}
            animate={{
              left: `${round(CX + RADIUS * Math.cos(rad))}%`,
              top: `${round(CY + RADIUS * Math.sin(rad))}%`,
              // A slight tilt away from the centre, not a full tangent. The
              // reference could rotate its cards to follow the arc because its
              // radius dwarfed them; at this scale a true tangent put two
              // labels past vertical and one completely upside down.
              rotate: offset * 5,
              // Cards further round the dial sit back, so the eye has an
              // obvious front. Without it the ring reads as flat.
              opacity: depth >= 2 ? 0.55 : 0.85,
              scale: depth >= 2 ? 0.82 : 0.92,
            }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 180, damping: 26, mass: 0.9 }
            }
            style={{ x: "-50%", y: "-50%" }}
            className={cn(
              "absolute z-10 w-[26%] cursor-pointer overflow-hidden rounded-[var(--radius-md)]",
              "border border-line bg-surface p-1.5 text-left shadow-[var(--shadow-sm)]",
              "transition-[border-color,box-shadow] duration-300",
              "hover:border-line-strong hover:shadow-[var(--shadow-md)]",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          >
            <span className="block overflow-hidden rounded-[calc(var(--radius-md)-6px)]">
              <FabricSwatch
                weave={s.weave}
                hex={s.hex}
                gsm={s.gsm}
                seed={s.slug}
                alt=""
                drape={false}
                className="aspect-[4/3] size-full"
              />
            </span>
            <span className="block px-1 pt-2 pb-1">
              <span className="block truncate text-[10.5px] font-medium text-ink">{s.name}</span>
              <span className="mt-0.5 block truncate font-mono text-[9px] text-subtle">
                {s.gsm} gsm
              </span>
            </span>
          </motion.button>
        );
      })}

      {/* The selected fabric, lifted off the ring. */}
      <div
        className="absolute z-20 w-[40%]"
        style={{
          left: `${round(CX + RADIUS * Math.cos((ACTIVE_ANGLE * Math.PI) / 180))}%`,
          top: `${CY}%`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: reduced ? 0.12 : 0.28, ease: [0.33, 1, 0.68, 1] }}
            className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-2 shadow-[var(--shadow-lg)]"
          >
            <div className="overflow-hidden rounded-[calc(var(--radius-lg)-8px)]">
              <FabricSwatch
                weave={current.weave}
                hex={current.hex}
                gsm={current.gsm}
                seed={current.slug}
                alt={`${current.name} rendered from its weave, weight and colourway`}
                className="aspect-square size-full"
              />
            </div>

            <div className="px-2 pt-3.5 pb-2">
              <p className="truncate text-[14px] font-medium text-ink">{current.name}</p>
              <p className="mt-1 truncate font-mono text-[10.5px] text-subtle">
                {current.gsm} gsm · {current.composition}
              </p>
              <p className="mt-0.5 truncate font-mono text-[10.5px] text-subtle">
                {WEAVE_LABELS[current.weave]}
              </p>

              {/* The way in. It says where it goes, it is a real link on every
                  device, and it is reachable by keyboard. The stack this
                  replaced offered a hover-only cursor and nothing else. */}
              <Link
                href={`/weavescope/${current.slug}`}
                className="group mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-ink transition-colors hover:text-brand"
              >
                View WeaveScope
                <ArrowRight
                  size={12}
                  weight="bold"
                  className="transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Turn control, on the right rim.
          It was on the left, which is where the selected card lives, so it sat
          directly on top of the thing it was meant to change. The right side of
          the dial is empty: the ring fans across the left half, so the far
          right is the one place a control can live without covering a card. */}
      <div className="absolute top-1/2 right-[2%] z-30 -translate-y-1/2">
        <div className="flex flex-col overflow-hidden rounded-full border border-brand-line bg-brand text-white shadow-[var(--shadow-md)]">
          <WheelButton label="Previous fabric" onClick={() => turn(-1)}>
            <CaretUp size={13} weight="bold" />
          </WheelButton>
          <span aria-hidden className="mx-2 h-px bg-white/25" />
          <WheelButton label="Next fabric" onClick={() => turn(1)}>
            <CaretDown size={13} weight="bold" />
          </WheelButton>
        </div>
      </div>

      {/* Position readout. Turning a dial with no indication of how far round
          you are is disorienting. */}
      <p
        className="absolute bottom-[3%] z-30 -translate-x-1/2 font-mono text-[10.5px] tracking-[0.18em] text-subtle tabular-nums"
        style={{ left: `${CX}%` }}
      >
        {String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
      </p>
    </div>
  );
}

function WheelButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-8 cursor-pointer place-items-center transition-colors duration-200 hover:bg-brand-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
