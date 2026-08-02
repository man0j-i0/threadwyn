import type { Metadata } from "next";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import { requireSupplierPage } from "@/lib/auth/guards";
import { getSupplierOrders, STATUS_LABELS, STATUS_TONES } from "@/server/services/order-service";
import { serialize } from "@/lib/serialize";
import { cn, formatDate, formatMetres, formatMoney, formatRelative, pluralise } from "@/lib/utils";
import { Badge, StatusDot } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Orders" };

const TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY_FOR_DISPATCH", label: "Ready" },
  { value: "COMPLETED", label: "Completed" },
];

type PageProps = { searchParams: Promise<{ status?: string }> };

export default async function SupplierOrdersPage({ searchParams }: PageProps) {
  const { profile } = await requireSupplierPage();
  const { status } = await searchParams;

  const orders = serialize(
    await getSupplierOrders(profile.id, status ? (status as OrderStatus) : undefined),
  );

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header>
        <p className="eyebrow text-accent">Fulfilment</p>
        <h1 className="font-display mt-2.5 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink">
          Orders
        </h1>
        <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-muted">
          You only ever see your own half of a buyer&apos;s basket. Move each order along the ladder —
          Pending → Accepted → Preparing → Ready → Completed — and the buyer sees every step live.
        </p>
      </header>

      <nav aria-label="Filter by status" className="mt-7 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = (status ?? "") === tab.value;
          return (
            <Link
              key={tab.value || "all"}
              href={tab.value ? `/supplier/orders?status=${tab.value}` : "/supplier/orders"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[12.5px] transition-colors duration-200",
                active
                  ? "border-brand bg-brand-soft font-medium text-brand-ink"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {tab.label}
              {tab.value === "PENDING" && pendingCount > 0 && !active ? (
                <span className="grid min-w-4.5 place-items-center rounded-full bg-accent px-1 font-mono text-[9.5px] text-white">
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        {orders.length === 0 ? (
          <EmptyState
            mood="empty"
            className="rounded-[var(--radius-xl)] border border-line bg-surface"
            title={status ? "Nothing at this stage" : "No orders yet"}
            description={
              status
                ? "No orders are sitting at this status right now."
                : "When a buyer orders your cloth it arrives here as Pending. Accepting it confirms the stock; from there you walk it through to dispatch."
            }
            action={
              status ? (
                <ButtonLink href="/supplier/orders" variant="secondary">
                  Show all orders
                </ButtonLink>
              ) : (
                <ButtonLink href="/supplier/products/new">Add a fabric</ButtonLink>
              )
            }
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const metres = o.items.reduce((sum, i) => sum + i.quantityMetres, 0);
              return (
                <li key={o.id}>
                  <Link
                    href={`/supplier/orders/${o.reference}`}
                    className={cn(
                      "group flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border bg-surface p-4 sm:flex-nowrap sm:p-5",
                      "transition-[border-color,box-shadow,transform] duration-400 ease-[var(--ease-out-expo)]",
                      "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
                      o.status === "PENDING" ? "border-warn-line" : "border-line hover:border-line-strong",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13.5px] font-medium text-ink tnum">{o.reference}</span>
                        <Badge tone={STATUS_TONES[o.status]} icon={<StatusDot tone={STATUS_TONES[o.status]} />}>
                          {STATUS_LABELS[o.status]}
                        </Badge>
                        {o.status === "PENDING" ? (
                          <span className="font-mono text-[10.5px] text-warn">
                            waiting {formatRelative(o.createdAt)}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1.5 truncate text-[12.5px] text-subtle">
                        {o.order.shippingCompany || o.order.shippingName} · {o.order.shippingCity},{" "}
                        {o.order.shippingState} · {formatDate(o.order.placedAt)}
                      </p>

                      <p className="mt-1 truncate text-[12.5px] text-muted">
                        {o.items.length} {pluralise(o.items.length, "line")} · {formatMetres(metres)} ·{" "}
                        {o.items.map((i) => i.productName).join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="font-mono text-[15px] font-medium text-ink tnum">{formatMoney(o.subtotal)}</p>
                      <ArrowRight
                        size={13}
                        weight="bold"
                        className="shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-0.5"
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
