import { requireSupplier } from "@/lib/auth/guards";
import { handleError, ok, parseBody } from "@/lib/api/respond";
import { stockUpdateSchema } from "@/lib/validation/schemas";
import { updateStock } from "@/server/services/supplier-service";

type Params = { params: Promise<{ id: string }> };

/** Fast path for the one edit suppliers make most: adjusting stock. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { supplierId } = await requireSupplier();
    const { id } = await params;
    const { colorways } = await parseBody(req, stockUpdateSchema);
    return ok(await updateStock(supplierId, id, colorways));
  } catch (err) {
    return handleError(err);
  }
}
