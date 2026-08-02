import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { created, handleError, parseBody } from "@/lib/api/respond";
import { HttpError } from "@/lib/auth/guards";
import { registerSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const input = await parseBody(req, registerSchema);

    const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) {
      throw new HttpError(409, "email_taken", "An account with that email already exists.", {
        email: "That email is already registered. Try signing in instead.",
      });
    }

    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await hashPassword(input.password),
        avatarHue: Math.floor(Math.random() * 360),
        // Buyers get a cart immediately so nothing has to lazily create one
        // mid-request later.
        ...(input.role === "BUYER" ? { cart: { create: {} } } : {}),
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await setSessionCookie({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      onboarded: false,
    });

    return created({
      user,
      next: input.role === "BUYER" ? "/onboarding" : "/supplier/onboarding",
    });
  } catch (err) {
    return handleError(err);
  }
}
