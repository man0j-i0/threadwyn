import { requireSupplier } from "@/lib/auth/guards";
import { created, handleError, ok, parseBody } from "@/lib/api/respond";
import { productSchema } from "@/lib/validation/schemas";
import { createSupplierProduct, listSupplierProducts } from "@/server/services/supplier-service";

export async function GET(req: Request) {
  try {
    const { supplierId } = await requireSupplier();
    const params = new URL(req.url).searchParams;
    return ok(
      await listSupplierProducts(supplierId, {
        q: params.get("q") ?? undefined,
        status: params.get("status") ?? undefined,
        category: params.get("category") ?? undefined,
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { supplierId } = await requireSupplier();
    const input = await parseBody(req, productSchema);
    return created(await createSupplierProduct(supplierId, input));
  } catch (err) {
    return handleError(err);
  }
}
