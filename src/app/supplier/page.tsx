import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle,
  Package,
  Plus,
  Stack,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { requireSupplierPage } from "@/lib/auth/guards";
import { getSupplierMetrics, STATUS_LABELS, STATUS_TONES } from "@/server/services/order-service";
import { serialize } from "@/lib/serialize";
import { formatDate, formatMetres, formatMoney, formatNumber, pluralise } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendChart } from "@/components/supplier/trend-chart";

export const metadata: Metadata = { title: "Supplier overview" };

export default async function SupplierDashboard() {
  const { profile } = await requireSupplierPage();
  const metrics = serialize(await getSupplierMetrics(profile.id));

  const needsAttention = metrics.pending > 0 || metrics.outOfStock > 0 || metrics.lowStock.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Overview</p>
          <h1 className="font-display mt-2.5 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink">
            {profile.businessName}
          </h1>
        </div>
        <ButtonLink href="/supplier/products/new" icon={<Plus size={15} weight="bold" />}>
          Add a fabric
        </ButtonLink>
      </header>

      {/* The one line that says whether anything needs doing today. */}
      <div
        className={`mt-7 flex items-start gap-3 rounded-[var(--radius-md)] border p-4 ${
          needsAttention ? "border-warn-line bg-warn-soft" : "border-positive-line bg-positive-soft"
        }`}
      >
        {needsAttention ? (
          <WarningCircle size={17} weight="fill" className="mt-px shrink-0 text-warn" />
        ) : (
          <CheckCircle size={17} weight="fill" className="mt-px shrink-0 text-positive" />
        )}
        <p className={`text-[13px] leading-relaxed ${needsAttention ? "text-warn" : "text-positive"}`}>
          {needsAttention ? (
            <>
              {metrics.pending > 0
                ? `${metrics.pending} ${pluralise(metrics.pending, "order")} waiting on your confirmation. `
                : ""}
              {metrics.lowStock.length > 0
                ? `${metrics.lowStock.length} ${pluralise(metrics.lowStock.length, "fabric is", "fabrics are")} running low. `
                : ""}
              {metrics.outOfStock > 0
                ? `${metrics.outOfStock} ${pluralise(metrics.outOfStock, "listing is", "listings are")} out of stock.`
                : ""}
            </>
          ) : (
            "Everything's up to date — no pending orders and no inventory alerts."
          )}
        </p>
      </div>

      {/* ---------------------------------------------------------- metrics */}
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric
          label="Active listings"
          value={formatNumber(metrics.active)}
          hint={`${metrics.products} total`}
          href="/supplier/products"
          icon={<Stack size={16} weight="light" />}
        />
        <Metric
          label="Pending orders"
          value={formatNumber(metrics.pending)}
          hint={metrics.pending > 0 ? "Awaiting your confirmation" : "Nothing waiting"}
          href="/supplier/orders?status=PENDING"
          tone={metrics.pending > 0 ? "warn" : undefined}
          icon={<Package size={16} weight="light" />}
        />
        <Metric
          label="In production"
          value={formatNumber(metrics.inFlight)}
          hint="Accepted through to dispatch"
          href="/supplier/orders"
          icon={<ArrowUpRight size={16} weight="light" />}
        />
        <Metric
          label="Order value"
          value={formatMoney(metrics.revenue, { compact: true })}
          hint={`${metrics.completed} completed`}
          icon={<CheckCircle size={16} weight="light" />}
        />
      </dl>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <TrendChart data={metrics.trend} title="Order value, last 12 weeks" />

        {/* ------------------------------------------------ inventory alerts */}
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">Inventory alerts</h2>
            <Link
              href="/supplier/products"
              className="text-[12px] text-brand-ink underline underline-offset-4 hover:text-brand-hover"
            >
              Manage
            </Link>
          </div>

          {metrics.lowStock.length === 0 && metrics.outOfStock === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle size={26} weight="light" className="mx-auto text-positive" />
              <p className="mt-3 text-[13px] font-medium text-ink">Stock levels are healthy</p>
              <p className="mt-1 text-[12px] leading-relaxed text-subtle">
                We&apos;ll flag anything that drops below 500m here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {metrics.outOfStock > 0 ? (
                <li className="px-5 py-3.5">
                  <Link
                    href="/supplier/products?status=OUT_OF_STOCK"
                    className="flex items-center gap-2.5 text-[13px] text-danger transition-opacity hover:opacity-80"
                  >
                    <StatusDot tone="danger" />
                    <span className="flex-1">
                      {metrics.outOfStock} {pluralise(metrics.outOfStock, "listing")} out of stock
                    </span>
                    <ArrowRight size={12} weight="bold" />
                  </Link>
                </li>
              ) : null}

              {metrics.lowStock.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/supplier/products/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-sunken"
                  >
                    <StatusDot tone="warn" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-ink">{p.name}</span>
                      <span className="block font-mono text-[11px] text-subtle tnum">
                        {formatMetres(p.stockMetres)} left · MOQ {p.moqMetres}m
                      </span>
                    </span>
                    <ArrowRight size={12} weight="bold" className="shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ----------------------------------------------------- recent orders */}
      <section className="mt-6 overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Recent orders</h2>
          <Link
            href="/supplier/orders"
            className="text-[12px] text-brand-ink underline underline-offset-4 hover:text-brand-hover"
          >
            All orders
          </Link>
        </div>

        {metrics.recent.length === 0 ? (
          <EmptyState
            mood="empty"
            className="py-12"
            title="No orders yet"
            description="When a buyer orders your cloth, it lands here first as Pending — you accept it, then walk it through to dispatch."
            action={
              <ButtonLink href="/supplier/products/new" variant="secondary">
                Add a fabric to the catalogue
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {metrics.recent.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/supplier/orders/${o.reference}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-sunken sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] font-medium text-ink tnum">{o.reference}</span>
                      <Badge tone={STATUS_TONES[o.status]} icon={<StatusDot tone={STATUS_TONES[o.status]} />}>
                        {STATUS_LABELS[o.status]}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-[12.5px] text-subtle">
                      {o.order.shippingName}
                      {o.order.shippingCity ? ` · ${o.order.shippingCity}` : ""} ·{" "}
                      {formatDate(o.order.placedAt)}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">
                      {o.items.map((i) => `${i.productName} (${i.quantityMetres}m)`).join(", ")}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-[14px] font-medium text-ink tnum">
                    {formatMoney(o.subtotal)}
                  </p>
                  <ArrowRight size={13} weight="bold" className="hidden shrink-0 text-subtle sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  icon,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  href?: string;
  tone?: "warn";
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <dt className="eyebrow text-subtle">{label}</dt>
        <span className={`shrink-0 ${tone === "warn" ? "text-warn" : "text-subtle"}`}>{icon}</span>
      </div>
      <dd className="font-mono mt-3.5 text-2xl leading-none font-medium text-ink tnum">{value}</dd>
      <p className={`mt-2 text-[11.5px] ${tone === "warn" ? "text-warn" : "text-subtle"}`}>{hint}</p>
    </>
  );

  const classes = `rounded-[var(--radius-lg)] border bg-surface p-4 sm:p-5 transition-[border-color,transform] duration-400 ease-[var(--ease-out-expo)] ${
    tone === "warn" ? "border-warn-line" : "border-line"
  }`;

  return href ? (
    <Link href={href} className={`${classes} block hover:-translate-y-0.5 hover:border-line-strong`}>
      {inner}
    </Link>
  ) : (
    <div className={classes}>{inner}</div>
  );
}
