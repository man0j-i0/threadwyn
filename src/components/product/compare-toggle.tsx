"use client";

import { ArrowsLeftRight, Check } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { COMPARE_LIMIT, useCompare } from "@/lib/use-compare";
import { useToast } from "@/components/ui/toast";

/**
 * Add a fabric to the shortlist without leaving the grid.
 *
 * The card is a server component and the shortlist lives in localStorage, so
 * this is the client island that bridges them — the same shape as QuickAdd.
 *
 * Shortlisting from the grid is the point. Opening two products in turn to
 * compare them is exactly the twelve-tabs problem the marketplace exists to
 * solve, so the comparison has to be assemblable from the results page itself.
 */
export function CompareToggle({ slug, name }: { slug: string; name: string }) {
  const { has, toggle } = useCompare();
  const { toast } = useToast();
  const active = has(slug);

  return (
    <button
      type="button"
      onClick={() => {
        const result = toggle(slug);
        if (result.full) {
          toast({
            tone: "error",
            title: `Compare holds ${COMPARE_LIMIT} fabrics`,
            description: "Remove one before adding another.",
          });
        }
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from compare` : `Add ${name} to compare`}
      title={active ? "In compare" : "Add to compare"}
      className={cn(
        "grid size-9 cursor-pointer place-items-center rounded-full border transition-colors",
        active
          ? "border-brand bg-brand text-white dark:text-[#08110d]"
          : "border-line text-subtle hover:border-brand-line hover:bg-brand-soft hover:text-brand-ink",
      )}
    >
      {active ? <Check size={14} weight="bold" /> : <ArrowsLeftRight size={14} weight="light" />}
    </button>
  );
}
