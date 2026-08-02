"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Plus } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

/**
 * One-tap add at MOQ from a grid card. Quantity is refined on the product page
 * or in the cart — forcing a metre count before a buyer has even opened the
 * product would be friction with no payoff.
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
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (disabled || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, colorwayId, quantityMetres: moq }),
      });

      if (res.status === 401) {
        toast({
          tone: "info",
          title: "Sign in to add to cart",
          description: "Your basket is kept against your account.",
          action: { label: "Sign in", onClick: () => router.push("/login?next=/marketplace") },
        });
        return;
      }
      if (res.status === 403) {
        toast({
          tone: "info",
          title: "Supplier accounts can't buy",
          description: "Cart and checkout are buyer-side features.",
        });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Could not add to cart.");
      }

      setDone(true);
      window.setTimeout(() => setDone(false), 1800);
      toast({
        tone: "success",
        title: `Added ${moq}m of ${productName}`,
        description: "Adjust the quantity in your cart.",
        action: { label: "View cart", onClick: () => router.push("/cart") },
      });
      startTransition(() => router.refresh());
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not add to cart",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={add}
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
      {busy || pending ? (
        <Spinner className="size-4" />
      ) : done ? (
        <Check size={15} weight="bold" />
      ) : (
        <Plus size={15} weight="bold" />
      )}
    </button>
  );
}
