import { requireSupplier } from "@/lib/auth/guards";
import { handleError, ok, parseBody } from "@/lib/api/respond";
import { orderStatusSchema } from "@/lib/validation/schemas";
import { getSupplierOrder, updateOrderStatus } from "@/server/services/order-service";

type Params = { params: Promise<{ reference: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { supplierId } = await requireSupplier();
    const { reference } = await params;
    return ok(await getSupplierOrder(supplierId, reference));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { supplierId } = await requireSupplier();
    const { reference } = await params;
    const input = await parseBody(req, orderStatusSchema);

    return ok(
      await updateOrderStatus(
        supplierId,
        reference,
        input.status,
        input.note || undefined,
        input.expectedReadyAt ? new Date(input.expectedReadyAt) : undefined,
      ),
    );
  } catch (err) {
    return handleError(err);
  }
}
