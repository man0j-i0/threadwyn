import { requireBuyer } from "@/lib/auth/guards";
import { created, handleError, parseBody } from "@/lib/api/respond";
import { cartItemSchema } from "@/lib/validation/schemas";
import { addToCart } from "@/server/services/cart-service";

export async function POST(req: Request) {
  try {
    const session = await requireBuyer();
    const input = await parseBody(req, cartItemSchema);
    return created(await addToCart(session.sub, input));
  } catch (err) {
    return handleError(err);
  }
}
