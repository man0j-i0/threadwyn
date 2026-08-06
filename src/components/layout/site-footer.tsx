import Image from "next/image";
import Link from "next/link";

import footerClothDark from "@/assets/footer-cloth-dark.png";
import footerClothLight from "@/assets/footer-cloth-light.png";
import { db } from "@/lib/db";
import { LogoGlyph } from "@/components/brand/logo";

/**
 * The footer is a full-bleed photograph with the navigation set on top of it.
 *
 * Two things make this work rather than just being a picture behind text:
 *
 * 1. The band is deliberately tall and the content sits in its lower half, so
 *    the upper half is given over to the image and the line already set into
 *    it. A footer that ends the page on an image reads as a closing shot; one
 *    that crops the image to a thin strip behind link columns reads as a
 *    texture, which is not the same thing.
 *
 * 2. The scrim is a gradient, not a flat wash. It is nearly transparent at the
 *    top where the cloth is the subject and close to opaque at the bottom where
 *    four columns of small links have to stay legible. A single opacity that
 *    satisfied the links would have flattened the photograph.
 *
 * The footer is dark in both themes on purpose. It is the one inverted surface
 * on the site, and it works because it is the last thing on the page rather
 * than a section sandwiched between light ones.
 *
 * The line is real text rather than part of the photograph. The first source
 * had it baked in, which meant it could not be selected, could not be read by
 * a screen reader, and shifted with the crop as the viewport changed. Set in
 * HTML it stays put, stays crisp, and can be changed without a new image.
 *
 * No fade into the page at the top edge. One was tried and washed the top of
 * the photograph out to near-cream before the cloth had a chance to register,
 * which cost more than the softer join was worth. The band starts where it
 * starts.
 */
export async function SiteFooter() {
  const categories = await db.category.findMany({
    orderBy: { position: "asc" },
    select: { name: true, slug: true },
    take: 8,
  });

  return (
    <footer className="relative mt-24 overflow-hidden">
      {/* Two photographs, cross-faded by CSS on the theme class rather than
          swapped in JavaScript. `ThemeScript` stamps `.dark` on <html> before
          first paint, so a JS swap would paint the wrong one on load and flash
          again on every toggle.

          A shirt in a fitting-room mirror for light; shears, spools and buttons
          on dark wool for dark. Both are the same subject at different hours,
          which is what keeps the theme switch feeling like one identity rather
          than two skins. */}
      <Image
        src={footerClothLight}
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[50%_42%] transition-opacity duration-500 dark:opacity-0"
      />
      <Image
        src={footerClothDark}
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-[50%_50%] opacity-0 transition-opacity duration-500 dark:opacity-100"
      />

      {/* Darkening for the type. Light at the top where the cloth is the
          subject, close to opaque at the foot where four columns of 13px links
          have to hold. One flat opacity strong enough for the links would have
          killed the photograph.

          Much lighter in dark mode, because that photograph is already
          near-black: the same curve applied to it crushed the brass on the
          shears into the background and left the band looking like a dark
          rectangle rather than a picture. The links still clear AA against it. */}
      <div
        aria-hidden
        className={[
          "absolute inset-0",
          "bg-[linear-gradient(to_bottom,rgba(20,18,15,0.22)_0%,rgba(20,18,15,0.58)_44%,rgba(20,18,15,0.93)_100%)]",
          "dark:bg-[linear-gradient(to_bottom,rgba(8,7,6,0.05)_0%,rgba(8,7,6,0.34)_44%,rgba(8,7,6,0.82)_100%)]",
        ].join(" ")}
      />

      {/* The line. Real text, centred. */}
      <p className="relative pt-40 text-center font-sans text-[15px] leading-[1.9] font-light tracking-[0.32em] text-white/90 uppercase sm:pt-52 sm:text-[19px] lg:pt-64 lg:text-[23px]">
        A story woven
        <br />
        in silence
      </p>

      <div className="relative mx-auto max-w-[1400px] px-4 pt-40 pb-14 sm:px-6 sm:pt-48 lg:px-10 lg:pt-56">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <LogoGlyph className="size-8" />
              <span className="font-display text-[19px] font-medium tracking-[-0.02em] text-white">
                Threadwyn
              </span>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-white/70">
              A B2B textile marketplace built around one question: can a buyer decide on a fabric without
              opening twelve tabs?
            </p>
            <p className="mt-5 font-mono text-[11px] tracking-wide text-white/45">
              Woven swatches rendered from live specification data.
            </p>
          </div>

          <FooterColumn title="Marketplace">
            <FooterLink href="/marketplace">All fabrics</FooterLink>
            <FooterLink href="/marketplace?sort=newest">New arrivals</FooterLink>
            <FooterLink href="/marketplace?featured=1">Featured</FooterLink>
            <FooterLink href="/suppliers">Suppliers</FooterLink>
            <FooterLink href="/compare">Compare</FooterLink>
          </FooterColumn>

          <FooterColumn title="Categories">
            {categories.map((c) => (
              <FooterLink key={c.slug} href={`/marketplace?category=${c.slug}`}>
                {c.name}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Account">
            <FooterLink href="/register?role=buyer">Sell to buyers</FooterLink>
            <FooterLink href="/register?role=supplier">List your mill</FooterLink>
            <FooterLink href="/login">Sign in</FooterLink>
            <FooterLink href="/dashboard">Dashboard</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/15 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-white/50">
            © {new Date().getFullYear()} Threadwyn. A prototype built for the Marketplace Hackathon.
          </p>
          <p className="font-mono text-[11px] text-white/45">
            Payments, escrow and logistics are intentionally out of scope.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-4 text-white/45">{title}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[13.5px] text-white/75 transition-colors duration-200 hover:text-white"
      >
        {children}
      </Link>
    </li>
  );
}
