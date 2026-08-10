import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, MapPin, Printer } from "@phosphor-icons/react/dist/ssr";

import { requireBuyerPage, HttpError } from "@/lib/auth/guards";
import { getBuyerOrder } from "@/server/services/order-service";
import { rollupStatus, STATUS_LABELS, STATUS_TONES } from "@/lib/order-status";
import { serialize } from "@/lib/serialize";
import { formatDate, formatDateTime, formatMetres, formatMoney, pluralise } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { WeaverMark } from "@/components/brand/weaver-mark";
import type { WeaveKey } from "@/lib/weave";

export const metadata: Metadata = { title: "Order" };

type PageProps = {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ placed?: string }>;
};

export default async function OrderPage({ params, searchParams }: PageProps) {
  const session = await requireBuyerPage();
  const { number } = await params;
  const { placed } = await searchParams;

  let order;
  try {
    order = await getBuyerOrder(session.sub, number);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }

  const data = serialize(order);
  const overall = rollupStatus(order.supplierOrders.map((s) => s.status));
  const justPlaced = placed === "1";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      {justPlaced ? (
        <div className="mb-9 rounded-[var(--radius-xl)] border border-positive-line bg-positive-soft p-6 text-center sm:p-9">
          <WeaverMark mood="done" className="mx-auto size-24" />
          <h1 className="font-display mt-5 text-2xl font-medium text-balance text-ink sm:text-3xl">
            Order placed — {order.supplierOrders.length}{" "}
            {pluralise(order.supplierOrders.length, "mill has", "mills have")} been notified
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-pretty text-muted">
            Each mill confirms its own half of the order. You&apos;ll see every stage below as it happens — no
            payment was taken, and nothing is committed until a mill accepts.
          </p>
          <p className="mt-4 font-mono text-[13px] text-positive tnum">{order.orderNumber}</p>
        </div>
      ) : (
        <Link
          href="/orders"
          className="mb-7 inline-flex items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-ink"
        >
          <ArrowLeft size={12} weight="bold" />
          All orders
        </Link>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-7">
        <div>
          {!justPlaced ? (
            <>
              <p className="eyebrow text-accent">Order</p>
              <h1 className="font-display mt-2.5 font-mono text-2xl font-medium text-ink tnum sm:text-3xl">
                {order.orderNumber}
              </h1>
            </>
          ) : (
            <p className="eyebrow text-subtle">Placed {formatDate(data.placedAt)}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Badge tone={STATUS_TONES[overall]} icon={<StatusDot tone={STATUS_TONES[overall]} />}>
              {STATUS_LABELS[overall]}
            </Badge>
            <span className="text-[12.5px] text-subtle">
              Placed {formatDate(data.placedAt)} · {order.supplierOrders.length}{" "}
              {pluralise(order.supplierOrders.length, "mill")}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="eyebrow text-subtle">Order total</p>
          <p className="mt-1.5 font-mono text-2xl font-medium text-ink tnum">{formatMoney(data.total)}</p>
        </div>
      </header>

      {/* One block per mill: its own status, its own timeline, its own lines. */}
      <div className="mt-9 space-y-6">
        {data.supplierOrders.map((sub) => (
          <section key={sub.id} className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-canvas-veil px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/marketplace?supplier=${sub.supplier.slug}`}
                    className="text-[14px] font-medium text-ink transition-colors hover:text-brand-ink"
                  >
                    {sub.supplier.businessName}
                  </Link>
                  <Badge tone={STATUS_TONES[sub.status]} icon={<StatusDot tone={STATUS_TONES[sub.status]} />}>
                    {STATUS_LABELS[sub.status]}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-[11.5px] text-subtle tnum">
                  {sub.reference} · {sub.supplier.city}
                  {sub.expectedReadyAt ? ` · ready ~${formatDate(sub.expectedReadyAt)}` : ""}
                </p>
              </div>
              <p className="font-mono text-[15px] font-medium text-ink tnum">{formatMoney(sub.subtotal)}</p>
            </header>

            <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_15rem] sm:gap-8">
              <ul className="space-y-3.5">
                {sub.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3.5">
                    <Link
                      href={`/product/${item.productSlug}`}
                      className="size-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-line"
                    >
                      <FabricSwatch
                        weave={item.weave as WeaveKey}
                        hex={item.colorwayHex ?? "#C9C2B4"}
                        gsm={item.gsm}
                        seed={item.id}
                        alt=""
                        drape={false}
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/product/${item.productSlug}`}
                        className="block truncate text-[13.5px] font-medium text-ink transition-colors hover:text-brand-ink"
                      >
                        {item.productName}
                      </Link>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-subtle tnum">
                        {formatMetres(item.quantityMetres)} × {formatMoney(item.unitPrice)}/m
                        {item.colorwayName ? ` · ${item.colorwayName}` : ""}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10.5px] text-subtle">
                        {item.composition} · {item.gsm} gsm · {item.widthCm} cm
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-[13.5px] font-medium text-ink tnum">
                      {formatMoney(item.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="border-t border-line pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
                <p className="eyebrow mb-4 text-subtle">Progress</p>
                <StatusTimeline status={sub.status} events={sub.events} compact />
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* ------------------------------------------------------------ totals */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <MapPin size={15} weight="light" className="text-subtle" />
            Delivering to
          </h2>
          <address className="mt-3.5 text-[13px] leading-relaxed text-muted not-italic">
            <span className="block font-medium text-ink">{order.shippingName}</span>
            {order.shippingCompany ? <span className="block">{order.shippingCompany}</span> : null}
            <span className="block">{order.shippingLine1}</span>
            {order.shippingLine2 ? <span className="block">{order.shippingLine2}</span> : null}
            <span className="block">
              {order.shippingCity}, {order.shippingState} {order.shippingPostalCode}
            </span>
            <span className="mt-2 block font-mono text-[11.5px] text-subtle">
              {order.shippingPhone} · {order.shippingEmail}
            </span>
          </address>
          {order.deliveryNotes ? (
            <p className="mt-3 rounded-[var(--radius-sm)] bg-canvas-veil px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
              {order.deliveryNotes}
            </p>
          ) : null}
        </section>

        <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
          <h2 className="text-[14px] font-semibold text-ink">Totals</h2>
          <dl className="mt-3.5 space-y-2.5">
            <Row label="Subtotal" value={formatMoney(data.subtotal)} />
            <Row label="Shipping" value={data.shippingFee === 0 ? "Free" : formatMoney(data.shippingFee)} />
            <Row label="Duties & handling" value={formatMoney(data.tax)} />
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
              <dt className="text-[13.5px] font-medium text-ink">Total</dt>
              <dd className="font-mono text-[17px] font-medium text-ink tnum">{formatMoney(data.total)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[11.5px] leading-relaxed text-subtle">
            No payment was collected. Settlement is arranged directly with each mill — payments and escrow are
            outside this prototype&apos;s scope.
          </p>
        </section>
      </div>

      <div className="mt-9 flex flex-wrap items-center gap-3" data-print-hide>
        <ButtonLink href="/orders" variant="secondary">
          All orders
        </ButtonLink>
        <ButtonLink href="/marketplace" variant="ghost">
          Continue sourcing
        </ButtonLink>
        <p className="ml-auto hidden items-center gap-1.5 font-mono text-[11px] text-subtle sm:flex">
          <Printer size={12} weight="light" />
          Print-friendly
        </p>
      </div>

      {order.supplierOrders.some((s) => s.status === "COMPLETED") ? (
        <p className="mt-6 flex items-center justify-center gap-2 text-[12.5px] text-positive">
          <CheckCircle size={14} weight="fill" />
          Last updated {formatDateTime(data.supplierOrders[0]!.updatedAt)}
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="font-mono text-[13px] text-ink tnum">{value}</dd>
    </div>
  );
}
