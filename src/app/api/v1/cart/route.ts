import { requireBuyer } from "@/lib/auth/guards";
import { handleError, ok } from "@/lib/api/respond";
import { clearCart, getCart } from "@/server/services/cart-service";

export async function GET() {
  try {
    const session = await requireBuyer();
    return ok(await getCart(session.sub));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE() {
  try {
    const session = await requireBuyer();
    return ok(await clearCart(session.sub));
  } catch (err) {
    return handleError(err);
  }
}
