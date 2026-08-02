import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Handbag, Package, PencilSimple, Sparkle, TrendUp } from "@phosphor-icons/react/dist/ssr";

import { requireBuyerPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getBuyerOrders } from "@/server/services/order-service";
import { rollupStatus, STATUS_LABELS, STATUS_TONES } from "@/lib/order-status";
import { searchProducts } from "@/server/services/product-service";
import { serialize } from "@/lib/serialize";
import { formatDate, formatMoney, formatNumber, titleCase } from "@/lib/utils";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/card";
import { AssistantDock } from "@/components/ai/assistant-dock";

export const metadata: Metadata = { title: "Dashboard" };

export default async function BuyerDashboard() {
  const session = await requireBuyerPage("/dashboard");

  const [profile, orders, cart] = await Promise.all([
    db.buyerProfile.findUnique({ where: { userId: session.sub } }),
    getBuyerOrders(session.sub),
    db.cart.findUnique({
      where: { buyerId: session.sub },
      select: { _count: { select: { items: true } } },
    }),
  ]);

  // Recommendations come straight from the onboarding profile — the reason
  // onboarding asked those questions in the first place.
  const recommended = await searchProducts({
    category: profile?.categoryInterest?.length ? profile.categoryInterest : undefined,
    fibre: profile?.preferredFabrics?.length ? profile.preferredFabrics : undefined,
    priceMax: profile?.budgetMax ?? undefined,
    priceMin: profile?.budgetMin ?? undefined,
    inStock: true,
    perPage: 4,
    sort: "popular",
  });

  const data = serialize(orders);
  const live = data.filter((o) => {
    const s = rollupStatus(o.supplierOrders.map((x) => x.status));
    return s !== "COMPLETED" && s !== "CANCELLED";
  });

  const spend = data.reduce((sum, o) => sum + o.total, 0);
  const metres = data
    .flatMap((o) => o.supplierOrders.flatMap((s) => s.items))
    .reduce((sum, i) => sum + i.quantityMetres, 0);

  const cards = serialize(recommended.items) as unknown as ProductCardData[];

  return (
    <>
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow text-accent">
              {profile?.businessName ?? "Your account"}
            </p>
            <h1 className="font-display mt-3 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
              Welcome back, {session.name.split(" ")[0]}
            </h1>
          </div>
          <ButtonLink href="/marketplace" trailingIcon={<ArrowRight size={13} weight="bold" />}>
            Source fabric
          </ButtonLink>
        </header>

        {/* -------------------------------------------------------- metrics */}
        <dl className="mt-9 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Metric
            label="Orders placed"
            value={formatNumber(data.length)}
            hint={`${live.length} in progress`}
            icon={<Package size={16} weight="light" />}
          />
          <Metric
            label="Total committed"
            value={formatMoney(spend, { compact: true })}
            hint="Across every mill"
            icon={<TrendUp size={16} weight="light" />}
          />
          <Metric
            label="Metres ordered"
            value={formatNumber(metres)}
            hint="Lifetime"
            icon={<Sparkle size={16} weight="light" />}
          />
          <Metric
            label="In your cart"
            value={formatNumber(cart?._count.items ?? 0)}
            hint={cart?._count.items ? "Ready to check out" : "Nothing yet"}
            icon={<Handbag size={16} weight="light" />}
            href="/cart"
          />
        </dl>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
          {/* ---------------------------------------------------- live orders */}
          <section>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">Orders in progress</h2>
              <Link
                href="/orders"
                className="text-[12.5px] text-brand-ink underline underline-offset-4 transition-colors hover:text-brand-hover"
              >
                All orders
              </Link>
            </div>

            {live.length === 0 ? (
              <EmptyState
                mood="empty"
                className="rounded-[var(--radius-xl)] border border-line bg-surface py-12"
                title="Nothing in flight"
                description="When you place an order, each mill's half appears here with its live status until it's dispatched."
                action={
                  <ButtonLink href="/marketplace" variant="secondary">
                    Browse fabrics
                  </ButtonLink>
                }
              />
            ) : (
              <div className="space-y-3">
                {live.slice(0, 4).map((order) => {
                  const overall = rollupStatus(order.supplierOrders.map((s) => s.status));
                  return (
                    <Link
                      key={order.id}
                      href={`/orders/${order.orderNumber}`}
                      className="group flex items-center gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-4 transition-[border-color,transform] duration-400 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-line-strong"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-[13px] font-medium text-ink tnum">{order.orderNumber}</p>
                          <Badge tone={STATUS_TONES[overall]} icon={<StatusDot tone={STATUS_TONES[overall]} />}>
                            {STATUS_LABELS[overall]}
                          </Badge>
                        </div>
                        <p className="mt-1.5 truncate text-[12.5px] text-subtle">
                          {formatDate(order.placedAt)} ·{" "}
                          {order.supplierOrders.map((s) => s.supplier.businessName).join(", ")}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-[14px] font-medium text-ink tnum">
                        {formatMoney(order.total)}
                      </p>
                      <ArrowRight
                        size={13}
                        weight="bold"
                        className="shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-0.5"
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* ------------------------------------------------------- profile */}
          <aside>
            <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink">Sourcing profile</h2>
                <Link
                  href="/dashboard/profile"
                  aria-label="Edit profile"
                  className="-m-1.5 grid size-8 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
                >
                  <PencilSimple size={13} weight="light" />
                </Link>
              </div>

              {profile ? (
                <dl className="mt-4 space-y-3.5">
                  <Detail label="Business" value={profile.businessName} />
                  <Detail label="Type" value={titleCase(profile.businessType)} />
                  <Detail label="Industry" value={profile.industry} />
                  {profile.city ? <Detail label="Based in" value={profile.city} /> : null}
                  <Detail label="Typical order" value={titleCase(profile.typicalOrderQty.replace(/-/g, " to "))} />
                  {profile.budgetMin != null || profile.budgetMax != null ? (
                    <Detail
                      label="Budget per metre"
                      value={`${profile.budgetMin ? formatMoney(profile.budgetMin) : "any"} – ${
                        profile.budgetMax ? formatMoney(profile.budgetMax) : "any"
                      }`}
                    />
                  ) : null}

                  {profile.categoryInterest.length ? (
                    <div>
                      <dt className="eyebrow text-subtle">Categories</dt>
                      <dd className="mt-2 flex flex-wrap gap-1.5">
                        {profile.categoryInterest.map((c) => (
                          <Badge key={c} tone="brand">
                            {titleCase(c.replace(/-/g, " "))}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  ) : null}

                  {profile.preferredFabrics.length ? (
                    <div>
                      <dt className="eyebrow text-subtle">Preferred fibres</dt>
                      <dd className="mt-2 flex flex-wrap gap-1.5">
                        {profile.preferredFabrics.map((f) => (
                          <Badge key={f} tone="neutral">
                            {titleCase(f)}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  ) : null}

                  {profile.onboardingMode === "conversation" ? (
                    <p className="border-t border-line pt-3.5 text-[11.5px] leading-relaxed text-subtle">
                      Captured from your onboarding conversation. Everything here is editable.
                    </p>
                  ) : null}
                </dl>
              ) : (
                <p className="mt-3 text-[13px] leading-relaxed text-muted">
                  You haven&apos;t set up a sourcing profile yet.{" "}
                  <Link href="/onboarding" className="text-brand-ink underline underline-offset-4">
                    Take a minute to do it
                  </Link>{" "}
                  and recommendations get considerably better.
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* --------------------------------------------------- recommendations */}
        {cards.length > 0 ? (
          <section className="mt-14">
            <SectionHeading
              eyebrow="Matched to your profile"
              title="Worth a look"
              description={
                profile?.categoryInterest?.length
                  ? `Drawn from ${profile.categoryInterest.map((c) => titleCase(c.replace(/-/g, " "))).join(", ")}${
                      profile.budgetMax ? `, under ${formatMoney(profile.budgetMax)}/m` : ""
                    } — the preferences you set during onboarding.`
                  : "In stock and moving fast across the catalogue."
              }
              action={
                <ButtonLink href="/marketplace" variant="secondary" trailingIcon={<ArrowRight size={13} weight="bold" />}>
                  See all
                </ButtonLink>
              }
            />
            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {cards.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <AssistantDock />
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <dt className="eyebrow text-subtle">{label}</dt>
        <span className="shrink-0 text-subtle">{icon}</span>
      </div>
      <dd className="font-mono mt-3.5 text-2xl leading-none font-medium text-ink tnum">{value}</dd>
      <p className="mt-2 text-[11.5px] text-subtle">{hint}</p>
    </>
  );

  const classes =
    "rounded-[var(--radius-lg)] border border-line bg-surface p-4 sm:p-5 transition-[border-color,transform] duration-400 ease-[var(--ease-out-expo)]";

  if (href) {
    return (
      <Link href={href} className={`${classes} block hover:-translate-y-0.5 hover:border-line-strong`}>
        {inner}
      </Link>
    );
  }
  return <div className={classes}>{inner}</div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow text-subtle">{label}</dt>
      <dd className="mt-1 text-[13px] text-ink">{value}</dd>
    </div>
  );
}
