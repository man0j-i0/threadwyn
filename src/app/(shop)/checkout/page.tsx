import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireBuyerPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getCart } from "@/server/services/cart-service";
import { serialize } from "@/lib/serialize";
import { CheckoutFlow } from "@/components/cart/checkout-flow";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await requireBuyerPage("/checkout");
  const cart = await getCart(session.sub);

  // Nothing to check out — send them somewhere useful rather than rendering an
  // empty form they can't submit.
  if (cart.lines.length === 0) redirect("/cart");

  const profile = await db.buyerProfile.findUnique({
    where: { userId: session.sub },
    select: { businessName: true, city: true },
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
      <header className="mb-8">
        <p className="eyebrow text-accent">Almost there</p>
        <h1 className="font-display mt-3 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
          Checkout
        </h1>
      </header>

      <CheckoutFlow
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        cart={serialize(cart) as any}
        defaults={{
          shippingName: session.name,
          shippingEmail: session.email,
          shippingCompany: profile?.businessName ?? "",
          shippingCity: profile?.city ?? "",
        }}
      />
    </div>
  );
}
