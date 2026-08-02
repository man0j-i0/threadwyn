import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { handleError, ok } from "@/lib/api/respond";

export async function GET() {
  try {
    const session = await readSession();
    if (!session) return ok({ user: null });

    const user = await db.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        buyerProfile: true,
        supplierProfile: true,
      },
    });

    return ok({ user });
  } catch (err) {
    return handleError(err);
  }
}
