"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Certificate,
  Minus,
  Plus,
  Trash,
  Truck,
  WarningCircle,
} from "@phosphor-icons/react";

import { cn, formatMetres, formatMoney, formatNumber, pluralise } from "@/lib/utils";
import type { CartView as CartData } from "@/server/services/cart-service";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import type { WeaveKey } from "@/lib/weave";

type SerializedCart = Omit<CartData, "lines" | "groups"> & {
  lines: (Omit<CartData["lines"][number], "addedAt"> & { addedAt: string })[];
  groups: {
    supplier: CartData["groups"][number]["supplier"];
    subtotal: number;
    lines: (Omit<CartData["lines"][number], "addedAt"> & { addedAt: string })[];
  }[];
};

export function CartView({ cart: initial }: { cart: SerializedCart }) {
  const router = useRouter();
  const { toast } = useToast();
  const [cart, setCart] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function mutate(
    itemId: string,
    action: () => Promise<Response>,
    onSuccess?: (next: SerializedCart) => void,
  ) {
    setBusyId(itemId);
    try {
      const res = await action();
      const body = (await res.json()) as { data?: SerializedCart; error?: { message: string } };
      if (!res.ok || !body.data) throw new Error(body.error?.message ?? "Could not update your cart.");
      setCart(body.data);
      onSuccess?.(body.data);
      router.refresh();
    } catch (err) {
      toast({
        tone: "error",
        title: "Cart not updated",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  }

  function setQuantity(itemId: string, quantityMetres: number) {
    void mutate(itemId, () =>
      fetch(`/api/v1/cart/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantityMetres }),
      }),
    );
  }

  function remove(itemId: string, name: string) {
    void mutate(
      itemId,
      () => fetch(`/api/v1/cart/items/${itemId}`, { method: "DELETE" }),
      () => toast({ tone: "success", title: `${name} removed` }),
    );
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        mood="empty"
        className="rounded-[var(--radius-xl)] border border-line bg-surface"
        title="Nothing in the cart yet"
        description="Fabric is added by the metre against each mill's minimum order. Start from the marketplace, or describe what you need and let the assistant narrow it down."
        action={
          <ButtonLink href="/marketplace" trailingIcon={<ArrowRight size={13} weight="bold" />}>
            Browse fabrics
          </ButtonLink>
        }
        secondaryAction={
          <ButtonLink href="/marketplace?featured=1" variant="secondary">
            See what mills are featuring
          </ButtonLink>
        }
      />
    );
  }

  const towardFreeShipping = cart.freeShippingThreshold - cart.subtotal;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <div className="space-y-6">
        {cart.blockers > 0 ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-[var(--radius-md)] border border-warn-line bg-warn-soft p-4"
          >
            <WarningCircle size={17} weight="fill" className="mt-px shrink-0 text-warn" />
            <p className="text-[13px] leading-relaxed text-warn">
              {cart.blockers} {pluralise(cart.blockers, "line needs", "lines need")} attention before you can
              check out. Each one is flagged below.
            </p>
          </div>
        ) : null}

        {/* Grouped by mill — that's how the order will split, and how MOQ and
            lead time are actually assessed. */}
        {cart.groups.map((group) => (
          <section
            key={group.supplier.id}
            className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas-veil px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                <Link
                  href={`/marketplace?supplier=${group.supplier.slug}`}
                  className="truncate text-[13.5px] font-medium text-ink transition-colors hover:text-brand-ink"
                >
                  {group.supplier.businessName}
                </Link>
                {group.supplier.verified ? (
                  <Certificate size={12} weight="light" className="shrink-0 text-brass" aria-label="Verified" />
                ) : null}
                <span className="hidden text-[12px] text-subtle sm:inline">· {group.supplier.city}</span>
              </div>
              <p className="font-mono text-[12px] text-subtle tnum">
                {formatMoney(group.subtotal)} · ~{group.supplier.leadTimeDays}d lead
              </p>
            </header>

            <ul className="divide-y divide-line">
              <AnimatePresence initial={false}>
                {group.lines.map((line) => (
                  <motion.li
                    key={line.id}
                    layout
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
                    className={cn("p-4 sm:p-5", busyId === line.id && "opacity-60")}
                  >
                    <div className="flex gap-4">
                      <Link
                        href={`/product/${line.product.slug}`}
                        className="size-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-line sm:size-24"
                      >
                        {line.product.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={line.product.images[0].url}
                            alt={line.product.images[0].alt}
                            className="size-full object-cover"
                          />
                        ) : (
                          <FabricSwatch
                            weave={line.product.weave as WeaveKey}
                            hex={line.colorway?.hex ?? "#C9C2B4"}
                            gsm={line.product.gsm}
                            seed={line.product.id}
                            alt={`${line.product.name} swatch`}
                            drape={false}
                          />
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/product/${line.product.slug}`}
                              className="text-[14px] font-medium text-ink transition-colors hover:text-brand-ink"
                            >
                              {line.product.name}
                            </Link>
                            <p className="mt-1 font-mono text-[11.5px] text-subtle tnum">
                              {line.product.gsm} gsm · {line.product.widthCm} cm
                              {line.colorway ? ` · ${line.colorway.name}` : ""}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => remove(line.id, line.product.name)}
                            disabled={busyId === line.id}
                            aria-label={`Remove ${line.product.name} from cart`}
                            className="-m-1.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                          >
                            <Trash size={14} weight="light" />
                          </button>
                        </div>

                        {line.issues.length ? (
                          <ul className="mt-2 space-y-1">
                            {line.issues.map((issue) => (
                              <li
                                key={issue}
                                className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-warn"
                              >
                                <WarningCircle size={12} weight="fill" className="mt-px shrink-0" />
                                {issue}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <div className="mt-3.5 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <label
                              htmlFor={`qty-${line.id}`}
                              className="mb-1.5 block text-[11px] text-subtle"
                            >
                              Metres (min {formatNumber(line.product.moqMetres)})
                            </label>
                            <div className="flex items-center rounded-full border border-line bg-canvas-veil">
                              <button
                                type="button"
                                onClick={() =>
                                  setQuantity(
                                    line.id,
                                    Math.max(line.product.moqMetres, line.quantityMetres - stepFor(line.product.moqMetres)),
                                  )
                                }
                                disabled={line.quantityMetres <= line.product.moqMetres || busyId === line.id}
                                aria-label="Decrease quantity"
                                className="grid size-9 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                <Minus size={12} weight="bold" />
                              </button>
                              <input
                                id={`qty-${line.id}`}
                                type="number"
                                inputMode="numeric"
                                defaultValue={line.quantityMetres}
                                key={line.quantityMetres}
                                min={line.product.moqMetres}
                                onBlur={(e) => {
                                  const v = Number(e.target.value);
                                  if (v && v !== line.quantityMetres) setQuantity(line.id, v);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                }}
                                className="w-16 bg-transparent text-center font-mono text-[13px] text-ink tnum focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setQuantity(line.id, line.quantityMetres + stepFor(line.product.moqMetres))
                                }
                                disabled={busyId === line.id}
                                aria-label="Increase quantity"
                                className="grid size-9 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-35"
                              >
                                <Plus size={12} weight="bold" />
                              </button>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="font-mono text-[11px] text-subtle tnum">
                              {formatMoney(line.unitPrice)}/m
                            </p>
                            <p className="mt-0.5 font-mono text-[16px] font-medium text-ink tnum">
                              {formatMoney(line.lineTotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ))}
      </div>

      {/* ------------------------------------------------------------ summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5">
          <div className="rounded-[calc(var(--radius-xl)-7px)] border border-line bg-surface p-5 shadow-[var(--shadow-inset)]">
            <h2 className="text-[15px] font-semibold text-ink">Order summary</h2>

            <dl className="mt-5 space-y-3">
              <SummaryRow
                label={`${cart.itemCount} ${pluralise(cart.itemCount, "line")} · ${formatMetres(cart.totalMetres)}`}
                value={formatMoney(cart.subtotal)}
              />
              <SummaryRow
                label="Shipping"
                value={cart.shippingFee === 0 ? "Free" : formatMoney(cart.shippingFee)}
                muted={cart.shippingFee === 0}
              />
              <SummaryRow label="Duties & handling (5%)" value={formatMoney(cart.tax)} />
              <div className="border-t border-line pt-3">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[14px] font-medium text-ink">Total</dt>
                  <dd className="font-mono text-[20px] font-medium text-ink tnum">{formatMoney(cart.total)}</dd>
                </div>
              </div>
            </dl>

            {towardFreeShipping > 0 ? (
              <div className="mt-5 rounded-[var(--radius-sm)] border border-line bg-canvas-veil p-3">
                <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
                  <Truck size={14} weight="light" className="mt-px shrink-0 text-subtle" />
                  Add {formatMoney(towardFreeShipping)} more for free freight.
                </p>
                <div
                  className="mt-2.5 h-1 overflow-hidden rounded-full bg-line"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((cart.subtotal / cart.freeShippingThreshold) * 100)}
                  aria-label="Progress toward free shipping"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-700 ease-[var(--ease-out-expo)]"
                    style={{ width: `${Math.min(100, (cart.subtotal / cart.freeShippingThreshold) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <Badge tone="positive" className="mt-5" icon={<Truck size={11} weight="light" />}>
                Free freight applied
              </Badge>
            )}

            <div className="mt-6 space-y-2.5">
              <Button
                size="lg"
                fullWidth
                disabled={cart.blockers > 0}
                onClick={() => router.push("/checkout")}
                trailingIcon={<ArrowRight size={13} weight="bold" />}
              >
                {cart.blockers > 0 ? "Resolve flagged lines" : "Continue to checkout"}
              </Button>
              <ButtonLink href="/marketplace" variant="ghost" fullWidth>
                Keep browsing
              </ButtonLink>
            </div>

            <p className="mt-4 text-[11.5px] leading-relaxed text-subtle">
              No payment is taken. This prototype confirms the order with each mill and hands off the
              conversation — payments, escrow and logistics are out of scope.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[var(--radius-md)] border border-line bg-surface p-4">
          <p className="text-[12.5px] leading-relaxed text-muted">
            <strong className="font-medium text-ink">
              {cart.groups.length} {pluralise(cart.groups.length, "mill")}
            </strong>{" "}
            in this basket. Each receives its own order and moves through its own status ladder, so a delay at
            one doesn&apos;t hide progress at another.
          </p>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={cn("font-mono text-[13.5px] tnum", muted ? "text-positive" : "text-ink")}>{value}</dd>
    </div>
  );
}

function stepFor(moq: number) {
  return moq >= 300 ? 100 : moq >= 100 ? 50 : 10;
}
