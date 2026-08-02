import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { Logo } from "@/components/brand/logo";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { ThemeToggle } from "@/components/system/theme-toggle";

/**
 * Split shell: the form owns the left half at full attention, and the right
 * half is a quiet wall of real rendered cloth. It's the same renderer the
 * catalogue uses, so even the sign-in screen is showing the actual product.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const wall = [
    { weave: "PLAIN", hex: "#DDD3C0", gsm: 165 },
    { weave: "TWILL", hex: "#2A3A5C", gsm: 407 },
    { weave: "SATIN", hex: "#6B2233", gsm: 71 },
    { weave: "JERSEY", hex: "#175D45", gsm: 180 },
    { weave: "HERRINGBONE", hex: "#3A3A3C", gsm: 280 },
    { weave: "JACQUARD", hex: "#B08A3C", gsm: 165 },
    { weave: "CANVAS", hex: "#5B603D", gsm: 340 },
    { weave: "CREPE", hex: "#B0603F", gsm: 120 },
    { weave: "RIB", hex: "#1F5C5C", gsm: 240 },
  ] as const;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1fr] xl:grid-cols-[0.95fr_1.05fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-ink"
        >
          <ArrowLeft size={12} weight="bold" />
          Back to Threadwyn
        </Link>
      </div>

      <aside aria-hidden className="relative hidden overflow-hidden bg-canvas-veil lg:block">
        <div className="grid h-full grid-cols-3 gap-px bg-line">
          {wall.map((s, i) => (
            <div key={i} className="relative overflow-hidden">
              <FabricSwatch
                weave={s.weave}
                hex={s.hex}
                gsm={s.gsm}
                seed={`auth-${i}`}
                alt=""
                drape={i % 3 === 1}
              />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#191713]/85 via-[#191713]/35 to-transparent px-12 pt-28 pb-12">
          <p className="font-display max-w-md text-[26px] leading-snug font-medium text-balance text-white">
            Every swatch on Threadwyn is drawn from the fabric&apos;s real weave, weight and dyed colour.
          </p>
          <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/70">
            No stock photography, no lighting tricks — so two mills quoting the same navy can actually be
            compared.
          </p>
        </div>
      </aside>
    </div>
  );
}
