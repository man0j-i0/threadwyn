import { db } from "@/lib/db";
import { requireSession, forbidden } from "@/lib/auth/guards";
import { handleError, ok, parseBody } from "@/lib/api/respond";
import { setSessionCookie } from "@/lib/auth/session";
import { buyerProfileSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== "BUYER") throw forbidden();
    return ok(await db.buyerProfile.findUnique({ where: { userId: session.sub } }));
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    if (session.role !== "BUYER") throw forbidden();

    const input = await parseBody(req, buyerProfileSchema);
    const data = {
      businessName: input.businessName,
      businessType: input.businessType,
      industry: input.industry,
      city: input.city || null,
      categoryInterest: input.categoryInterest,
      preferredFabrics: input.preferredFabrics,
      typicalOrderQty: input.typicalOrderQty,
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
      notes: input.notes || null,
      onboardingMode: input.onboardingMode,
      onboardedAt: new Date(),
    };

    const profile = await db.buyerProfile.upsert({
      where: { userId: session.sub },
      create: { userId: session.sub, ...data },
      update: data,
    });

    await setSessionCookie({ ...session, onboarded: true });

    return ok(profile);
  } catch (err) {
    return handleError(err);
  }
}
