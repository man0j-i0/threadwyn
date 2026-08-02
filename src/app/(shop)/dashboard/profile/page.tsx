import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { requireBuyerPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { BuyerOnboarding } from "@/components/onboarding/buyer-onboarding";
import type { BuyerProfileInput } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Profile & preferences" };

export default async function BuyerProfilePage() {
  const session = await requireBuyerPage("/dashboard/profile");
  const profile = await db.buyerProfile.findUnique({ where: { userId: session.sub } });
  const data = profile ? serialize(profile) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-ink"
      >
        <ArrowLeft size={12} weight="bold" />
        Dashboard
      </Link>

      <header className="mt-6 mb-8">
        <p className="eyebrow text-accent">Settings</p>
        <h1 className="font-display mt-2.5 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
          Profile &amp; preferences
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Everything here feeds the recommendations on your dashboard and the defaults the assistant assumes
          when you ask it for something.
        </p>
      </header>

      <BuyerOnboarding
        mode="settings"
        defaultName={session.name}
        initial={data ? (data as unknown as Partial<BuyerProfileInput>) : undefined}
      />
    </div>
  );
}
