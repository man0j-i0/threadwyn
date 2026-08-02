import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Note, User } from "@phosphor-icons/react/dist/ssr";

import { requireSupplierPage, HttpError } from "@/lib/auth/guards";
import { getSupplierOrder } from "@/server/services/order-service";
import { STATUS_LABELS, STATUS_TONES } from "@/lib/order-status";
import { serialize } from "@/lib/serialize";
import { formatDate, formatMetres, formatMoney, pluralise } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { OrderActions } from "@/components/supplier/order-actions";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import type { WeaveKey } from "@/lib/weave";

export const metadata: Metadata = { title: "Order detail" };

type PageProps = { params: Promise<{ reference: string }> };

export default async function SupplierOrderPage({ params }: PageProps) {
  const { profile } = await requireSupplierPage();
  const { reference } = await params;

  let order;
  try {
    order = await getSupplierOrder(profile.id, decodeURIComponent(reference));
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }

  const data = serialize(order);
  const metres = order.items.reduce((sum, i) => sum + i.quantityMetres, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/supplier/orders"
        className="inline-flex items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-ink"
      >
        <ArrowLeft size={12} weight="bold" />
        All orders
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-7">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display font-mono text-2xl font-medium text-ink tnum sm:text-3xl">
              {order.reference}
            </h1>
            <Badge tone={STATUS_TONES[order.status]} icon={<StatusDot tone={STATUS_TONES[order.status]} />}>
              {STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="mt-2.5 text-[13px] text-subtle">
            Part of order{" "}
            <span className="font-mono text-muted tnum">{order.order.orderNumber}</span> · placed{" "}
            {formatDate(data.order.placedAt)} · {order.items.length}{" "}
            {pluralise(order.items.length, "line")} · {formatMetres(metres)}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow text-subtle">Your subtotal</p>
          <p className="mt-1.5 font-mono text-2xl font-medium text-ink tnum">{formatMoney(data.subtotal)}</p>
        </div>
      </header>

      {/* ------------------------------------------------------------ actions */}
      <section className="mt-7 rounded-[var(--radius-xl)] border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-ink">Move this order along</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-subtle">
          Only the next valid step is offered — the same rule is enforced server-side, so an order can never
          skip a stage or move backwards.
        </p>
        <div className="mt-5">
          <OrderActions
            reference={order.reference}
            status={order.status}
            expectedReadyAt={data.expectedReadyAt}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* ------------------------------------------------------------ lines */}
        <section className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-4 text-[15px] font-semibold text-ink">
            What to cut
          </h2>
          <ul className="divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                <span className="size-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-line">
                  <FabricSwatch
                    weave={item.weave as WeaveKey}
                    hex={item.colorwayHex ?? "#C9C2B4"}
                    gsm={item.gsm}
                    seed={item.id}
                    alt=""
                    drape={false}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">{item.productName}</p>
                  <p className="mt-0.5 truncate font-mono text-[11.5px] text-subtle">
                    {item.composition} · {item.gsm} gsm · {item.widthCm} cm
                    {item.colorwayName ? ` · ${item.colorwayName}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-[12.5px] font-medium text-brand-ink tnum">
                    Cut {formatMetres(item.quantityMetres)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] text-subtle tnum">
                    {formatMoney(Number(item.unitPrice))}/m
                  </p>
                  <p className="mt-0.5 font-mono text-[14px] font-medium text-ink tnum">
                    {formatMoney(Number(item.lineTotal))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------------------------------------- buyer */}
        <aside className="space-y-5">
          <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <User size={14} weight="light" className="text-subtle" />
              Buyer
            </h2>
            <p className="mt-3 text-[13px] font-medium text-ink">
              {order.order.shippingCompany || order.order.buyer.name}
            </p>
            <p className="mt-0.5 text-[12.5px] text-subtle">{order.order.buyer.name}</p>
            <p className="mt-2 font-mono text-[11.5px] break-all text-muted">
              {order.order.shippingEmail}
              <br />
              {order.order.shippingPhone}
            </p>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <MapPin size={14} weight="light" className="text-subtle" />
              Ship to
            </h2>
            <address className="mt-3 text-[12.5px] leading-relaxed text-muted not-italic">
              {order.order.shippingLine1}
              <br />
              {order.order.shippingLine2 ? (
                <>
                  {order.order.shippingLine2}
                  <br />
                </>
              ) : null}
              {order.order.shippingCity}, {order.order.shippingState}
              <br />
              {order.order.shippingPostalCode}, {order.order.shippingCountry}
            </address>
          </section>

          {order.order.deliveryNotes ? (
            <section className="rounded-[var(--radius-lg)] border border-accent-line bg-accent-soft p-5">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-accent">
                <Note size={14} weight="light" />
                Buyer&apos;s note
              </h2>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-accent">{order.order.deliveryNotes}</p>
            </section>
          ) : null}

          <section className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
            <h2 className="text-[14px] font-semibold text-ink">History</h2>
            <div className="mt-4">
              <StatusTimeline status={order.status} events={data.events} compact />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
