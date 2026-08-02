import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Certificate, MapPin, Star } from "@phosphor-icons/react/dist/ssr";

import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { formatMetres, formatMoney, pluralise, titleCase } from "@/lib/utils";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { AssistantDock } from "@/components/ai/assistant-dock";
import type { WeaveKey } from "@/lib/weave";

export const metadata: Metadata = {
  title: "Suppliers",
  description: "The verified Indian mills, handloom collectives and stockists supplying Threadwyn.",
};

export const revalidate = 120;

export default async function SuppliersPage() {
  const suppliers = await db.supplierProfile.findMany({
    orderBy: [{ verified: "desc" }, { rating: "desc" }],
    include: {
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
      products: {
        where: { status: "ACTIVE" },
        orderBy: { viewCount: "desc" },
        take: 4,
        select: {
          id: true,
          slug: true,
          name: true,
          weave: true,
          gsm: true,
          pricePerMetre: true,
          stockMetres: true,
          colorways: { select: { hex: true }, orderBy: { position: "asc" }, take: 1 },
        },
      },
    },
  });

  const data = serialize(suppliers);

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <Reveal>
          <SectionHeading
            eyebrow="Who you're buying from"
            title="The mills behind the catalogue"
            description="Every supplier here is a real operation with a real address and real operating hours. Verified means we've confirmed the business exists and the certifications it lists are on file."
          />
        </Reveal>

        <Stagger stagger={0.05} className="mt-12 space-y-5">
          {data.map((s) => (
            <StaggerItem key={s.id}>
              <article className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface transition-[border-color,box-shadow] duration-400 ease-[var(--ease-out-expo)] hover:border-line-strong hover:shadow-[var(--shadow-md)]">
                <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="font-display text-xl leading-snug font-medium text-ink sm:text-2xl">
                        <Link
                          href={`/marketplace?supplier=${s.slug}`}
                          className="transition-colors hover:text-brand-ink"
                        >
                          {s.businessName}
                        </Link>
                      </h2>
                      {s.verified ? <Badge tone="brass">Verified</Badge> : null}
                      <Badge tone="neutral">{titleCase(s.businessType)}</Badge>
                    </div>

                    {s.tagline ? (
                      <p className="mt-2 text-[14px] text-muted italic">{s.tagline}</p>
                    ) : null}

                    <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-subtle">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={12} weight="light" />
                        {s.city}, {s.state}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-mono tnum">
                        <Star size={11} weight="fill" className="text-brass" />
                        {s.rating.toFixed(1)} ({s.ratingCount})
                      </span>
                      {s.yearEstablished ? (
                        <span className="font-mono tnum">est. {s.yearEstablished}</span>
                      ) : null}
                      <span className="font-mono tnum">
                        MOQ {s.moqMetres}m · {s.leadTimeDays}d lead
                      </span>
                    </div>

                    {s.description ? (
                      <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted">
                        {s.description}
                      </p>
                    ) : null}

                    {s.certifications.length ? (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {s.certifications.map((c) => (
                          <Badge key={c} tone="neutral" icon={<Certificate size={10} weight="light" />}>
                            {c}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <Link
                      href={`/marketplace?supplier=${s.slug}`}
                      className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink underline underline-offset-4 transition-colors hover:text-brand-hover"
                    >
                      {s._count.products} {pluralise(s._count.products, "fabric")} from this mill
                      <ArrowRight size={11} weight="bold" />
                    </Link>
                  </div>

                  {/* A strip of what they actually make — more useful than a logo. */}
                  {s.products.length ? (
                    <div className="grid grid-cols-4 gap-2 lg:grid-cols-2 xl:grid-cols-4">
                      {s.products.map((p) => (
                        <Link
                          key={p.id}
                          href={`/product/${p.slug}`}
                          title={`${p.name} — ${formatMoney(p.pricePerMetre)}/m, ${formatMetres(p.stockMetres)}`}
                          className="group/sw block overflow-hidden rounded-[var(--radius-sm)] border border-line"
                        >
                          <span className="block aspect-square overflow-hidden">
                            <span className="block size-full transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/sw:scale-105">
                              <FabricSwatch
                                weave={p.weave as WeaveKey}
                                hex={p.colorways[0]?.hex ?? "#C9C2B4"}
                                gsm={p.gsm}
                                seed={p.id}
                                alt={`${p.name} swatch`}
                              />
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="self-center text-[13px] text-subtle">
                      No live listings from this mill right now.
                    </p>
                  )}
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <AssistantDock />
    </>
  );
}
