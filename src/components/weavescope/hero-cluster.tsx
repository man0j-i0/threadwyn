"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

import { cn } from "@/lib/utils";
import type { WeaveKey } from "@/lib/weave";
import { FabricSwatch } from "@/components/product/fabric-swatch";

export type HeroSwatch = {
  id: string;
  slug: string;
  name: string;
  weave: WeaveKey;
  gsm: number;
  composition: string;
  hex: string;
};

const LAYOUT = [
  "left-0 top-6 w-56 rotate-[-6deg]",
  "left-40 top-0 w-64 rotate-[3deg] z-20",
  "right-0 top-40 w-52 rotate-[7deg] z-10",
  "left-4 top-64 w-60 rotate-[2deg] z-30",
  "right-6 bottom-0 w-48 rotate-[-4deg] z-20",
];

/**
 * The hero cascade, and the one place WeaveScope is offered.
 *
 * The affordance is deliberately *collective*: five badges competing for
 * attention would be noise, so the whole cluster shares a single cursor that
 * grows into a labelled disc while the pointer is anywhere over it. Which card
 * you click still decides which fabric you descend into — the invitation is
 * shared, the destination is not.
 *
 * The native cursor is hidden only inside the cluster, and only on devices that
 * actually have one. Touch gets the plain cards and a visible caption instead,
 * because a custom cursor on a touchscreen is a control nobody can find.
 */
export function HeroCluster({ swatches }: { swatches: HeroSwatch[] }) {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState("Look inside");

  // Raw pointer position, then a spring — the lag is what makes a custom
  // cursor feel like an object rather than a sprite glued to the mouse.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 520, damping: 38, mass: 0.6 });
  const springY = useSpring(y, { stiffness: 520, damping: 38, mass: 0.6 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  }

  return (
    <div
      ref={wrapRef}
      onPointerMove={onPointerMove}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setActive(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setActive(false);
      }}
      className={cn(
        "relative mx-auto h-[34rem] w-full max-w-lg",
        // Hidden only here, and only where a pointer exists.
        active && "[@media(pointer:fine)]:cursor-none",
      )}
    >
      {swatches.map((s, i) => (
        <Link
          key={s.id}
          href={`/weavescope/${s.slug}`}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setLabel(s.name);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setLabel("Look inside");
          }}
          onFocus={() => setLabel(s.name)}
          style={{ animationDelay: `${0.35 + i * 0.11}s` }}
          aria-label={`Look inside ${s.name} — watch it being woven`}
          className={cn(
            "group/hero animate-fade-up absolute block rounded-[var(--radius-lg)] border border-line bg-surface p-1.5",
            "shadow-[var(--shadow-lg)]",
            "transition-[transform,box-shadow,border-color] duration-700 ease-[var(--ease-out-expo)]",
            "hover:-translate-y-2 hover:rotate-0 hover:border-brand hover:shadow-[var(--shadow-xl)]",
            "focus-visible:-translate-y-2 focus-visible:rotate-0 focus-visible:border-brand",
            active && "[@media(pointer:fine)]:cursor-none",
            LAYOUT[i],
          )}
        >
          <div className="aspect-square overflow-hidden rounded-[calc(var(--radius-lg)-8px)]">
            <FabricSwatch
              weave={s.weave}
              hex={s.hex}
              gsm={s.gsm}
              seed={s.id}
              alt={`${s.name} swatch`}
              priority
            />
          </div>
          <div className="px-2 pt-2.5 pb-1.5">
            <p className="truncate text-[12px] font-medium text-ink">{s.name}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-subtle">
              {s.gsm} gsm · {s.composition}
            </p>
          </div>
        </Link>
      ))}

      {/* One cursor for the whole cluster. */}
      {reduced ? null : (
        <motion.div
          aria-hidden
          style={{ x: springX, y: springY }}
          animate={{ scale: active ? 1 : 0.2, opacity: active ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="pointer-events-none absolute top-0 left-0 z-40 hidden [@media(pointer:fine)]:block"
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            <div className="flex size-26 flex-col items-center justify-center gap-1.5 rounded-full bg-brand/92 text-white shadow-[var(--shadow-xl)] backdrop-blur-sm">
              <Reticle className="size-5" />
              <span className="text-[10.5px] leading-none font-medium">Look inside</span>
              {/* Naming the fabric under the pointer keeps the shared cursor
                  from being ambiguous about where a click will land. */}
              <span className="max-w-[5.5rem] truncate px-2 text-center text-[9px] leading-tight text-white/65">
                {label === "Look inside" ? " " : label}
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Touch devices get a plain caption instead of an invisible affordance. */}
      <p className="absolute -bottom-8 left-0 text-[12px] text-subtle [@media(pointer:fine)]:hidden">
        Tap any swatch to see it woven.
      </p>
    </div>
  );
}

/** A loupe reticle — the mark on a pick glass, not a generic info glyph. */
function Reticle({ className }: { className?: string }) {
  return (
    <span className={cn("relative grid place-items-center", className)}>
      <span className="absolute inset-0 rounded-full border border-current opacity-40 motion-safe:animate-ping motion-safe:[animation-duration:2.2s]" />
      <svg viewBox="0 0 16 16" fill="none" className="relative size-full">
        <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.1" />
        <circle cx="8" cy="8" r="2.25" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.7" />
        <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
          <line x1="8" y1="0.75" x2="8" y2="2.6" />
          <line x1="8" y1="13.4" x2="8" y2="15.25" />
          <line x1="0.75" y1="8" x2="2.6" y2="8" />
          <line x1="13.4" y1="8" x2="15.25" y2="8" />
        </g>
      </svg>
    </span>
  );
}
