"use client";

import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowsLeftRight, X } from "@phosphor-icons/react";

import { COMPARE_LIMIT, useCompare } from "@/lib/use-compare";

/**
 * The shortlist, made visible.
 *
 * Without this the compare feature has no state a buyer can see: they add a
 * fabric, nothing changes on screen, and they have no reason to think a second
 * one would join the first. The bar is the whole affordance — it appears on the
 * first pick, counts up, and is the way through to the table.
 *
 * Bottom left, because the assistant owns bottom right. Hidden on `/compare`
 * itself, where the columns are already the interface.
 */
export function CompareBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { slugs, count, clear, href } = useCompare();

  const visible = count > 0 && pathname !== "/compare";

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.14 } }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          data-print-hide
          className="fixed bottom-4 left-4 z-70 flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-lg)] sm:bottom-6 sm:left-6"
        >
          <button
            type="button"
            onClick={() => router.push(href)}
            disabled={count < 2}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-sunken disabled:cursor-default disabled:text-subtle disabled:hover:bg-transparent"
          >
            <ArrowsLeftRight size={15} weight="light" className="shrink-0" />
            {/* Under two columns there is nothing to compare against, so the
                bar says what is missing rather than offering a dead link. */}
            {count < 2 ? (
              <span>
                Compare · add one more
              </span>
            ) : (
              <span>
                Compare {count} fabrics
                {count === COMPARE_LIMIT ? <span className="text-subtle"> · full</span> : null}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={clear}
            aria-label={`Clear all ${slugs.length} from the comparison`}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <X size={12} weight="bold" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
