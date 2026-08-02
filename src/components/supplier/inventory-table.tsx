"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, PencilSimple, Trash, X } from "@phosphor-icons/react";

import { cn, formatMetres, formatMoney, formatNumber } from "@/lib/utils";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { WeaveKey } from "@/lib/weave";

export type InventoryRow = {
  id: string;
  slug: string;
  name: string;
  weave: string;
  gsm: number;
  widthCm: number;
  composition: string;
  pricePerMetre: number;
  moqMetres: number;
  stockMetres: number;
  status: string;
  featured: boolean;
  category: { name: string; slug: string };
  colorways: { id: string; name: string; hex: string; stockMetres: number }[];
  images: { url: string; alt: string }[];
  _count: { orderItems: number };
};

const STATUS_META: Record<string, { label: string; tone: "positive" | "warn" | "danger" | "neutral" }> = {
  ACTIVE: { label: "Active", tone: "positive" },
  DRAFT: { label: "Draft", tone: "neutral" },
  OUT_OF_STOCK: { label: "Out of stock", tone: "danger" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [deleting, setDeleting] = useState<InventoryRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/supplier/products/${deleting.id}`, { method: "DELETE" });
      const body = (await res.json()) as { data?: { archived: boolean }; error?: { message: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Could not remove the fabric.");

      toast({
        tone: "success",
        title: body.data?.archived ? `${deleting.name} archived` : `${deleting.name} deleted`,
        description: body.data?.archived
          ? "It has order history, so it's archived rather than deleted — existing orders keep resolving."
          : undefined,
      });
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not remove",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Desktop: a real table. Mobile: cards — a 7-column table on a phone is
          a horizontal-scroll trap. */}
      <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface lg:block">
        <table className="w-full">
          <caption className="sr-only">Your fabric catalogue</caption>
          <thead>
            <tr className="border-b border-line bg-canvas-veil">
              <Th className="w-[34%]">Fabric</Th>
              <Th>Specs</Th>
              <Th align="right">Price</Th>
              <Th align="right">Stock</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-sunken/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="size-11 shrink-0 overflow-hidden rounded-[var(--radius-xs)] border border-line">
                      {row.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.images[0].url} alt="" className="size-full object-cover" />
                      ) : (
                        <FabricSwatch
                          weave={row.weave as WeaveKey}
                          hex={row.colorways[0]?.hex ?? "#C9C2B4"}
                          gsm={row.gsm}
                          seed={row.id}
                          alt=""
                          drape={false}
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <Link
                        href={`/supplier/products/${row.id}`}
                        className="block truncate text-[13.5px] font-medium text-ink transition-colors hover:text-brand-ink"
                      >
                        {row.name}
                      </Link>
                      <span className="block truncate text-[11.5px] text-subtle">
                        {row.category.name} · {row.colorways.length} colourway
                        {row.colorways.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-[11.5px] text-muted tnum">
                    {row.gsm} gsm · {row.widthCm} cm
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-subtle">{row.composition}</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-mono text-[13px] text-ink tnum">{formatMoney(row.pricePerMetre)}</p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-subtle tnum">MOQ {row.moqMetres}m</p>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className={cn(
                      "cursor-pointer rounded-full px-2.5 py-1 font-mono text-[13px] tnum transition-colors",
                      row.stockMetres <= 0
                        ? "bg-danger-soft text-danger"
                        : row.stockMetres < 500
                          ? "bg-warn-soft text-warn"
                          : "text-ink hover:bg-sunken",
                    )}
                    aria-label={`Adjust stock for ${row.name}, currently ${row.stockMetres} metres`}
                  >
                    {formatNumber(row.stockMetres)}m
                  </button>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    tone={STATUS_META[row.status]?.tone ?? "neutral"}
                    icon={<StatusDot tone={STATUS_META[row.status]?.tone ?? "neutral"} />}
                  >
                    {STATUS_META[row.status]?.label ?? row.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton
                      label={`Edit ${row.name}`}
                      size="sm"
                      onClick={() => router.push(`/supplier/products/${row.id}`)}
                    >
                      <PencilSimple size={14} weight="light" />
                    </IconButton>
                    <IconButton label={`Remove ${row.name}`} size="sm" onClick={() => setDeleting(row)}>
                      <Trash size={14} weight="light" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-[var(--radius-lg)] border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="size-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-line">
                <FabricSwatch
                  weave={row.weave as WeaveKey}
                  hex={row.colorways[0]?.hex ?? "#C9C2B4"}
                  gsm={row.gsm}
                  seed={row.id}
                  alt=""
                  drape={false}
                />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/supplier/products/${row.id}`} className="block text-[14px] font-medium text-ink">
                  {row.name}
                </Link>
                <p className="mt-0.5 font-mono text-[11px] text-subtle tnum">
                  {row.gsm} gsm · {formatMoney(row.pricePerMetre)}/m
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_META[row.status]?.tone ?? "neutral"}>
                    {STATUS_META[row.status]?.label ?? row.status}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="cursor-pointer rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted tnum"
                  >
                    {formatNumber(row.stockMetres)}m ·  adjust
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2 border-t border-line pt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push(`/supplier/products/${row.id}`)}
                icon={<PencilSimple size={13} weight="light" />}
                className="flex-1"
              >
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleting(row)} icon={<Trash size={13} weight="light" />}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editing ? <StockDialog row={editing} onClose={() => setEditing(null)} /> : null}

      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={deleting?._count.orderItems ? "Archive this fabric?" : "Delete this fabric?"}
        description={
          deleting?._count.orderItems
            ? `${deleting.name} appears on ${deleting._count.orderItems} order line${deleting._count.orderItems === 1 ? "" : "s"}, so it will be archived rather than deleted — those orders keep resolving correctly. It disappears from the marketplace immediately.`
            : `${deleting?.name ?? "This fabric"} has no order history, so it will be permanently deleted. This can't be undone.`
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={busy}>
              {deleting?._count.orderItems ? "Archive" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">
          Buyers with this fabric already in a cart will see it flagged as unavailable at checkout.
        </p>
      </Dialog>
    </>
  );
}

function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-[11px] font-medium text-subtle",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Inline stock adjustment — the edit a supplier makes most often, so it gets
 *  its own two-click path instead of living inside the full product form. */
function StockDialog({ row, onClose }: { row: InventoryRow; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(() =>
    Object.fromEntries(row.colorways.map((c) => [c.id, c.stockMetres])),
  );
  const [busy, setBusy] = useState(false);

  const total = Object.values(values).reduce((sum, v) => sum + (Number(v) || 0), 0);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/supplier/products/${row.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          colorways: row.colorways.map((c) => ({ id: c.id, stockMetres: Number(values[c.id]) || 0 })),
        }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Could not update stock.");

      toast({
        tone: "success",
        title: `Stock updated · ${formatMetres(total)}`,
        description:
          total <= 0
            ? "The listing is now marked out of stock."
            : row.stockMetres <= 0
              ? "The listing is live again."
              : undefined,
      });
      onClose();
      router.refresh();
    } catch (err) {
      toast({
        tone: "error",
        title: "Stock not updated",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Adjust stock · ${row.name}`}
      description="Stock is held per colourway. The listing total is their sum, and it flips to out-of-stock at zero."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy} icon={busy ? undefined : <Check size={14} weight="bold" />}>
            Save · {formatMetres(total)}
          </Button>
        </>
      }
    >
      <ul className="space-y-2.5">
        {row.colorways.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <span
              aria-hidden
              className="size-8 shrink-0 overflow-hidden rounded-full border border-line"
              style={{ backgroundColor: c.hex }}
            />
            <label htmlFor={`stock-${c.id}`} className="min-w-0 flex-1 text-[13px] text-ink">
              {c.name}
            </label>
            <div className="flex items-center rounded-[var(--radius-sm)] border border-line bg-surface focus-within:border-brand">
              <input
                id={`stock-${c.id}`}
                type="number"
                min={0}
                inputMode="numeric"
                value={values[c.id]}
                onChange={(e) => setValues((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                className="min-h-10 w-24 bg-transparent px-3 text-right font-mono text-[13px] text-ink tnum focus:outline-none"
              />
              <span className="pr-3 font-mono text-[11px] text-subtle">m</span>
            </div>
          </li>
        ))}
      </ul>

      {total <= 0 ? (
        <p className="mt-4 flex items-start gap-2 rounded-[var(--radius-sm)] border border-warn-line bg-warn-soft px-3 py-2.5 text-[12px] leading-relaxed text-warn">
          <X size={13} weight="bold" className="mt-px shrink-0" />
          Saving zero across every colourway takes this listing off the marketplace until you restock.
        </p>
      ) : null}

      {busy ? (
        <p className="mt-3 flex items-center gap-2 text-[12px] text-subtle">
          <Spinner className="size-3.5" /> Saving…
        </p>
      ) : null}
    </Dialog>
  );
}
