"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CaretLeft, CaretRight, Check, Plus } from "@phosphor-icons/react";

import type { WeaveKey } from "@/lib/weave";
import { cn, formatMetres, formatPerMetre } from "@/lib/utils";
import { useAddToCart } from "@/lib/use-add-to-cart";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FabricSwatch } from "@/components/product/fabric-swatch";

export type ScanMatch = {
  id: string;
  slug: string;
  name: string;
  weave: WeaveKey;
  gsm: number;
  widthCm: number;
  composition: string;
  pricePerMetre: number;
  stockMetres: number;
  moqMetres: number;
  leadTimeDays: number;
  supplier: { businessName: string; city: string };
  colorways: { id: string; name: string; hex: string; stockMetres: number }[];
};

export type ScanReadingView = {
  key: string;
  label: string;
  value: string;
  certainty: "confident" | "likely" | "uncertain";
  source: "pixels" | "model";
};

export type ScanResultView = {
  readings: ScanReadingView[];
  chips: { key: string; label: string; value: string }[];
  withheld: string[];
  href: string;
  mode: "vision" | "colour-only";
  model: string;
  measuredHex: string;
  matchedHex: string | null;
  relaxed: string[];
  exact: number;
  quality: "exact" | "near" | "none";
  matches: ScanMatch[];
  total: number;
};

const certaintyTone: Record<ScanReadingView["certainty"], string> = {
  confident: "text-positive",
  likely: "text-brand-ink",
  uncertain: "text-warn",
};

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

/**
 * The result, as two panels that share the screen.
 *
 * The deck is the room; a fabric opens as a panel *beside* it rather than
 * replacing it, so the buyer never loses their place in the comparison. Both
 * panels are laid out by one flex row under Framer's `layout`, which is what
 * makes the deck shrink and the detail grow as a single continuous motion
 * instead of two independent animations that have to be kept in sync.
 */
export function ScanResultModal({
  result,
  open,
  onClose,
}: {
  result: ScanResultView | null;
  open: boolean;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ScanMatch | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Reset when a new scan arrives or the modal reopens. Adjusted during render
  // rather than in an effect, which would paint the stale selection for a frame.
  const [session, setSession] = useState<{ open: boolean; result: ScanResultView | null }>({ open, result });
  if (session.open !== open || session.result !== result) {
    setSession({ open, result });
    if (selected) setSelected(null);
  }

  /**
   * The last fabric shown, kept one beat longer than the selection.
   *
   * The panel collapses by animating its width, so it is still on screen after
   * `selected` clears. Rendering `selected` directly emptied it instantly and
   * the buyer watched a blank rectangle shrink; this keeps the contents in
   * place until the panel has finished closing.
   */
  const [shown, setShown] = useState<ScanMatch | null>(selected);
  if (selected && selected !== shown) setShown(selected);
  useEffect(() => {
    if (selected) return;
    const id = window.setTimeout(() => setShown(null), 500);
    return () => window.clearTimeout(id);
  }, [selected]);

  // Escape leaves the detail first, then the modal.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setSelected((current) => {
        if (current) return null;
        closeRef.current();
        return null;
      });
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  /**
   * Lock the page, and disable the browser's horizontal swipe navigation.
   *
   * A flick left on a trackpad is "go back" — on a modal full of horizontally
   * draggable cards that is a trap, and losing the whole scan to a stray
   * gesture is unrecoverable. `overscroll-behavior-x: none` on the root is the
   * supported way to switch it off; the wheel handler on the deck cancels the
   * gesture that reaches the cards. Both are needed: the property alone does
   * not stop a swipe that begins outside the deck, and `preventDefault` alone
   * does not cover the chrome around it.
   */
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const previous = {
      bodyOverflow: document.body.style.overflow,
      rootOverscroll: root.style.overscrollBehaviorX,
      bodyOverscroll: document.body.style.overscrollBehaviorX,
    };

    document.body.style.overflow = "hidden";
    root.style.overscrollBehaviorX = "none";
    document.body.style.overscrollBehaviorX = "none";
    // Blurs the page itself. See the overlay rule in globals.css for why this
    // is not `backdrop-filter` on the scrim.
    document.body.dataset.overlayOpen = "true";

    return () => {
      document.body.style.overflow = previous.bodyOverflow;
      root.style.overscrollBehaviorX = previous.rootOverscroll;
      document.body.style.overscrollBehaviorX = previous.bodyOverscroll;
      delete document.body.dataset.overlayOpen;
    };
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Portalled to `<body>`.
  //
  // Not for z-index — for `backdrop-filter`. The blur samples whatever its
  // *backdrop root* contains, and any ancestor with a transform, a filter, an
  // opacity below 1 or a `will-change` for those becomes that root. Rendered in
  // place, the modal sat under the page shell and a whole chain of Framer
  // components, and the blur died the moment one of them settled with a
  // leftover `will-change` — which is exactly the second or two it survived.
  // At the top of `<body>` there is no such chain left to break it.
  // No mounted-state dance: with `open` false there is nothing to render on
  // either side, so server and client agree and hydration has nothing to
  // mismatch on. All hooks have already run above this point.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && result ? (
        <div className="fixed inset-0 z-80" data-overlay-layer>
          {/* No `backdrop-filter` here. The page itself is blurred, driven by
              `data-overlay-open` on `<body>` — see the overlay rule in
              globals.css for the three ways the backdrop approach failed. */}
          <motion.button
            type="button"
            aria-label="Close scan result"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 cursor-default bg-[#191713]/60"
          />

          <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            {/* Both panels are mounted for the life of the modal; opening a
                fabric only grows one and shrinks the other.

                Nothing here mounts or unmounts on selection, which is the point.
                An `AnimatePresence` swap left `will-change` behind on the way
                out, and that is enough to make an ancestor a backdrop root and
                silently kill the scrim's blur a beat after the panel settled.
                Width is a pure CSS transition on `flex-basis` for the same
                reason: no layout projection, nothing promoted, nothing to
                clean up. */}
            {/* The deck's width never changes. Its cards are absolutely
                positioned against the stage, so a stage that resizes mid-
                animation re-lays them out on every frame — which is the lurch
                you saw when the detail closed. Only the detail's width
                animates; the row is centred, so the deck simply slides aside. */}
            <div className="flex h-[min(88dvh,820px)] items-stretch gap-4">
              {/* ── the deck ─────────────────────────────────────────────── */}
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Fabric scan result"
                tabIndex={-1}
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.99, transition: { duration: 0.18 } }}
                transition={SPRING}
                className={cn(
                  "flex w-[min(94vw,660px)] shrink-0 flex-col overflow-hidden rounded-[var(--radius-xl)]",
                  "border border-line bg-surface shadow-[var(--shadow-xl)] outline-none",
                  // Below `lg` there is no room for two; the detail takes over.
                  selected && "hidden lg:flex",
                )}
              >
                {/* Only one close control at a time. With the detail open, its
                    cross is the one that means something — two identical
                    buttons side by side is a coin toss about what closes. */}
                <Summary result={result} onClose={onClose} showClose={!selected} />
                <Deck
                  matches={result.matches}
                  quality={result.quality}
                  total={result.total}
                  href={result.href}
                  compact={Boolean(selected)}
                  selectedId={selected?.id ?? null}
                  onOpen={setSelected}
                />
              </motion.div>

              {/* ── one fabric, beside it ────────────────────────────────── */}
              <div
                aria-hidden={!selected}
                className={cn(
                  "overflow-hidden rounded-[var(--radius-xl)] bg-surface",
                  "transition-[width,opacity] duration-500 ease-[var(--ease-out-expo)]",
                  selected
                    ? "w-[min(94vw,560px)] border border-line opacity-100 shadow-[var(--shadow-xl)]"
                    : "pointer-events-none w-0 border-0 opacity-0",
                )}
              >
                {/* Fixed width on the inner wrapper, so the contents do not
                    reflow line by line while the panel is opening — the
                    container clips instead. */}
                <div className="flex h-full w-[min(94vw,560px)] flex-col">
                  {/* `shown` rather than `selected`, so the panel keeps its
                      contents while it collapses instead of emptying first. */}
                  {shown ? <Detail key={shown.id} match={shown} onClose={() => setSelected(null)} /> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ── what we read ────────────────────────────────────────────────────────── */

function Summary({
  result,
  onClose,
  showClose,
}: {
  result: ScanResultView;
  onClose: () => void;
  showClose: boolean;
}) {
  const colour = result.readings.find((r) => r.key === "colour");
  const rest = result.readings.filter((r) => r.key !== "colour").slice(0, 3);
  const weave = rest.find((r) => r.key === "weave");

  return (
    <div className="shrink-0 border-b border-line px-6 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden
            className="mt-1 size-14 shrink-0 rounded-[var(--radius-lg)] border border-line shadow-[var(--shadow-xs)]"
            style={{ background: result.matchedHex ?? result.measuredHex }}
          />
          {/* Colour and weave stacked, not joined by a middot. They are two
              separate findings, and a single run-on line made the whole header
              read as one sentence competing with the deck below it. */}
          <div className="min-w-0">
            <p className="eyebrow text-accent">Scan result</p>
            <p className="font-display mt-2 truncate text-[26px] leading-[1.15] tracking-[-0.02em] text-ink sm:text-[30px]">
              {colour?.value ?? "Colour only"}
            </p>
            {weave ? (
              <p className="font-display truncate text-[26px] leading-[1.15] tracking-[-0.02em] text-muted sm:text-[30px]">
                {weave.value}
              </p>
            ) : null}
          </div>
        </div>

        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Plus size={16} weight="bold" className="rotate-45" />
          </button>
        ) : null}
      </div>

      {/* A table, so the eye can run down a column. Certainty is a footnote
          under each value rather than a word inline with it. */}
      <dl className="mt-6 grid grid-cols-3 gap-x-6 border-t border-line pt-4">
        {rest.map((r) => (
          <div key={r.key} className="min-w-0">
            <dt className="text-[11.5px] text-subtle">{r.label}</dt>
            <dd className="mt-1 truncate text-[14.5px] font-medium text-ink" title={r.value}>
              {r.value}
            </dd>
            <dd className={cn("mt-1 font-mono text-[10px] tracking-[0.06em] uppercase", certaintyTone[r.certainty])}>
              {r.certainty}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 font-mono text-[10.5px] tracking-[0.04em] text-subtle">{sourceLabel(result)}</p>
    </div>
  );
}

/**
 * How the reading was produced, in the buyer's terms rather than a model id.
 *
 * A raw `google/gemma-3-27b-it` in the corner is developer output on a customer
 * surface. What matters to a buyer is that this is an estimate from a picture,
 * not a measurement. The mocked case still says so plainly — a demo that reads
 * identically whether or not a model answered would be the dishonest option.
 */
function sourceLabel(result: ScanResultView): string {
  if (result.mode !== "vision") return "Measured colour only · no model";
  if (result.model === "mock reading") return "Sample reading · not live";
  return "AI reading · visual estimate";
}

/* ── the deck ────────────────────────────────────────────────────────────── */

const HEADLINE: Record<ScanResultView["quality"], { title: string; note: string }> = {
  exact: { title: "Matched your swatch", note: "Closest fabrics based on the scan." },
  near: { title: "Closest in stock", note: "Nothing matched every reading. These are the nearest." },
  // The ladder always returns rows, so without this the catalogue's most
  // popular fabrics would be presented as matches for a swatch they have
  // nothing to do with.
  none: { title: "No close match", note: "Nothing here is near your swatch. These are simply popular fabrics." },
};

/** How far each neighbour sits from the centre, and how much it shrinks. */
const STEP_X = 0.62; // of a card width
const STEP_SCALE = 0.15;
const VISIBLE = 2; // neighbours drawn per side

function Deck({
  matches,
  quality,
  total,
  href,
  compact,
  selectedId,
  onOpen,
}: {
  matches: ScanMatch[];
  quality: ScanResultView["quality"];
  total: number;
  href: string;
  compact: boolean;
  selectedId: string | null;
  onOpen: (m: ScanMatch) => void;
}) {
  const count = matches.length;
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  // Dragging is state, not a ref, because the card transition depends on it:
  // follow the pointer with no easing, spring back once released.
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<{ id: number; startX: number; moved: boolean } | null>(null);
  /** Survives past `pointerup` so the click it generates can be ignored. */
  const justDragged = useRef(false);
  const wheelLock = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const detailOpen = selectedId !== null;

  /**
   * Move the deck, and keep the detail panel on whatever is now in front.
   *
   * With a fabric open beside the deck, paging the deck and leaving the panel
   * showing the previous one is just two views disagreeing. The front card is
   * the selection.
   */
  const step = useCallback(
    (direction: 1 | -1) => {
      if (count < 2) return;
      setIndex((i) => {
        const next = (i + direction + count) % count;
        if (detailOpen) {
          const match = matches[next];
          if (match) onOpen(match);
        }
        return next;
      });
    },
    [count, detailOpen, matches, onOpen],
  );

  /**
   * Horizontal trackpad gestures — and, critically, `preventDefault` on them.
   *
   * A fast two-finger swipe left is also the browser's "go back" gesture. On a
   * modal that is catastrophic: the buyer flicks through the deck and lands on
   * the previous page with the scan gone. Only a **non-passive** listener can
   * cancel it, and React's `onWheel` is registered passive, so this is attached
   * by hand rather than as a JSX prop.
   *
   * Throttled to one card per gesture, or a single flick would fly through the
   * whole deck.
   */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 6) return;
      e.preventDefault();

      const now = Date.now();
      if (now - wheelLock.current < 300) return;
      wheelLock.current = now;
      step(e.deltaX > 0 ? 1 : -1);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step]);

  const headline = HEADLINE[quality];
  const cardW = compact ? 210 : 250;
  const cardH = compact ? 286 : 330;

  /** Shortest signed distance from the centre, wrapping both ways. */
  function offsetOf(i: number) {
    let d = i - index;
    if (d > count / 2) d -= count;
    if (d < -count / 2) d += count;
    return d;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-6 py-6 sm:px-8 sm:py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-medium text-ink">{headline.title}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-subtle">{headline.note}</p>
        </div>
      </div>

      {/* The stage takes the slack, so the deck sits centred in whatever height
          is left rather than pinning itself under the heading. Arrows sit
          outside it so they never cover a card. */}
      <div className="relative my-auto flex items-center justify-center gap-3 py-6 sm:gap-5">
        <DeckButton direction="left" disabled={count < 2} onClick={() => step(-1)} />

        <div
          ref={stageRef}
          // `touch-pan-y` hands vertical scrolling back to the page while
          // reserving horizontal for the deck, which is also what stops a touch
          // swipe from being read as a back gesture.
          className="relative flex-1 touch-pan-y overscroll-x-none select-none"
          style={{ height: cardH }}
          onPointerDown={(e) => {
            if (e.pointerType === "touch") return;
            pointer.current = { id: e.pointerId, startX: e.clientX, moved: false };
          }}
          onPointerMove={(e) => {
            const p = pointer.current;
            if (!p || p.id !== e.pointerId) return;
            const dx = e.clientX - p.startX;
            if (!p.moved && Math.abs(dx) > 4) {
              p.moved = true;
              setDragging(true);
            }
            if (p.moved) setDrag(dx);
          }}
          onPointerUp={() => {
            const p = pointer.current;
            pointer.current = null;
            if (p?.moved) {
              if (Math.abs(drag) > cardW * 0.22) step(drag < 0 ? 1 : -1);
              // The browser fires a click after the drag; ignore that one so
              // releasing over a card does not also open it.
              justDragged.current = true;
              window.setTimeout(() => {
                justDragged.current = false;
              }, 0);
            }
            setDragging(false);
            setDrag(0);
          }}
          onPointerCancel={() => {
            pointer.current = null;
            setDragging(false);
            setDrag(0);
          }}
        >
          {matches.map((m, i) => {
            const d = offsetOf(i);
            const hidden = Math.abs(d) > VISIBLE;
            const dragShift = drag / cardW;
            const position = d + dragShift;

            return (
              <motion.button
                key={m.id}
                type="button"
                aria-hidden={hidden}
                tabIndex={hidden ? -1 : 0}
                onClick={() => {
                  if (justDragged.current) return;
                  setIndex(i);
                  // With the panel already open, every card is a request to
                  // show *that* fabric. Closed, a neighbour only comes forward
                  // and the front card is the one that opens.
                  if (detailOpen || d === 0) onOpen(m);
                }}
                animate={{
                  x: `calc(-50% + ${position * STEP_X * cardW}px)`,
                  scale: Math.max(0.55, 1 - Math.abs(position) * STEP_SCALE),
                  opacity: hidden ? 0 : 1 - Math.abs(position) * 0.22,
                }}
                // Follow the pointer exactly while dragging; spring home after.
                // Easing a live drag is what makes a carousel feel laggy.
                transition={dragging ? { duration: 0 } : SPRING}
                style={{
                  width: cardW,
                  height: cardH,
                  left: "50%",
                  zIndex: 20 - Math.round(Math.abs(position) * 10),
                  pointerEvents: hidden ? "none" : "auto",
                }}
                className={cn(
                  "absolute top-0 flex flex-col overflow-hidden rounded-[var(--radius-xl)] border bg-surface text-left",
                  "shadow-[var(--shadow-lg)]",
                  d === 0 ? "cursor-pointer border-brand-line" : "cursor-pointer border-line",
                  selectedId === m.id && "ring-2 ring-brand",
                )}
              >
                <span className="relative block h-[58%] overflow-hidden bg-sunken">
                  <FabricSwatch
                    weave={m.weave}
                    hex={m.colorways[0]?.hex ?? "#C9C2B4"}
                    gsm={m.gsm}
                    seed={m.slug}
                    alt={`${m.name} in ${m.colorways[0]?.name ?? "its first colourway"}`}
                    // Finer than native. At thumbnail size a plain weave drawn
                    // at full tile reads as a transparency checkerboard rather
                    // than as cloth.
                    magnify={0.5}
                  />
                  {i === 0 && quality === "exact" ? (
                    <span className="absolute top-3 left-3 rounded-full bg-brand px-2.5 py-1 font-mono text-[9.5px] tracking-[0.04em] text-white uppercase">
                      Closest
                    </span>
                  ) : null}
                </span>

                <span className="flex flex-1 flex-col p-4">
                  <span className="font-display line-clamp-2 block text-[15px] leading-snug tracking-[-0.01em] text-ink">
                    {m.name}
                  </span>
                  <span className="mt-1 block truncate text-[11.5px] text-subtle">{m.supplier.businessName}</span>
                  <span className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-3">
                    <span className="font-mono text-[10.5px] text-subtle tnum">{m.gsm} gsm</span>
                    <span className="font-mono text-[14px] text-ink tnum">{formatPerMetre(m.pricePerMetre)}</span>
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <DeckButton direction="right" disabled={count < 2} onClick={() => step(1)} />
      </div>

      {/* Quiet. The count is orientation, not a call to action, and a filled
          button down here was competing with the cards for the same attention. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-subtle tnum">
          {count ? `${index + 1} of ${count}` : "0"} · {total} fabrics found
        </p>
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-[13px] text-brand-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-brand"
        >
          View all
          <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function DeckButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "left" ? CaretLeft : CaretRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Previous fabric" : "Next fabric"}
      className={cn(
        "z-30 grid size-10 shrink-0 place-items-center rounded-full border transition-all duration-300 ease-[var(--ease-out-expo)]",
        "border-line bg-surface text-muted shadow-[var(--shadow-sm)]",
        "enabled:hover:border-brand enabled:hover:bg-brand enabled:hover:text-white enabled:active:scale-90",
        "disabled:cursor-not-allowed disabled:opacity-30",
      )}
    >
      <Icon size={15} weight="bold" />
    </button>
  );
}

/* ── one fabric, in full ─────────────────────────────────────────────────── */

function Detail({ match, onClose }: { match: ScanMatch; onClose: () => void }) {
  const { add, busy, done, locked } = useAddToCart();
  // Safe to initialise from props: the parent keys this by fabric, so a
  // different match is a different instance.
  const [colourway, setColourway] = useState(match.colorways[0] ?? null);

  /**
   * Stock for the colour actually selected, not the product total.
   *
   * `cart-service` computes availability as `colorway?.stockMetres ??
   * product.stockMetres`, so the cart judges a line against the colourway. This
   * panel was quoting the product total beside a colourway picker: a fabric
   * with 11,000 m across six colours would promise all of it while the chosen
   * colour held two hundred, and the line was only refused once it was already
   * in the cart. Quote the number that will be checked.
   */
  const available = colourway?.stockMetres ?? match.stockMetres;
  const orderable = available >= match.moqMetres;

  const specs: [string, string][] = [
    ["Weight", `${match.gsm} gsm`],
    ["Width", `${match.widthCm} cm`],
    ["Minimum order", formatMetres(match.moqMetres)],
    [colourway ? `In stock · ${colourway.name}` : "In stock", formatMetres(available)],
    ["Lead time", `${match.leadTimeDays} days`],
    ["Composition", match.composition],
  ];

  return (
    // Header and buy bar are pinned; only the specification scrolls. As one
    // scrolling column the bar could be pushed off screen, and the scrollbar
    // ran the full height of a rounded panel and clipped against its corners.
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-5 sm:px-7">
        <div className="min-w-0">
          <p className="text-[12px] text-subtle">{match.supplier.businessName} · {match.supplier.city}</p>
          <h3 className="font-display mt-1 text-[22px] leading-tight tracking-[-0.015em] text-ink sm:text-[25px]">
            {match.name}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close fabric"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <Plus size={16} weight="bold" className="rotate-45" />
        </button>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7">
        <span className="block aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] border border-line bg-sunken">
          <FabricSwatch
            weave={match.weave}
            hex={colourway?.hex ?? "#C9C2B4"}
            gsm={match.gsm}
            // Seed must differ from the deck card for the same fabric, and
            // change with the colourway. `FabricSwatch` derives its SVG `<defs>`
            // ids from the seed, so two instances sharing one produce duplicate
            // ids — and the second silently paints with the first's pattern.
            // That is why picking a colourway appeared to do nothing.
            seed={`${match.slug}-detail-${colourway?.id ?? "base"}`}
            alt={`${match.name} in ${colourway?.name ?? "its first colourway"}`}
          />
        </span>

        {match.colorways.length > 1 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {match.colorways.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColourway(c)}
                aria-label={c.name}
                aria-pressed={colourway?.id === c.id}
                className={cn(
                  "size-7 rounded-full border-2 transition-transform duration-300 hover:scale-110",
                  colourway?.id === c.id ? "border-brand" : "border-line",
                )}
                style={{ background: c.hex }}
              />
            ))}
            <span className="ml-1 text-[12px] text-subtle">{colourway?.name}</span>
          </div>
        ) : null}

        <p className="font-mono mt-6 text-[26px] leading-none text-ink tnum">
          {formatPerMetre(match.pricePerMetre)}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3.5">
          {specs.map(([term, value]) => (
            <div key={term} className="border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-subtle">{term}</dt>
              <dd className="mt-0.5 truncate text-[13.5px] font-medium text-ink" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {/* A disabled button with no reason beside it is just a dead control. */}
        {!orderable ? (
          <p className="mt-5 rounded-[var(--radius-md)] border border-warn-line bg-warn-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink">
            {colourway ? `${colourway.name} has` : "This fabric has"} {formatMetres(available)} left, and the mill
            needs {formatMetres(match.moqMetres)} to run an order.
            {match.colorways.length > 1 ? " Another colourway may have more." : ""}
          </p>
        ) : null}
      </div>

      {/* Pushed apart: the primary action and a link away from it should not
          sit shoulder to shoulder as though they were a pair. */}
      <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-5 sm:px-7">
        <Button
          type="button"
          // Stays disabled through the whole confirmation, not just the
          // request. Otherwise the ~1.8s the label spends reading "Added" is
          // an open window to add the same line again, and again.
          disabled={!orderable || locked}
          onClick={() =>
            void add({
              productId: match.id,
              productName: match.name,
              colorwayId: colourway?.id ?? null,
              quantityMetres: match.moqMetres,
              returnTo: "/scan",
            })
          }
          icon={busy ? <Spinner className="size-4" /> : done ? <Check size={14} weight="bold" /> : undefined}
        >
          {done ? "Added to cart" : orderable ? `Add ${formatMetres(match.moqMetres)}` : "Below the mill's minimum"}
        </Button>

        <Link
          href={`/product/${match.slug}`}
          className="group inline-flex items-center gap-1.5 text-[13px] text-brand-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-brand"
        >
          View product
          <ArrowRight size={12} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
