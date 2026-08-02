import { requireBuyer } from "@/lib/auth/guards";
import { created, handleError, ok, parseBody } from "@/lib/api/respond";
import { checkoutSchema } from "@/lib/validation/schemas";
import { getBuyerOrders, placeOrder } from "@/server/services/order-service";

export async function GET() {
  try {
    const session = await requireBuyer();
    return ok(await getBuyerOrders(session.sub));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireBuyer();
    const input = await parseBody(req, checkoutSchema);
    return created(await placeOrder(session.sub, input));
  } catch (err) {
    return handleError(err);
  }
}
