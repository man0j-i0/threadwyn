import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";

import { requireSupplierPage } from "@/lib/auth/guards";
import { listSupplierProducts } from "@/server/services/supplier-service";
import { serialize } from "@/lib/serialize";
import { formatMetres, formatNumber, pluralise } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InventoryTable, type InventoryRow } from "@/components/supplier/inventory-table";

export const metadata: Metadata = { title: "Inventory" };

const TABS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "OUT_OF_STOCK", label: "Out of stock" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ARCHIVED", label: "Archived" },
];

type PageProps = { searchParams: Promise<{ status?: string; q?: string }> };

export default async function SupplierProductsPage({ searchParams }: PageProps) {
  const { profile } = await requireSupplierPage();
  const { status, q } = await searchParams;

  const products = await listSupplierProducts(profile.id, { status, q });
  const rows = serialize(products) as unknown as InventoryRow[];

  const totalStock = rows.reduce((sum, r) => sum + r.stockMetres, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-accent">Catalogue</p>
          <h1 className="font-display mt-2.5 text-3xl leading-tight font-medium tracking-[-0.02em] text-ink">
            Inventory
          </h1>
          <p className="mt-2.5 text-[14px] text-muted">
            {formatNumber(rows.length)} {pluralise(rows.length, "listing")} · {formatMetres(totalStock)} on hand
          </p>
        </div>
        <ButtonLink href="/supplier/products/new" icon={<Plus size={15} weight="bold" />}>
          Add a fabric
        </ButtonLink>
      </header>

      <nav aria-label="Filter by status" className="mt-7 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = (status ?? "") === tab.value;
          return (
            <Link
              key={tab.value || "all"}
              href={tab.value ? `/supplier/products?status=${tab.value}` : "/supplier/products"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-9 items-center rounded-full border px-3.5 text-[12.5px] transition-colors duration-200",
                active
                  ? "border-brand bg-brand-soft font-medium text-brand-ink"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            mood="empty"
            className="rounded-[var(--radius-xl)] border border-line bg-surface"
            title={status ? "Nothing in this view" : "Your catalogue is empty"}
            description={
              status
                ? "No listings match this status filter yet."
                : "List your first fabric with the specs buyers actually filter on — composition, GSM, width, MOQ and lead time. Swatches are rendered automatically from the weave and colourway you enter, so no photography is required."
            }
            action={
              <ButtonLink href="/supplier/products/new" icon={<Plus size={14} weight="bold" />}>
                Add a fabric
              </ButtonLink>
            }
            secondaryAction={
              status ? (
                <ButtonLink href="/supplier/products" variant="ghost">
                  Show all
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <InventoryTable rows={rows} />
        )}
      </div>
    </div>
  );
}
