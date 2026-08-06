import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import clothDark from "@/assets/auth-cloth-dark.png";
import clothLight from "@/assets/auth-cloth-light.png";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/system/theme-toggle";

/**
 * One photograph across the whole viewport, with the form floating on frosted
 * glass over the left of it.
 *
 * The previous arrangement was a hard 50/50 seam: form on one side, picture on
 * the other, with a visible join down the middle. That join is what makes a
 * split auth screen look like two pages stapled together. Letting the cloth run
 * edge to edge and putting the form *on* it removes the seam, and the
 * photograph gets to be a room rather than a panel.
 *
 * Layer order below is load-bearing, so it is worth stating plainly:
 *
 *   1. the photograph
 *   2. the bottom scrim, full width, so it has no hard left edge of its own
 *   3. the frosted glass, which paints back over the scrim on the form side
 *      and is masked away on the right, leaving the scrim visible only where
 *      the type needs it
 *   4. the content
 *   5. the claim, in the clear region
 *
 * Every decorative layer is `pointer-events-none`. An earlier version had the
 * claim spanning the full width with left padding to position its text, which
 * left an invisible element lying across the bottom of the form and swallowing
 * clicks on the password field, the submit button and the back link.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      {/* 1 ------------------------------------------------------- the cloth */}
      {/* Two photographs, cross-faded by CSS on the theme class rather than
          swapped in JavaScript. `ThemeScript` stamps `.dark` on <html> before
          first paint, so a JS swap would show the wrong image on load and flash
          again on every toggle. The cost is one extra image; the alternative is
          a visible flicker on the first screen most people see.

          Warm knits for light, indigo and chambray for dark, so the photograph
          moves with the palette instead of fighting it. */}
      <Image
        src={clothLight}
        alt=""
        fill
        sizes="100vw"
        priority
        className="object-cover transition-opacity duration-500 dark:opacity-0"
      />
      <Image
        src={clothDark}
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-0 transition-opacity duration-500 dark:opacity-100"
      />

      {/* 2 ------------------------------------------------------ the scrim */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[#191713]/90 via-[#191713]/45 to-transparent"
      />

      {/* 3 ------------------------------------------------------ the glass */}
      {/* Masked on the right so the frost dissolves into the sharp image
          instead of terminating at an edge you can point at. The tint comes
          from `--canvas`, so it is cream in light and warm charcoal in dark and
          the form keeps the palette's own contrast rather than depending on how
          bright the photograph happens to be. Full width below lg, where a form
          floating over an unobscured photograph would be unreadable. */}
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-y-0 left-0 w-full backdrop-blur-2xl lg:w-[50%]",
          "bg-canvas/85 lg:bg-canvas/80",
          "[mask-image:linear-gradient(to_right,black_0%,black_74%,transparent_100%)]",
        ].join(" ")}
      />

      {/* 4 ----------------------------------------------------- the content */}
      {/* One measure for the whole column.
          The wordmark and the back link were flush to the column's padding
          while the form was `mx-auto` inside it, so the form floated a couple
          of hundred pixels right of both and nothing shared an edge. Everything
          now sits in a single centred container, so the three blocks stack on
          one left margin and one right margin. */}
      <div className="relative grid min-h-dvh lg:grid-cols-[minmax(0,50%)_minmax(0,50%)]">
        <div className="flex flex-col px-5 py-6 sm:px-10 lg:pr-10 lg:pl-16 xl:pl-20">
          <div className="flex w-full max-w-[27rem] flex-1 flex-col">
            {/* The toggle belongs beside the wordmark, not opposite it.
                `justify-between` threw it to the far edge of the column, which
                on a full-bleed photograph means it lands on the picture. */}
            <div className="flex items-center gap-3">
              <Logo />
              <ThemeToggle />
            </div>

            <div className="flex flex-1 items-center py-12">
              <div className="w-full">{children}</div>
            </div>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 self-start text-[13px] text-subtle transition-colors hover:text-ink"
            >
              <ArrowLeft size={12} weight="bold" />
              Back to Threadwyn
            </Link>
          </div>
        </div>
      </div>

      {/* 5 ------------------------------------------------------- the claim */}
      {/* Starts at the dissolve rather than at the column edge, so it lines up
          with the one vertical this composition actually has. Constrained to
          the right of it, never across the form. */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-[38%] hidden pr-12 pb-12 lg:block">
        <p className="font-display max-w-md text-[26px] leading-snug font-medium text-balance text-white">
          Every swatch in the catalogue is drawn from the fabric&apos;s real weave, weight and dyed
          colour.
        </p>
        <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/70">
          Generated from the mill&apos;s own specification, so two mills quoting the same navy can
          actually be compared.
        </p>
      </div>
    </div>
  );
}
