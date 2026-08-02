import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Threadwyn buyer or supplier account.",
};

export default function LoginPage() {
  return (
    <div>
      <p className="eyebrow text-accent">Welcome back</p>
      <h1 className="font-display mt-3 text-3xl leading-tight font-medium text-ink sm:text-[2.25rem]">
        Sign in to Threadwyn
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-brand-ink underline underline-offset-4 hover:text-brand-hover">
          Create one
        </Link>
        .
      </p>

      <Suspense fallback={<Skeleton className="mt-8 h-72 w-full rounded-[var(--radius-lg)]" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
