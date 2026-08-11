import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { handleError, ok, parseBody, rateLimit } from "@/lib/api/respond";
import { RATE_RULES } from "@/lib/rate-limit";
import { HttpError } from "@/lib/auth/guards";
import { loginSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const limited = rateLimit(req, RATE_RULES.login);
  if (limited) return limited;

  try {
    const input = await parseBody(req, loginSchema);

    const user = await db.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        buyerProfile: { select: { onboardedAt: true } },
        supplierProfile: { select: { onboardedAt: true } },
      },
    });

    // Same message and roughly the same work whether the email is unknown or
    // the password is wrong — no account enumeration through this endpoint.
    const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new HttpError(401, "invalid_credentials", "That email and password don't match.");
    }

    const onboarded = Boolean(user.buyerProfile?.onboardedAt ?? user.supplierProfile?.onboardedAt);

    await setSessionCookie({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      onboarded,
    });

    return ok({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      next: onboarded
        ? user.role === "BUYER"
          ? "/dashboard"
          : "/supplier"
        : user.role === "BUYER"
          ? "/onboarding"
          : "/supplier/onboarding",
    });
  } catch (err) {
    return handleError(err);
  }
}
