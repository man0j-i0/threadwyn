import type { Metadata } from "next";

import { requireBuyerPage } from "@/lib/auth/guards";
import { getCart } from "@/server/services/cart-service";
import { serialize } from "@/lib/serialize";
import { CartView } from "@/components/cart/cart-view";
import { AssistantDock } from "@/components/ai/assistant-dock";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const session = await requireBuyerPage("/cart");
  const cart = await getCart(session.sub);

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="mb-8">
          <p className="eyebrow text-accent">Your basket</p>
          <h1 className="font-display mt-3 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            Cart
          </h1>
        </header>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <CartView cart={serialize(cart) as any} />
      </div>

      <AssistantDock />
    </>
  );
}
