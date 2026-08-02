import Link from "next/link";

import { db } from "@/lib/db";
import { LogoGlyph } from "@/components/brand/logo";

export async function SiteFooter() {
  const categories = await db.category.findMany({
    orderBy: { position: "asc" },
    select: { name: true, slug: true },
    take: 8,
  });

  return (
    <footer className="mt-24 border-t border-line bg-canvas-veil">
      <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <LogoGlyph className="size-8" />
              <span className="font-display text-[19px] font-medium tracking-[-0.02em] text-ink">
                Threadwyn
              </span>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-muted">
              A B2B textile marketplace built around one question: can a buyer decide on a fabric without
              opening twelve tabs?
            </p>
            <p className="mt-5 font-mono text-[11px] tracking-wide text-subtle">
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

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-subtle">
            © {new Date().getFullYear()} Threadwyn. A prototype built for the Marketplace Hackathon.
          </p>
          <p className="font-mono text-[11px] text-subtle">
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
      <h3 className="eyebrow mb-4 text-subtle">{title}</h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[13.5px] text-muted transition-colors duration-200 hover:text-ink"
      >
        {children}
      </Link>
    </li>
  );
}
