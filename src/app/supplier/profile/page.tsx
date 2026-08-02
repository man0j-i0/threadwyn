import type { Metadata } from "next";
import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

import { requireSupplierPage } from "@/lib/auth/guards";
import { getSupplierProfile } from "@/server/services/supplier-service";
import { readSession } from "@/lib/auth/session";
import { serialize } from "@/lib/serialize";
import { SupplierProfileForm } from "@/components/supplier/profile-form";
import type { SupplierProfileInput } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Business profile" };

export default async function SupplierProfilePage() {
  await requireSupplierPage();
  const session = (await readSession())!;
  const profile = await getSupplierProfile(session.sub);
  const data = profile ? serialize(profile) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Settings</p>
          <h1 className="font-display mt-2.5 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink">
            Business profile
          </h1>
          <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-muted">
            This is what a buyer reads before deciding whether to trust you with an order.
          </p>
        </div>
        {profile ? (
          <Link
            href={`/marketplace?supplier=${profile.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-[13px] text-brand-ink underline underline-offset-4 hover:text-brand-hover"
          >
            View your listings
            <ArrowSquareOut size={12} weight="bold" />
          </Link>
        ) : null}
      </header>

      <SupplierProfileForm
        mode="settings"
        initial={data ? (data as unknown as Partial<SupplierProfileInput>) : undefined}
      />
    </div>
  );
}
