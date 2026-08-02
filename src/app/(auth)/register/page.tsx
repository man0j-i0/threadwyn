import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { RegisterForm } from "@/components/auth/register-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Join Threadwyn as a fabric buyer or as a mill listing your catalogue.",
};

export default function RegisterPage() {
  return (
    <div>
      <p className="eyebrow text-accent">Get started</p>
      <h1 className="font-display mt-3 text-3xl leading-tight font-medium text-ink sm:text-[2.25rem]">
        Create your Threadwyn account
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-brand-ink underline underline-offset-4 hover:text-brand-hover">
          Sign in
        </Link>
        .
      </p>

      <Suspense fallback={<Skeleton className="mt-8 h-[30rem] w-full rounded-[var(--radius-lg)]" />}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
