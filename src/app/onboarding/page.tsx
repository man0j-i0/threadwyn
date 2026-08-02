import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/system/theme-toggle";
import { BuyerOnboarding } from "@/components/onboarding/buyer-onboarding";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function BuyerOnboardingPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/onboarding");
  if (session.role === "SUPPLIER") redirect("/supplier/onboarding");

  const existing = await db.buyerProfile.findUnique({
    where: { userId: session.sub },
    select: { onboardedAt: true },
  });
  if (existing?.onboardedAt) redirect("/dashboard");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="mb-8">
          <p className="eyebrow text-accent">One minute, then you&apos;re in</p>
          <h1 className="font-display mt-3 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            Tell me what you source
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            A short conversation instead of a long form. Everything I pick up is shown back to you as editable
            fields before anything is saved.
          </p>
        </div>

        <BuyerOnboarding defaultName={session.name} />
      </main>
    </div>
  );
}
