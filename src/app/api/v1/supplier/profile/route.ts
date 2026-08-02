import { requireSession, forbidden } from "@/lib/auth/guards";
import { handleError, ok, parseBody } from "@/lib/api/respond";
import { setSessionCookie } from "@/lib/auth/session";
import { supplierProfileSchema } from "@/lib/validation/schemas";
import { getSupplierProfile, upsertSupplierProfile } from "@/server/services/supplier-service";

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== "SUPPLIER") throw forbidden();
    return ok(await getSupplierProfile(session.sub));
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    // Deliberately `requireSession`, not `requireSupplier`: this is the
    // endpoint that *creates* the profile, so it cannot require one to exist.
    const session = await requireSession();
    if (session.role !== "SUPPLIER") throw forbidden();

    const input = await parseBody(req, supplierProfileSchema);
    const profile = await upsertSupplierProfile(session.sub, input);

    // Re-issue the cookie so `onboarded` flips and the route gate stops
    // redirecting them back into onboarding.
    await setSessionCookie({ ...session, onboarded: true });

    return ok(profile);
  } catch (err) {
    return handleError(err);
  }
}
