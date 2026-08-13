"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";

/**
 * Adding to the cart, in one place.
 *
 * Extracted from `QuickAdd` when the fabric scan needed the same behaviour
 * behind a full-width button instead of a round icon. The visible control
 * differs; what must not differ is what happens when the buyer is signed out,
 * is a supplier, or the line is refused — those are three separate answers and
 * a second copy of them would drift.
 */
export type AddToCartInput = {
  productId: string;
  productName: string;
  colorwayId: string | null;
  quantityMetres: number;
  /** Where to return after signing in. */
  returnTo?: string;
};

export function useAddToCart() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const add = useCallback(
    async ({ productId, productName, colorwayId, quantityMetres, returnTo }: AddToCartInput) => {
      // `done` is part of the guard, not just `busy`. The request finishes in
      // well under the 1.8s the button spends saying "Added", and without this
      // every click in that window queued another line — a spammed button
      // quietly ordering five times the metres the buyer asked for.
      if (busy || done) return false;
      setBusy(true);

      try {
        const res = await fetch("/api/v1/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, colorwayId, quantityMetres }),
        });

        if (res.status === 401) {
          toast({
            tone: "info",
            title: "Sign in to add to cart",
            description: "Your basket is kept against your account.",
            action: {
              label: "Sign in",
              onClick: () => router.push(`/login?next=${encodeURIComponent(returnTo ?? "/marketplace")}`),
            },
          });
          return false;
        }

        if (res.status === 403) {
          toast({
            tone: "info",
            title: "Supplier accounts can't buy",
            description: "Cart and checkout are buyer-side features.",
          });
          return false;
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(body?.error?.message ?? "Could not add to cart.");
        }

        setDone(true);
        window.setTimeout(() => setDone(false), 1800);
        toast({
          tone: "success",
          title: `Added ${quantityMetres}m of ${productName}`,
          description: "Adjust the quantity in your cart.",
          action: { label: "View cart", onClick: () => router.push("/cart") },
        });
        startTransition(() => router.refresh());
        return true;
      } catch (err) {
        toast({
          tone: "error",
          title: "Could not add to cart",
          description: err instanceof Error ? err.message : "Please try again.",
        });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, done, router, toast],
  );

  return {
    add,
    busy: busy || pending,
    done,
    /** What a control should disable on: in flight, or still confirming. */
    locked: busy || pending || done,
  };
}
