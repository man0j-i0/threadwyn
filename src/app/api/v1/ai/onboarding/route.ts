import { requireSession } from "@/lib/auth/guards";
import { handleError, ok, parseBody, rateLimit } from "@/lib/api/respond";
import { RATE_RULES } from "@/lib/rate-limit";
import { aiOnboardingSchema } from "@/lib/validation/schemas";
import { extractProfile } from "@/lib/ai/onboarding";

export const maxDuration = 30;

/**
 * Turns an onboarding conversation into a structured draft profile.
 *
 * This endpoint deliberately does NOT write anything. It returns a draft the
 * user reviews and edits, and the ordinary validated profile endpoints do the
 * saving. That keeps one write path, one validation schema, and no route where
 * model output reaches the database unseen.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, RATE_RULES.aiOnboarding);
  if (limited) return limited;

  try {
    const session = await requireSession();
    const input = await parseBody(req, aiOnboardingSchema);

    if (input.role !== session.role) {
      return ok({ draft: {}, mode: "rules", model: "n/a" });
    }

    const result = await extractProfile(input.role, input.transcript);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
