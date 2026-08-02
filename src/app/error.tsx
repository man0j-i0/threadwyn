"use client";

import { useEffect } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";

import { Logo } from "@/components/brand/logo";
import { WeaverMark } from "@/components/brand/weaver-mark";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Root error boundary. Shows a recovery path rather than a stack trace — the
 * digest is included so a report can be tied back to a server log without
 * exposing anything about what actually failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[threadwyn] unhandled error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1400px] items-center px-4 py-5 sm:px-6 lg:px-10">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-md text-center">
          <WeaverMark mood="error" className="mx-auto size-28" />
          <p className="eyebrow mt-6 text-danger">Something broke</p>
          <h1 className="font-display mt-3 text-3xl leading-tight font-medium text-balance text-ink sm:text-4xl">
            A thread snapped on our side
          </h1>
          <p className="mt-3.5 text-[15px] leading-relaxed text-pretty text-muted">
            This is our fault, not yours. Trying again usually works — the request may simply have hit a
            connection that had gone stale.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={reset} icon={<ArrowClockwise size={15} weight="bold" />}>
              Try again
            </Button>
            <ButtonLink href="/marketplace" variant="secondary">
              Back to the marketplace
            </ButtonLink>
          </div>

          {error.digest ? (
            <p className="mt-8 font-mono text-[11px] text-subtle">Reference {error.digest}</p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
