"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * The moment between "Place order" and the confirmation page.
 *
 * A spinner says the app is busy. This says what it is busy doing: the warp is
 * already strung, and picks are thrown across it one at a time — the same
 * argument the rest of the product makes, that cloth is built rather than
 * bought. It is the only screen in the flow where the user has committed and
 * has nothing to look at, so it is worth the twelve lines of geometry.
 *
 * Only `scaleX` animates, from a left origin, so every frame is a composited
 * transform. Nothing here reflows, and a slow machine drops frames rather than
 * blocking the checkout request running behind it.
 */

const WARP_ENDS = 11;
const WEFT_PICKS = 5;

export function PlacingOverlay({ open, mills }: { open: boolean; mills: number }) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-80 grid place-items-center bg-canvas/92 backdrop-blur-md"
        >
          <div className="flex flex-col items-center gap-7 px-6 text-center">
            <div aria-hidden className="relative h-16 w-28">
              {/* Warp: strung before anything is woven, and it stays put. */}
              <div className="absolute inset-0 flex justify-between">
                {Array.from({ length: WARP_ENDS }).map((_, i) => (
                  <span key={i} className="w-px bg-line-strong" />
                ))}
              </div>

              {/* Weft: one pick at a time, left to right, then the shed clears
                  and the sequence runs again. */}
              <div className="absolute inset-0 flex flex-col justify-between py-1.5">
                {Array.from({ length: WEFT_PICKS }).map((_, i) => (
                  <motion.span
                    key={i}
                    className="h-[3px] origin-left rounded-full bg-brand"
                    initial={{ scaleX: 0 }}
                    animate={reduced ? { scaleX: 1 } : { scaleX: [0, 1, 1, 0] }}
                    transition={
                      reduced
                        ? { duration: 0.25 }
                        : {
                            duration: 2,
                            times: [0, 0.4, 0.76, 1],
                            repeat: Infinity,
                            delay: i * 0.12,
                            ease: [0.16, 1, 0.3, 1],
                          }
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[15px] font-medium text-ink">Placing your order</p>
              <p className="mt-1.5 text-[13.5px] text-muted">
                {mills === 1 ? "Notifying the mill" : `Notifying ${mills} mills`}
              </p>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
