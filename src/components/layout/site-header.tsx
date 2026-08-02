import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { HeaderClient } from "./site-header-client";

/**
 * Server shell for the header: resolves session, cart count and the featured
 * category list once, then hands plain data to the interactive client island.
 * Keeps data access off the client and stops the cart badge flickering in.
 */
export async function SiteHeader({ floating = false }: { floating?: boolean }) {
  const session = await readSession();

  const [cart, categories] = await Promise.all([
    session?.role === "BUYER"
      ? db.cart.findUnique({
          where: { buyerId: session.sub },
          select: { _count: { select: { items: true } } },
        })
      : Promise.resolve(null),
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { name: true, slug: true, blurb: true, accentHex: true },
    }),
  ]);

  return (
    <HeaderClient
      floating={floating}
      cartCount={cart?._count.items ?? 0}
      categories={categories}
      user={
        session
          ? {
              name: session.name,
              email: session.email,
              role: session.role,
              onboarded: session.onboarded,
            }
          : null
      }
    />
  );
}
