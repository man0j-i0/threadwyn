import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { WeaverMark } from "@/components/brand/weaver-mark";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1400px] items-center px-4 py-5 sm:px-6 lg:px-10">
        <Logo />
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-md text-center">
          <WeaverMark mood="search" className="mx-auto size-28" />
          <p className="eyebrow mt-6 text-subtle">404</p>
          <h1 className="font-display mt-3 text-3xl leading-tight font-medium text-balance text-ink sm:text-4xl">
            This thread doesn&apos;t lead anywhere
          </h1>
          <p className="mt-3.5 text-[15px] leading-relaxed text-pretty text-muted">
            The page you were after has moved or never existed. The catalogue is still where you left it.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/marketplace">Browse fabrics</ButtonLink>
            <ButtonLink href="/" variant="secondary">
              Back to the homepage
            </ButtonLink>
          </div>
          <p className="mt-8 text-[12.5px] text-subtle">
            Looking for an order?{" "}
            <Link href="/orders" className="text-brand-ink underline underline-offset-4">
              Your orders are here
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
