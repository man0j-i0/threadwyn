import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { requireBuyerPage } from "@/lib/auth/guards";
import { getBuyerOrders, rollupStatus, STATUS_LABELS, STATUS_TONES } from "@/server/services/order-service";
import { serialize } from "@/lib/serialize";
import { formatDate, formatMetres, formatMoney, pluralise } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import type { WeaveKey } from "@/lib/weave";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  const session = await requireBuyerPage("/orders");
  const orders = serialize(await getBuyerOrders(session.sub));

  const live = orders.filter((o) => {
    const s = rollupStatus(o.supplierOrders.map((x) => x.status));
    return s !== "COMPLETED" && s !== "CANCELLED";
  });
  const past = orders.filter((o) => !live.includes(o));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-9">
        <p className="eyebrow text-accent">Purchase history</p>
        <h1 className="font-display mt-3 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink sm:text-[2.5rem]">
          My orders
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          A basket that spans several mills becomes several orders — one per mill, each tracked separately, so
          a hold-up at one never hides progress at another.
        </p>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          mood="empty"
          className="rounded-[var(--radius-xl)] border border-line bg-surface"
          title="No orders yet"
          description="Once you place an order, every mill's half of it shows up here with its own status ladder and event history."
          action={
            <ButtonLink href="/marketplace" trailingIcon={<ArrowRight size={13} weight="bold" />}>
              Browse fabrics
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-10">
          {live.length > 0 ? (
            <Section title="In progress" count={live.length}>
              {live.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </Section>
          ) : null}

          {past.length > 0 ? (
            <Section title="Completed" count={past.length}>
              {past.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 flex items-baseline gap-2.5 text-[14px] font-semibold text-ink">
        {title}
        <span className="font-mono text-[11px] font-normal text-subtle tnum">{count}</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

type Order = ReturnType<typeof serialize<Awaited<ReturnType<typeof getBuyerOrders>>>>[number];

function OrderRow({ order }: { order: Order }) {
  const overall = rollupStatus(order.supplierOrders.map((s) => s.status));
  const items = order.supplierOrders.flatMap((s) => s.items);
  const totalMetres = items.reduce((sum, i) => sum + i.quantityMetres, 0);

  return (
    <Link
      href={`/orders/${order.orderNumber}`}
      className="group flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-4 transition-[border-color,box-shadow,transform] duration-400 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-md)] sm:flex-row sm:items-center sm:p-5"
    >
      {/* Stacked swatches — a visual fingerprint for the order at a glance. */}
      <div className="flex shrink-0 -space-x-3">
        {items.slice(0, 4).map((item, i) => (
          <span
            key={item.id}
            style={{ zIndex: 4 - i }}
            className="size-12 overflow-hidden rounded-[var(--radius-sm)] border-2 border-surface ring-1 ring-line"
          >
            <FabricSwatch
              weave={item.weave as WeaveKey}
              hex={item.colorwayHex ?? "#C9C2B4"}
              gsm={item.gsm}
              seed={item.id}
              alt=""
              drape={false}
            />
          </span>
        ))}
        {items.length > 4 ? (
          <span className="grid size-12 place-items-center rounded-[var(--radius-sm)] border-2 border-surface bg-canvas-veil font-mono text-[11px] text-muted ring-1 ring-line">
            +{items.length - 4}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="font-mono text-[13.5px] font-medium text-ink tnum">{order.orderNumber}</p>
          <Badge tone={STATUS_TONES[overall]} icon={<StatusDot tone={STATUS_TONES[overall]} />}>
            {STATUS_LABELS[overall]}
          </Badge>
        </div>
        <p className="mt-1.5 text-[12.5px] text-subtle">
          {formatDate(order.placedAt)} · {order.supplierOrders.length}{" "}
          {pluralise(order.supplierOrders.length, "mill")} · {items.length}{" "}
          {pluralise(items.length, "line")} · {formatMetres(totalMetres)}
        </p>
        <p className="mt-1 truncate text-[12.5px] text-muted">
          {order.supplierOrders.map((s) => s.supplier.businessName).join(", ")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <p className="font-mono text-[16px] font-medium text-ink tnum">{formatMoney(order.total)}</p>
        <ArrowRight
          size={14}
          weight="bold"
          className="shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
