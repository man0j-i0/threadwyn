import { requireSupplier } from "@/lib/auth/guards";
import { handleError, ok, parseBody } from "@/lib/api/respond";
import { productSchema } from "@/lib/validation/schemas";
import {
  deleteSupplierProduct,
  getSupplierProduct,
  updateSupplierProduct,
} from "@/server/services/supplier-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { supplierId } = await requireSupplier();
    const { id } = await params;
    return ok(await getSupplierProduct(supplierId, id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { supplierId } = await requireSupplier();
    const { id } = await params;
    const input = await parseBody(req, productSchema);
    return ok(await updateSupplierProduct(supplierId, id, input));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { supplierId } = await requireSupplier();
    const { id } = await params;
    return ok(await deleteSupplierProduct(supplierId, id));
  } catch (err) {
    return handleError(err);
  }
}
