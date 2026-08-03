"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Image as ImageIcon, Plus, Trash, X } from "@phosphor-icons/react";

import { cn, formatMetres, formatMoney } from "@/lib/utils";
import { WEAVE_LABELS, WEAVE_NOTES, type WeaveKey } from "@/lib/weave";
import { productSchema, type ProductInput } from "@/lib/validation/schemas";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, ChipGroup, CheckboxControl } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

const FIBRES = ["cotton", "linen", "silk", "wool", "polyester", "viscose", "elastane", "nylon", "cupro", "zari"];
const CERTS = [
  "GOTS",
  "OEKO-TEX Standard 100",
  "GRS Recycled",
  "European Flax",
  "BCI Cotton",
  "Fairtrade",
  "Handloom Mark",
  "Silk Mark",
];
const WEAVES = Object.keys(WEAVE_LABELS) as WeaveKey[];

type Colorway = { id?: string; name: string; hex: string; stockMetres: number };

export type ProductFormValues = Partial<ProductInput> & { id?: string };

export function ProductForm({
  categories,
  initial,
  mode,
}: {
  categories: { name: string; slug: string }[];
  initial?: ProductFormValues;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProductInput>({
    name: initial?.name ?? "",
    categorySlug: initial?.categorySlug ?? categories[0]?.slug ?? "",
    description: initial?.description ?? "",
    composition: initial?.composition ?? "",
    fibres: initial?.fibres ?? [],
    weave: initial?.weave ?? "PLAIN",
    gsm: initial?.gsm ?? 150,
    widthCm: initial?.widthCm ?? 150,
    finish: initial?.finish ?? "",
    handFeel: initial?.handFeel ?? "",
    useCases: initial?.useCases ?? [],
    sustainability: initial?.sustainability ?? [],
    pricePerMetre: initial?.pricePerMetre ?? 0,
    compareAtPrice: initial?.compareAtPrice ?? null,
    moqMetres: initial?.moqMetres ?? 100,
    leadTimeDays: initial?.leadTimeDays ?? 14,
    status: initial?.status ?? "ACTIVE",
    featured: initial?.featured ?? false,
    colorways: (initial?.colorways as Colorway[]) ?? [{ name: "Natural", hex: "#DDD3C0", stockMetres: 1000 }],
    images: initial?.images ?? [],
  });

  const [useCaseDraft, setUseCaseDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  const totalStock = useMemo(
    () => form.colorways.reduce((sum, c) => sum + (Number(c.stockMetres) || 0), 0),
    [form.colorways],
  );

  /* ---------------------------------------------------------- colourways */

  function addColorway() {
    setForm((prev) => ({
      ...prev,
      colorways: [...prev.colorways, { name: "", hex: "#8A8578", stockMetres: 0 }],
    }));
  }

  function updateColorway(index: number, patch: Partial<Colorway>) {
    setForm((prev) => ({
      ...prev,
      colorways: prev.colorways.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function removeColorway(index: number) {
    setForm((prev) => ({ ...prev, colorways: prev.colorways.filter((_, i) => i !== index) }));
  }

  /* -------------------------------------------------------------- images */

  /**
   * Downsize and re-encode in the browser before posting. A 6 MB phone photo
   * becomes a ~120 KB WebP, which keeps the upload fast and the row small.
   */
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);

    try {
      for (const file of Array.from(files).slice(0, 4)) {
        const resized = await downscale(file, 1600);
        const body = new FormData();
        body.append("file", resized, file.name.replace(/\.\w+$/, ".webp"));

        const res = await fetch("/api/v1/images", { method: "POST", body });
        const json = (await res.json()) as { data?: { url: string }; error?: { message: string } };
        if (!res.ok || !json.data) throw new Error(json.error?.message ?? "Upload failed.");

        setForm((prev) => ({
          ...prev,
          images: [...prev.images, { url: json.data!.url, alt: prev.name || "Fabric photograph" }],
        }));
      }
      toast({ tone: "success", title: "Photograph added" });
    } catch (err) {
      toast({
        tone: "error",
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try a smaller image.",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /* --------------------------------------------------------------- submit */

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = productSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setFormError(`${Object.keys(fieldErrors).length} field(s) need attention.`);
      const first = Object.keys(fieldErrors)[0]?.split(".")[0];
      document.getElementById(`product-${first}`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(
        mode === "create" ? "/api/v1/supplier/products" : `/api/v1/supplier/products/${initial!.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        },
      );
      const body = (await res.json()) as {
        data?: { id: string; name: string };
        error?: { message: string; fields?: Record<string, string> };
      };

      if (!res.ok || !body.data) {
        if (body.error?.fields) setErrors(body.error.fields);
        throw new Error(body.error?.message ?? "Could not save the fabric.");
      }

      toast({
        tone: "success",
        title: mode === "create" ? `${body.data.name} listed` : `${body.data.name} updated`,
        description:
          form.status === "DRAFT"
            ? "Saved as a draft — it isn't visible on the marketplace yet."
            : "It's live on the marketplace now.",
      });
      router.push("/supplier/products");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const preview = form.colorways[0];

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <div className="space-y-6">
        {formError ? (
          <div role="alert" className="rounded-[var(--radius-md)] border border-danger-line bg-danger-soft p-4">
            <p className="text-[13px] text-danger">{formError}</p>
          </div>
        ) : null}

        <Section title="Identity" description="What the fabric is called and where it sits in the catalogue.">
          <Field label="Fabric name" error={errors.name} required hint="Buyers search on this — be specific. “Compact Cotton Poplin 120” beats “Cotton Fabric”.">
            {(p) => (
              <Input
                {...p}
                id="product-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Compact Cotton Poplin 120"
                invalid={Boolean(errors.name)}
              />
            )}
          </Field>

          <Field label="Category" error={errors.categorySlug} required>
            {(p) => (
              <Select
                {...p}
                id="product-categorySlug"
                value={form.categorySlug}
                onChange={(e) => set("categorySlug", e.target.value)}
                invalid={Boolean(errors.categorySlug)}
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Description"
            error={errors.description}
            required
            hint="What makes this cloth behave the way it does. Buyers read this to decide, so be honest about trade-offs."
          >
            {(p) => (
              <Textarea
                {...p}
                id="product-description"
                rows={5}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                invalid={Boolean(errors.description)}
              />
            )}
          </Field>
        </Section>

        <Section title="Construction" description="The specs the marketplace filters on.">
          <Field label="Composition" error={errors.composition} required hint="e.g. 55% Linen / 45% Cotton">
            {(p) => (
              <Input
                {...p}
                id="product-composition"
                value={form.composition}
                onChange={(e) => set("composition", e.target.value)}
                placeholder="100% Compact Cotton"
                invalid={Boolean(errors.composition)}
              />
            )}
          </Field>

          <Field label="Fibres" error={errors.fibres} required hint="Drives the fibre filter. Pick every fibre present.">
            {() => (
              <ChipGroup
                options={FIBRES.map((f) => ({ value: f, label: f[0]!.toUpperCase() + f.slice(1) }))}
                value={form.fibres}
                onChange={(v) => set("fibres", v)}
              />
            )}
          </Field>

          <Field label="Weave" hint={WEAVE_NOTES[form.weave]} required>
            {(p) => (
              <Select {...p} id="product-weave" value={form.weave} onChange={(e) => set("weave", e.target.value as WeaveKey)}>
                {WEAVES.map((w) => (
                  <option key={w} value={w}>
                    {WEAVE_LABELS[w]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Weight" error={errors.gsm} required>
              {(p) => (
                <Input
                  {...p}
                  id="product-gsm"
                  type="number"
                  inputMode="numeric"
                  value={form.gsm}
                  onChange={(e) => set("gsm", Number(e.target.value))}
                  suffix="gsm"
                  invalid={Boolean(errors.gsm)}
                />
              )}
            </Field>
            <Field label="Width" error={errors.widthCm} required>
              {(p) => (
                <Input
                  {...p}
                  id="product-widthCm"
                  type="number"
                  inputMode="numeric"
                  value={form.widthCm}
                  onChange={(e) => set("widthCm", Number(e.target.value))}
                  suffix="cm"
                  invalid={Boolean(errors.widthCm)}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Finish" error={errors.finish} required hint="Mercerised, sanforised, enzyme washed…">
              {(p) => (
                <Input
                  {...p}
                  id="product-finish"
                  value={form.finish}
                  onChange={(e) => set("finish", e.target.value)}
                  invalid={Boolean(errors.finish)}
                />
              )}
            </Field>
            <Field label="Hand-feel" error={errors.handFeel} required hint="Crisp, fluid, dry, plush…">
              {(p) => (
                <Input
                  {...p}
                  id="product-handFeel"
                  value={form.handFeel}
                  onChange={(e) => set("handFeel", e.target.value)}
                  invalid={Boolean(errors.handFeel)}
                />
              )}
            </Field>
          </div>

          <Field label="Typical uses" optional hint="Press Enter to add each one.">
            {() => (
              <div>
                <div className="flex gap-2">
                  <Input
                    value={useCaseDraft}
                    onChange={(e) => setUseCaseDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = useCaseDraft.trim();
                        if (v && !form.useCases.includes(v)) set("useCases", [...form.useCases, v]);
                        setUseCaseDraft("");
                      }
                    }}
                    placeholder="Formal shirts"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const v = useCaseDraft.trim();
                      if (v && !form.useCases.includes(v)) set("useCases", [...form.useCases, v]);
                      setUseCaseDraft("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                {form.useCases.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {form.useCases.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => set("useCases", form.useCases.filter((x) => x !== u))}
                        className="group inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-2 pl-2.5 text-[12px] text-muted hover:border-danger-line hover:text-danger"
                        aria-label={`Remove ${u}`}
                      >
                        {u}
                        <X size={9} weight="bold" className="opacity-50 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </Field>

          <Field label="Certifications" optional>
            {() => (
              <ChipGroup
                options={CERTS.map((c) => ({ value: c, label: c }))}
                value={form.sustainability}
                onChange={(v) => set("sustainability", v)}
              />
            )}
          </Field>
        </Section>

        <Section
          title="Colourways & stock"
          description="Stock is held per colourway. The listing total is their sum, and it goes out of stock at zero."
        >
          <ul className="space-y-3">
            {form.colorways.map((c, i) => (
              <li key={i} className="rounded-[var(--radius-md)] border border-line bg-canvas-veil p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="shrink-0">
                    <label htmlFor={`cw-hex-${i}`} className="mb-1.5 block text-[11px] text-subtle">
                      Colour
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id={`cw-hex-${i}`}
                        type="color"
                        value={c.hex}
                        onChange={(e) => updateColorway(i, { hex: e.target.value })}
                        aria-label={`Colour for ${c.name || `colourway ${i + 1}`}`}
                        className="size-10 cursor-pointer rounded-full border border-line bg-transparent p-0.5"
                      />
                      <span className="size-10 shrink-0 overflow-hidden rounded-full border border-line">
                        <FabricSwatch
                          weave={form.weave}
                          hex={c.hex}
                          gsm={form.gsm || 150}
                          seed={`cw-${i}`}
                          alt=""
                          drape={false}
                        />
                      </span>
                    </div>
                  </div>

                  <div className="min-w-40 flex-1">
                    <label htmlFor={`cw-name-${i}`} className="mb-1.5 block text-[11px] text-subtle">
                      Name
                    </label>
                    <Input
                      id={`cw-name-${i}`}
                      value={c.name}
                      onChange={(e) => updateColorway(i, { name: e.target.value })}
                      placeholder="Optic White"
                      invalid={Boolean(errors[`colorways.${i}.name`])}
                    />
                  </div>

                  <div className="w-32">
                    <label htmlFor={`cw-stock-${i}`} className="mb-1.5 block text-[11px] text-subtle">
                      Stock
                    </label>
                    <Input
                      id={`cw-stock-${i}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={c.stockMetres}
                      onChange={(e) => updateColorway(i, { stockMetres: Number(e.target.value) })}
                      suffix="m"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={form.colorways.length <= 1}
                    onClick={() => removeColorway(i)}
                    aria-label={`Remove ${c.name || `colourway ${i + 1}`}`}
                  >
                    <Trash size={14} weight="light" />
                  </Button>
                </div>
                {errors[`colorways.${i}.hex`] ? (
                  <p role="alert" className="mt-2 text-[11.5px] text-danger">
                    {errors[`colorways.${i}.hex`]}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={addColorway} icon={<Plus size={13} weight="bold" />}>
              Add colourway
            </Button>
            <p className="font-mono text-[12px] text-subtle tnum">Total stock {formatMetres(totalStock)}</p>
          </div>
          {errors.colorways ? (
            <p role="alert" className="text-[12px] text-danger">
              {errors.colorways}
            </p>
          ) : null}
        </Section>

        <Section title="Commercial terms" description="What a buyer commits to when they order.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Price per metre" error={errors.pricePerMetre} required>
              {(p) => (
                <Input
                  {...p}
                  id="product-pricePerMetre"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.pricePerMetre}
                  onChange={(e) => set("pricePerMetre", Number(e.target.value))}
                  prefix="₹"
                  invalid={Boolean(errors.pricePerMetre)}
                />
              )}
            </Field>
            <Field label="Was (strike-through)" optional hint="Only if this is a genuine reduction.">
              {(p) => (
                <Input
                  {...p}
                  id="product-compareAtPrice"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.compareAtPrice ?? ""}
                  onChange={(e) => set("compareAtPrice", e.target.value ? Number(e.target.value) : null)}
                  prefix="₹"
                />
              )}
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Minimum order" error={errors.moqMetres} required hint="Quantities below this are raised automatically in the buyer's cart.">
              {(p) => (
                <Input
                  {...p}
                  id="product-moqMetres"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.moqMetres}
                  onChange={(e) => set("moqMetres", Number(e.target.value))}
                  suffix="m"
                  invalid={Boolean(errors.moqMetres)}
                />
              )}
            </Field>
            <Field label="Lead time" error={errors.leadTimeDays} required>
              {(p) => (
                <Input
                  {...p}
                  id="product-leadTimeDays"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={form.leadTimeDays}
                  onChange={(e) => set("leadTimeDays", Number(e.target.value))}
                  suffix="days"
                  invalid={Boolean(errors.leadTimeDays)}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section
          title="Photographs"
          description="Optional. Threadwyn renders an accurate woven swatch from your specs, so a photo is only worth adding if it shows something the spec can't — a print, a selvedge, a finished garment."
        >
          <div className="flex flex-wrap gap-3">
            {form.images.map((img, i) => (
              <div key={img.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt}
                  className="size-24 rounded-[var(--radius-sm)] border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => set("images", form.images.filter((_, x) => x !== i))}
                  aria-label="Remove photograph"
                  className="absolute -top-2 -right-2 grid size-6 cursor-pointer place-items-center rounded-full border border-line bg-surface text-subtle shadow-[var(--shadow-sm)] hover:text-danger"
                >
                  <X size={11} weight="bold" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || form.images.length >= 8}
              className={cn(
                "grid size-24 cursor-pointer place-items-center gap-1 rounded-[var(--radius-sm)]",
                "border border-dashed border-line-strong bg-canvas-veil text-subtle",
                "transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-ink",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <ImageIcon size={18} weight="light" />
              <span className="text-[10.5px]">{uploading ? "Uploading…" : "Add"}</span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </Section>
      </div>

      {/* ------------------------------------------------------- live preview */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5">
          <div className="rounded-[calc(var(--radius-xl)-7px)] border border-line bg-surface p-4 shadow-[var(--shadow-inset)]">
            <p className="eyebrow text-subtle">Live preview</p>

            <div className="mt-3 overflow-hidden rounded-[var(--radius-sm)] border border-line">
              <div className="aspect-4/5">
                {form.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.images[0].url} alt="" className="size-full object-cover" />
                ) : (
                  <FabricSwatch
                    weave={form.weave}
                    hex={preview?.hex ?? "#C9C2B4"}
                    gsm={form.gsm || 150}
                    seed={initial?.id ?? "preview"}
                    alt="Swatch preview"
                  />
                )}
              </div>
            </div>

            <p className="mt-3 text-[13.5px] font-medium text-ink">{form.name || "Untitled fabric"}</p>
            <p className="mt-1 font-mono text-[11px] text-subtle tnum">
              {form.gsm || 0} gsm · {form.widthCm || 0} cm · MOQ {form.moqMetres || 0}m
            </p>
            <p className="mt-2 font-mono text-[15px] font-medium text-ink tnum">
              {formatMoney(form.pricePerMetre || 0)}
              <span className="text-[11px] font-normal text-subtle">/m</span>
            </p>

            {form.colorways.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {form.colorways.map((c, i) => (
                  <span
                    key={i}
                    title={c.name}
                    className="size-4 rounded-full ring-1 ring-line"
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            ) : null}

            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-subtle">
              This is exactly what buyers see in the grid. The swatch is generated from your weave, weight and
              colour — no photography needed.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[var(--radius-lg)] border border-line bg-surface p-4">
          <Field label="Visibility">
            {(p) => (
              <Select {...p} id="product-status" value={form.status} onChange={(e) => set("status", e.target.value as ProductInput["status"])}>
                <option value="ACTIVE">Active — live on the marketplace</option>
                <option value="DRAFT">Draft — hidden from buyers</option>
                <option value="ARCHIVED">Archived — withdrawn</option>
              </Select>
            )}
          </Field>

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <CheckboxControl
              className="mt-0.5"
              checked={form.featured}
              onChange={(e) => set("featured", e.target.checked)}
            />
            <span>
              <span className="block text-[13px] text-ink">Feature this fabric</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-subtle">
                Eligible for the marketplace homepage.
              </span>
            </span>
          </label>

          {totalStock <= 0 && form.status === "ACTIVE" ? (
            <p className="mt-4 rounded-[var(--radius-sm)] border border-warn-line bg-warn-soft px-3 py-2.5 text-[11.5px] leading-relaxed text-warn">
              With zero stock this will save as out-of-stock rather than active.
            </p>
          ) : null}

          <div className="mt-5 space-y-2.5">
            <Button type="submit" fullWidth loading={busy}>
              {mode === "create" ? "List this fabric" : "Save changes"}
            </Button>
            <Link
              href="/supplier/products"
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-full text-[13px] text-subtle transition-colors hover:text-ink"
            >
              <ArrowLeft size={12} weight="bold" />
              Cancel
            </Link>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-xl)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-subtle">{description}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

/** Canvas downscale + WebP re-encode. Keeps uploads small without a server round-trip. */
async function downscale(file: File, maxEdge: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/webp", 0.86);
  });
}
