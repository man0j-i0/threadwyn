"use client";

import { Check, Plus } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useAddToCart } from "@/lib/use-add-to-cart";
import { Spinner } from "@/components/ui/spinner";

/**
 * One-tap add at MOQ from a grid card. Quantity is refined on the product page
 * or in the cart — forcing a metre count before a buyer has even opened the
 * product would be friction with no payoff.
 *
 * The request, the signed-out and supplier cases and the toasts live in
 * `useAddToCart`, shared with the fabric scan's result panel.
 */
export function QuickAdd({
  productId,
  productName,
  colorwayId,
  moq,
  disabled,
  className,
}: {
  productId: string;
  productName: string;
  colorwayId: string | null;
  moq: number;
  disabled?: boolean;
  className?: string;
}) {
  const { add, busy, done } = useAddToCart();

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;
        void add({ productId, productName, colorwayId, quantityMetres: moq });
      }}
      disabled={disabled || busy}
      aria-label={disabled ? `${productName} is unavailable` : `Add ${moq} metres of ${productName} to cart`}
      className={cn(
        "grid size-9 cursor-pointer place-items-center rounded-full border",
        "transition-[background-color,border-color,color,transform] duration-300 ease-[var(--ease-spring)]",
        "active:scale-90",
        "disabled:cursor-not-allowed disabled:opacity-40",
        done
          ? "border-positive bg-positive text-white"
          : "border-line bg-surface text-muted hover:border-brand hover:bg-brand hover:text-white",
        className,
      )}
    >
      {busy ? <Spinner className="size-4" /> : done ? <Check size={15} weight="bold" /> : <Plus size={15} weight="bold" />}
    </button>
  );
}
