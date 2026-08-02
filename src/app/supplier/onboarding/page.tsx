import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { readSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/system/theme-toggle";
import { SupplierOnboarding } from "@/components/onboarding/supplier-onboarding";

export const metadata: Metadata = { title: "Set up your mill" };

export default async function SupplierOnboardingPage() {
  const session = await readSession();
  if (!session) redirect("/login?next=/supplier/onboarding");
  if (session.role !== "SUPPLIER") redirect("/onboarding");

  const existing = await db.supplierProfile.findUnique({
    where: { userId: session.sub },
    select: { onboardedAt: true },
  });
  if (existing?.onboardedAt) redirect("/supplier");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main id="main" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <div className="mb-8">
          <p className="eyebrow text-accent">Set up your mill</p>
          <h1 className="font-display mt-3 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            Tell me about your operation
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            Four questions, spoken or typed. I&apos;ll turn your answers into a business profile you can check
            and correct before it goes live.
          </p>
        </div>

        <SupplierOnboarding defaultName={session.name} defaultEmail={session.email} />
      </main>
    </div>
  );
}
