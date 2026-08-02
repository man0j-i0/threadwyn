import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

import { cn, formatMoney, formatMetres } from "@/lib/utils";
import type { WeaveKey } from "@/lib/weave";
import { FabricSwatch } from "./fabric-swatch";
import { StockPill } from "./stock-pill";
import { QuickAdd } from "./quick-add";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  weave: WeaveKey;
  gsm: number;
  widthCm: number;
  composition: string;
  pricePerMetre: number;
  compareAtPrice: number | null;
  moqMetres: number;
  stockMetres: number;
  leadTimeDays: number;
  status: string;
  featured: boolean;
  category: { name: string; slug: string };
  supplier: { businessName: string; slug: string; verified: boolean; city: string };
  colorways: { id: string; name: string; hex: string }[];
  images: { url: string; alt: string }[];
};

export function ProductCard({
  product,
  priority,
  className,
}: {
  product: ProductCardData;
  priority?: boolean;
  className?: string;
}) {
  const lead = product.colorways[0];
  const hero = product.images[0];
  const discounted = product.compareAtPrice && product.compareAtPrice > product.pricePerMetre;

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-[var(--radius-lg)] border border-line bg-surface p-2",
        "transition-[border-color,box-shadow,transform] duration-500 ease-[var(--ease-out-expo)]",
        "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lg)]",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[calc(var(--radius-lg)-6px)] bg-inset">
        <div className="aspect-4/5 w-full overflow-hidden">
          <div className="size-full transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.045]">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.url}
                alt={hero.alt}
                loading={priority ? "eager" : "lazy"}
                className="size-full object-cover"
              />
            ) : (
              <FabricSwatch
                weave={product.weave}
                hex={lead?.hex ?? "#C9C2B4"}
                gsm={product.gsm}
                seed={product.id}
                alt={`${product.name} in ${lead?.name ?? "natural"} — ${product.composition}, ${product.gsm} gsm`}
                priority={priority}
              />
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-end gap-2">
          <StockPill stock={product.stockMetres} status={product.status} />
          {discounted ? (
            <span className="rounded-full bg-accent px-2 py-1 font-mono text-[10px] font-medium text-white shadow-[var(--shadow-sm)]">
              −{Math.round((1 - product.pricePerMetre / product.compareAtPrice!) * 100)}%
            </span>
          ) : null}
        </div>

        {/* Colourways float over the swatch so the card stays compact but the
            buyer can still see the range without opening the product. */}
        {product.colorways.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-1">
            {product.colorways.slice(0, 6).map((c) => (
              <span
                key={c.id}
                title={c.name}
                className="size-4 rounded-full ring-2 ring-white/85 dark:ring-black/40"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {product.colorways.length > 6 ? (
              <span className="ml-0.5 rounded-full bg-white/85 px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#191713] dark:bg-black/55 dark:text-white">
                +{product.colorways.length - 6}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-2 pt-3.5 pb-1.5">
        <div className="flex items-center gap-1.5">
          <p className="eyebrow truncate text-subtle">{product.category.name}</p>
          {product.supplier.verified ? (
            <CheckCircle size={11} weight="fill" className="shrink-0 text-brass" aria-label="Verified supplier" />
          ) : null}
        </div>

        <h3 className="mt-1.5 text-[14.5px] leading-snug font-medium text-ink">
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0 after:content-['']">
            {product.name}
          </Link>
        </h3>

        <p className="mt-1 truncate text-[12.5px] text-subtle">{product.supplier.businessName}</p>

        {/* The four numbers a sourcing decision actually turns on. */}
        <dl className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted tnum">
          <div className="flex items-center gap-1">
            <dt className="sr-only">Weight</dt>
            <dd>{product.gsm} gsm</dd>
          </div>
          <Dot />
          <div className="flex items-center gap-1">
            <dt className="sr-only">Width</dt>
            <dd>{product.widthCm} cm</dd>
          </div>
          <Dot />
          <div className="flex items-center gap-1">
            <dt className="sr-only">Minimum order</dt>
            <dd>MOQ {product.moqMetres}m</dd>
          </div>
        </dl>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3.5">
          <div>
            <p className="font-mono text-[15px] leading-none font-medium text-ink tnum">
              {formatMoney(product.pricePerMetre)}
              <span className="ml-0.5 text-[11px] font-normal text-subtle">/m</span>
            </p>
            {discounted ? (
              <p className="mt-1 font-mono text-[11px] text-subtle line-through tnum">
                {formatMoney(product.compareAtPrice!)}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-subtle">{formatMetres(product.stockMetres)} available</p>
            )}
          </div>

          {/* Sits above the stretched link so it stays independently clickable. */}
          <div className="relative z-10">
            <QuickAdd
              productId={product.id}
              productName={product.name}
              colorwayId={lead?.id ?? null}
              moq={product.moqMetres}
              disabled={product.status !== "ACTIVE" || product.stockMetres <= 0}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function Dot() {
  return (
    <span aria-hidden className="text-line-strong">
      ·
    </span>
  );
}
