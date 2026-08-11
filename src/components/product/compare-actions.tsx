"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";

import { useCompare } from "@/lib/use-compare";

/** Remove one column from the comparison, or open that fabric. */
export function CompareActions({
  slug,
  slugs,
  name,
}: {
  slug: string;
  slugs: string[];
  name: string;
}) {
  const router = useRouter();
  const compare = useCompare();
  const remaining = slugs.filter((s) => s !== slug);

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/product/${slug}`}
        className="flex min-h-8 flex-1 items-center justify-center rounded-full border border-line bg-canvas-veil px-3 text-[11.5px] font-medium text-muted transition-colors hover:border-brand-line hover:bg-brand-soft hover:text-brand-ink"
      >
        Open
      </Link>
      <button
        type="button"
        onClick={() => {
          // The URL drives the table, the store drives the floating bar. Drop
          // the column from both or they disagree the moment you navigate away.
          compare.remove(slug);
          router.push(remaining.length ? `/compare?slugs=${remaining.join(",")}` : "/marketplace");
        }}
        aria-label={`Remove ${name} from the comparison`}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-line text-subtle transition-colors hover:border-danger-line hover:bg-danger-soft hover:text-danger"
      >
        <X size={11} weight="bold" />
      </button>
    </div>
  );
}
