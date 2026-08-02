"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowsLeftRight,
  Check,
  Handbag,
  Minus,
  Plus,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";

import { cn, formatMetres, formatMoney, formatNumber } from "@/lib/utils";
import { WEAVE_LABELS, WEAVE_NOTES, type WeaveKey } from "@/lib/weave";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { FabricSwatch, ColorwayChip } from "./fabric-swatch";
import { LookInside } from "@/components/weavescope/look-inside";

export type ProductDetailData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  composition: string;
  fibres: string[];
  weave: WeaveKey;
  gsm: number;
  widthCm: number;
  finish: string;
  handFeel: string;
  useCases: string[];
  sustainability: string[];
  pricePerMetre: number;
  compareAtPrice: number | null;
  moqMetres: number;
  stockMetres: number;
  leadTimeDays: number;
  status: string;
  category: { name: string; slug: string };
  colorways: { id: string; name: string; hex: string; stockMetres: number }[];
  images: { url: string; alt: string }[];
  supplier: {
    slug: string;
    businessName: string;
    city: string;
    state: string;
    verified: boolean;
    rating: number;
    ratingCount: number;
    leadTimeDays: number;
  };
};

export function ProductDetail({ product }: { product: ProductDetailData }) {
  const router = useRouter();
  const { toast } = useToast();

  const [colorway, setColorway] = useState(product.colorways[0] ?? null);
  const [quantity, setQuantity] = useState(product.moqMetres);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);

  const available = colorway?.stockMetres ?? product.stockMetres;
  const orderable = product.status === "ACTIVE" && available > 0;
  const lineTotal = quantity * product.pricePerMetre;
  const discounted = product.compareAtPrice && product.compareAtPrice > product.pricePerMetre;
  const hero = product.images[0];

  // Steps sized to the mill's minimum — clicking + on a 300m MOQ should move
  // by 100m, not by 1m.
  const step = product.moqMetres >= 300 ? 100 : product.moqMetres >= 100 ? 50 : 10;

  function nudge(delta: number) {
    setQuantity((q) => Math.max(product.moqMetres, q + delta));
  }

  async function addToCart() {
    if (!orderable || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          colorwayId: colorway?.id ?? null,
          quantityMetres: quantity,
        }),
      });

      if (res.status === 401) {
        toast({
          tone: "info",
          title: "Sign in to add to cart",
          action: { label: "Sign in", onClick: () => router.push(`/login?next=/product/${product.slug}`) },
        });
        return;
      }
      if (res.status === 403) {
        toast({ tone: "info", title: "Supplier accounts can't buy", description: "Cart is a buyer-side feature." });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Could not add to cart.");
      }

      setAdded(true);
      window.setTimeout(() => setAdded(false), 2200);
      toast({
        tone: "success",
        title: `${formatMetres(quantity)} added`,
        description: `${product.name}${colorway ? ` · ${colorway.name}` : ""}`,
        action: { label: "View cart", onClick: () => router.push("/cart") },
      });
      router.refresh();
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not add to cart",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
      {/* ------------------------------------------------------------ swatch */}
      <div>
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-2">
          <div className="relative aspect-square overflow-hidden rounded-[calc(var(--radius-xl)-9px)] sm:aspect-4/3">
            <AnimatePresence mode="wait">
              <motion.div
                key={colorway?.id ?? "default"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                {hero ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hero.url} alt={hero.alt} className="size-full object-cover" />
                ) : (
                  <FabricSwatch
                    weave={product.weave}
                    hex={colorway?.hex ?? "#C9C2B4"}
                    gsm={product.gsm}
                    seed={`${product.id}-${colorway?.id ?? "base"}`}
                    alt={`${product.name} in ${colorway?.name ?? "natural"} — ${product.composition}, ${product.gsm} gsm ${WEAVE_LABELS[product.weave].toLowerCase()}`}
                    priority
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-[#191713]/70 px-2.5 py-1 font-mono text-[10.5px] text-white backdrop-blur-sm">
              Rendered at true colour · {WEAVE_LABELS[product.weave]} · {product.gsm} gsm
            </p>
          </div>
        </div>

        {/* Weave explainer — the "why" behind the structure, not just its name. */}
        <div className="mt-4 rounded-[var(--radius-md)] border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 size-10 shrink-0 overflow-hidden rounded-[var(--radius-xs)]">
              <FabricSwatch
                weave={product.weave}
                hex={colorway?.hex ?? "#C9C2B4"}
                gsm={product.gsm}
                seed={`${product.id}-detail`}
                alt=""
                drape={false}
              />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{WEAVE_LABELS[product.weave]}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{WEAVE_NOTES[product.weave]}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <LookInside slug={product.slug} productName={product.name} variant="inline" />
            <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-subtle">
              Magnify from cloth to weave to fibre, with the construction figures worked out from this
              fabric&apos;s own specification.
            </p>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- panel */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/marketplace?category=${product.category.slug}`}
            className="eyebrow text-accent transition-colors hover:text-accent-hover"
          >
            {product.category.name}
          </Link>
          {product.sustainability.slice(0, 2).map((s) => (
            <Badge key={s} tone="brass">
              {s}
            </Badge>
          ))}
        </div>

        <h1 className="font-display mt-3 text-3xl leading-[1.12] font-medium tracking-[-0.02em] text-balance text-ink sm:text-[2.35rem]">
          {product.name}
        </h1>

        <Link
          href={`/suppliers/${product.supplier.slug}`}
          className="mt-3 inline-flex items-center gap-2 text-[13.5px] text-muted transition-colors hover:text-ink"
        >
          <span className="font-medium">{product.supplier.businessName}</span>
          <span className="text-subtle">·</span>
          <span className="text-subtle">
            {product.supplier.city}, {product.supplier.state}
          </span>
          {product.supplier.verified ? (
            <Badge tone="brass" className="ml-0.5">
              Verified
            </Badge>
          ) : null}
        </Link>

        <div className="mt-6 flex items-baseline gap-3">
          <p className="font-mono text-[2rem] leading-none font-medium text-ink tnum">
            {formatMoney(product.pricePerMetre)}
            <span className="ml-1 text-[14px] font-normal text-subtle">/metre</span>
          </p>
          {discounted ? (
            <p className="font-mono text-[15px] text-subtle line-through tnum">
              {formatMoney(product.compareAtPrice!)}
            </p>
          ) : null}
        </div>

        {/* The four figures a sourcing decision turns on, in one glance. */}
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line">
          <Spec label="Weight" value={`${product.gsm} gsm`} />
          <Spec label="Width" value={`${product.widthCm} cm`} />
          <Spec label="Minimum order" value={`${formatNumber(product.moqMetres)} m`} />
          <Spec label="Lead time" value={`${product.leadTimeDays} days`} />
        </dl>

        <p className="mt-4 text-[14px] leading-relaxed text-muted">{product.composition}</p>

        {/* ------------------------------------------------------ colourways */}
        {product.colorways.length > 0 ? (
          <div className="mt-7">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-medium text-ink">
                Colourway{" "}
                <span className="ml-1 font-normal text-subtle">
                  {colorway?.name ?? "—"}
                </span>
              </p>
              <p className="font-mono text-[11.5px] text-subtle tnum">
                {formatMetres(available)} in stock
              </p>
            </div>

            <div role="radiogroup" aria-label="Colourway" className="mt-3 flex flex-wrap gap-2">
              {product.colorways.map((c) => {
                const active = colorway?.id === c.id;
                const empty = c.stockMetres <= 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${c.name}${empty ? " — out of stock" : ` — ${c.stockMetres} metres`}`}
                    onClick={() => {
                      setColorway(c);
                      setQuantity((q) => Math.min(Math.max(q, product.moqMetres), Math.max(c.stockMetres, product.moqMetres)));
                    }}
                    className={cn(
                      "relative grid size-11 cursor-pointer place-items-center rounded-full border-2 transition-all duration-300 ease-[var(--ease-spring)]",
                      active ? "border-brand" : "border-transparent hover:border-line-strong",
                      empty && "opacity-45",
                    )}
                  >
                    <ColorwayChip
                      weave={product.weave}
                      hex={c.hex}
                      gsm={product.gsm}
                      seed={`${product.id}-${c.id}`}
                      size={32}
                    />
                    {active ? (
                      <span className="absolute inset-0 grid place-items-center">
                        <Check size={13} weight="bold" className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                      </span>
                    ) : null}
                    {empty ? (
                      <span
                        aria-hidden
                        className="absolute inset-0 grid place-items-center text-[9px] font-medium text-white"
                      >
                        <span className="h-px w-7 rotate-45 bg-white/85" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* -------------------------------------------------------- quantity */}
        <div className="mt-7">
          <label htmlFor="quantity" className="block text-[13px] font-medium text-ink">
            Quantity
          </label>
          <p className="mt-1 text-[12px] text-subtle">
            {product.supplier.businessName} has a {formatNumber(product.moqMetres)}m minimum on this cloth.
          </p>

          <div className="mt-3 flex items-stretch gap-2">
            <div className="flex flex-1 items-center rounded-[var(--radius-sm)] border border-line bg-surface focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--brand-soft)]">
              <button
                type="button"
                onClick={() => nudge(-step)}
                disabled={quantity <= product.moqMetres}
                aria-label={`Decrease by ${step} metres`}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-l-[var(--radius-sm)] text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Minus size={14} weight="bold" />
              </button>
              <input
                id="quantity"
                type="number"
                inputMode="numeric"
                min={product.moqMetres}
                step={step}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || product.moqMetres)}
                onBlur={() => setQuantity((q) => Math.max(product.moqMetres, Math.round(q)))}
                className="min-w-0 flex-1 bg-transparent py-2.5 text-center font-mono text-[15px] text-ink tnum focus:outline-none"
              />
              <span className="pr-1 font-mono text-[12px] text-subtle">m</span>
              <button
                type="button"
                onClick={() => nudge(step)}
                aria-label={`Increase by ${step} metres`}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-r-[var(--radius-sm)] text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <Plus size={14} weight="bold" />
              </button>
            </div>
          </div>

          {quantity > available && available > 0 ? (
            <p role="alert" className="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-warn">
              <WarningCircle size={13} weight="fill" className="mt-px shrink-0" />
              Only {formatMetres(available)} of {colorway?.name ?? "this fabric"} is on hand. The mill can weave the
              balance in about {product.leadTimeDays} days.
            </p>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between rounded-[var(--radius-sm)] bg-canvas-veil px-3.5 py-3">
            <span className="text-[13px] text-muted">Line total</span>
            <span className="font-mono text-[17px] font-medium text-ink tnum">{formatMoney(lineTotal)}</span>
          </div>
        </div>

        {/* --------------------------------------------------------- actions */}
        <div className="mt-5 space-y-2.5">
          <Button
            size="lg"
            fullWidth
            onClick={addToCart}
            loading={busy}
            disabled={!orderable}
            icon={added ? <Check size={16} weight="bold" /> : <Handbag size={16} weight="light" />}
          >
            {!orderable ? "Out of stock" : added ? "Added to cart" : "Add to cart"}
          </Button>

          <div className="grid grid-cols-2 gap-2.5">
            <Button
              variant="secondary"
              onClick={() => router.push(`/compare?slugs=${product.slug}`)}
              icon={<ArrowsLeftRight size={15} weight="light" />}
            >
              Compare
            </Button>
            <Button
              variant="secondary"
              onClick={() => document.getElementById("product-qa")?.scrollIntoView({ behavior: "smooth" })}
              icon={<Sparkle size={15} weight="light" />}
            >
              Ask about it
            </Button>
          </div>
        </div>

        {!orderable ? (
          <p className="mt-4 rounded-[var(--radius-sm)] border border-warn-line bg-warn-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-warn">
            This cloth is between lots. {product.supplier.businessName} quotes {product.leadTimeDays} days to
            weave a fresh run — contact them directly to reserve capacity.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <dt className="eyebrow text-subtle">{label}</dt>
      <dd className="mt-1.5 font-mono text-[15px] font-medium text-ink tnum">{value}</dd>
    </div>
  );
}
