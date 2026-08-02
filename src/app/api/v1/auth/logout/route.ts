import { clearSessionCookie } from "@/lib/auth/session";
import { handleError, ok } from "@/lib/api/respond";

export async function POST() {
  try {
    await clearSessionCookie();
    return ok({ signedOut: true });
  } catch (err) {
    return handleError(err);
  }
}
