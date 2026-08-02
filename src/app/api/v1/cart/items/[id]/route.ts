import { requireBuyer } from "@/lib/auth/guards";
import { handleError, ok, parseBody } from "@/lib/api/respond";
import { cartUpdateSchema } from "@/lib/validation/schemas";
import { removeCartItem, updateCartItem } from "@/server/services/cart-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireBuyer();
    const { id } = await params;
    const { quantityMetres } = await parseBody(req, cartUpdateSchema);
    return ok(await updateCartItem(session.sub, id, quantityMetres));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireBuyer();
    const { id } = await params;
    return ok(await removeCartItem(session.sub, id));
  } catch (err) {
    return handleError(err);
  }
}
