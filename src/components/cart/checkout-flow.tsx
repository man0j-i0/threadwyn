"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, PencilSimple, WarningCircle } from "@phosphor-icons/react";

import { cn, formatMetres, formatMoney, pluralise } from "@/lib/utils";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import type { WeaveKey } from "@/lib/weave";

type Line = {
  id: string;
  quantityMetres: number;
  unitPrice: number;
  lineTotal: number;
  colorway: { name: string; hex: string } | null;
  product: {
    id: string;
    slug: string;
    name: string;
    weave: string;
    gsm: number;
    widthCm: number;
    moqMetres: number;
    images: { url: string; alt: string }[];
  };
};

type CartSummary = {
  lines: Line[];
  groups: { supplier: { id: string; businessName: string; city: string; leadTimeDays: number }; subtotal: number; lines: Line[] }[];
  itemCount: number;
  totalMetres: number;
  subtotal: number;
  shippingFee: number;
  tax: number;
  total: number;
};

const STEPS = ["Delivery", "Review"] as const;

export function CheckoutFlow({
  cart,
  defaults,
}: {
  cart: CartSummary;
  defaults: Partial<CheckoutInput>;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<CheckoutInput>({
    shippingName: defaults.shippingName ?? "",
    shippingCompany: defaults.shippingCompany ?? "",
    shippingPhone: defaults.shippingPhone ?? "",
    shippingEmail: defaults.shippingEmail ?? "",
    shippingLine1: defaults.shippingLine1 ?? "",
    shippingLine2: "",
    shippingCity: defaults.shippingCity ?? "",
    shippingState: defaults.shippingState ?? "",
    shippingPostalCode: "",
    shippingCountry: "India",
    deliveryNotes: "",
  });

  function set<K extends keyof CheckoutInput>(key: K, value: CheckoutInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function goToReview() {
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      // Send focus to the first failure rather than scrolling them to a
      // summary they then have to translate back into a field.
      const first = Object.keys(fieldErrors)[0];
      document.getElementById(`checkout-${first}`)?.focus();
      return;
    }
    setErrors({});
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function placeOrder() {
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await res.json()) as {
        data?: { orderNumber: string };
        error?: { message: string; fields?: Record<string, string> };
      };

      if (!res.ok || !body.data) {
        if (body.error?.fields) {
          setErrors(body.error.fields);
          setStep(0);
        }
        throw new Error(body.error?.message ?? "Could not place the order.");
      }

      router.push(`/orders/${body.data.orderNumber}?placed=1`);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not place the order.");
      toast({
        tone: "error",
        title: "Order not placed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <div>
        {/* stepper */}
        <ol className="mb-8 flex items-center gap-3">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} className="flex flex-1 items-center gap-3">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] transition-colors duration-300",
                    done
                      ? "border-brand bg-brand text-white"
                      : current
                        ? "border-brand bg-brand-soft text-brand-ink"
                        : "border-line bg-surface text-subtle",
                  )}
                >
                  {done ? <Check size={12} weight="bold" /> : i + 1}
                </span>
                <span className={cn("text-[13px]", current ? "font-medium text-ink" : "text-subtle")}>
                  {label}
                </span>
                {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-line" /> : null}
              </li>
            );
          })}
        </ol>

        {formError ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2.5 rounded-[var(--radius-md)] border border-danger-line bg-danger-soft p-4"
          >
            <WarningCircle size={16} weight="fill" className="mt-px shrink-0 text-danger" />
            <p className="text-[13px] leading-relaxed text-danger">{formError}</p>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.section
              key="delivery"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[var(--radius-xl)] border border-line bg-surface p-5 sm:p-7"
            >
              <h2 className="font-display text-xl font-medium text-ink">Where should the cloth go?</h2>
              <p className="mt-1.5 text-[13px] text-subtle">
                Each mill ships to this address directly. No payment is taken at this step.
              </p>

              <div className="mt-7 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Contact name" error={errors.shippingName} required>
                    {(p) => (
                      <Input
                        {...p}
                        id="checkout-shippingName"
                        autoComplete="name"
                        value={form.shippingName}
                        onChange={(e) => set("shippingName", e.target.value)}
                        invalid={Boolean(errors.shippingName)}
                      />
                    )}
                  </Field>
                  <Field label="Company" optional error={errors.shippingCompany}>
                    {(p) => (
                      <Input
                        {...p}
                        id="checkout-shippingCompany"
                        autoComplete="organization"
                        value={form.shippingCompany ?? ""}
                        onChange={(e) => set("shippingCompany", e.target.value)}
                      />
                    )}
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Phone" hint="The mill will call to confirm dispatch." error={errors.shippingPhone} required>
                    {(p) => (
                      <Input
                        {...p}
                        id="checkout-shippingPhone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={form.shippingPhone}
                        onChange={(e) => set("shippingPhone", e.target.value)}
                        invalid={Boolean(errors.shippingPhone)}
                      />
                    )}
                  </Field>
                  <Field label="Email" error={errors.shippingEmail} required>
                    {(p) => (
                      <Input
                        {...p}
                        id="checkout-shippingEmail"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={form.shippingEmail}
                        onChange={(e) => set("shippingEmail", e.target.value)}
                        invalid={Boolean(errors.shippingEmail)}
                      />
                    )}
                  </Field>
                </div>

                <Field label="Address" error={errors.shippingLine1} required>
                  {(p) => (
                    <Input
                      {...p}
                      id="checkout-shippingLine1"
                      autoComplete="address-line1"
                      placeholder="Unit, building, street"
                      value={form.shippingLine1}
                      onChange={(e) => set("shippingLine1", e.target.value)}
                      invalid={Boolean(errors.shippingLine1)}
                    />
                  )}
                </Field>

                <Field label="Address line 2" optional>
                  {(p) => (
                    <Input
                      {...p}
                      id="checkout-shippingLine2"
                      autoComplete="address-line2"
                      placeholder="Area, landmark"
                      value={form.shippingLine2 ?? ""}
                      onChange={(e) => set("shippingLine2", e.target.value)}
                    />
                  )}
                </Field>

                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="City" error={errors.shippingCity} required>
                    {(p) => (
                      <Input
                        {...p}
                        id="checkout-shippingCity"
                        autoComplete="address-level2"
                        value={form.shippingCity}
                        onChange={(e) => set("shippingCity", e.target.value)}
                        invalid={Boolean(errors.shippingCity)}
                      />
                    )}
                  </Field>
                  <Field label="State" error={errors.shippingState} required>
                    {(p) => (
                      <Input
                        {...p}
                        id="checkout-shippingState"
                        autoComplete="address-level1"
                        value={form.shippingState}
                        onChange={(e) => set("shippingState", e.target.value)}
                        invalid={Boolean(errors.shippingState)}
                      />
                    )}
                  </Field>
                  <Field label="PIN code" error={errors.shippingPostalCode} required>
                    {(p) => (
                      <Input
                        {...p}
                        id="checkout-shippingPostalCode"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        value={form.shippingPostalCode}
                        onChange={(e) => set("shippingPostalCode", e.target.value)}
                        invalid={Boolean(errors.shippingPostalCode)}
                      />
                    )}
                  </Field>
                </div>

                <Field
                  label="Notes for the mill"
                  optional
                  hint="Cut lengths, roll width preference, labelling — anything that saves a phone call."
                >
                  {(p) => (
                    <Textarea
                      {...p}
                      id="checkout-deliveryNotes"
                      rows={3}
                      value={form.deliveryNotes ?? ""}
                      onChange={(e) => set("deliveryNotes", e.target.value)}
                    />
                  )}
                </Field>
              </div>

              <div className="mt-8 flex items-center justify-between gap-3">
                <Link
                  href="/cart"
                  className="inline-flex items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-ink"
                >
                  <ArrowLeft size={12} weight="bold" />
                  Back to cart
                </Link>
                <Button onClick={goToReview} trailingIcon={<ArrowRight size={13} weight="bold" />}>
                  Review order
                </Button>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="review"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >
              <div className="rounded-[var(--radius-xl)] border border-line bg-surface p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-medium text-ink">Delivering to</h2>
                    <address className="mt-3 text-[13.5px] leading-relaxed text-muted not-italic">
                      <span className="block font-medium text-ink">{form.shippingName}</span>
                      {form.shippingCompany ? <span className="block">{form.shippingCompany}</span> : null}
                      <span className="block">{form.shippingLine1}</span>
                      {form.shippingLine2 ? <span className="block">{form.shippingLine2}</span> : null}
                      <span className="block">
                        {form.shippingCity}, {form.shippingState} {form.shippingPostalCode}
                      </span>
                      <span className="mt-2 block font-mono text-[12px] text-subtle">
                        {form.shippingPhone} · {form.shippingEmail}
                      </span>
                    </address>
                    {form.deliveryNotes ? (
                      <p className="mt-3 rounded-[var(--radius-sm)] bg-canvas-veil px-3 py-2.5 text-[12.5px] leading-relaxed text-muted">
                        {form.deliveryNotes}
                      </p>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep(0)} icon={<PencilSimple size={13} weight="light" />}>
                    Edit
                  </Button>
                </div>
              </div>

              {cart.groups.map((group) => (
                <div
                  key={group.supplier.id}
                  className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas-veil px-5 py-3.5">
                    <p className="text-[13.5px] font-medium text-ink">{group.supplier.businessName}</p>
                    <p className="font-mono text-[12px] text-subtle tnum">
                      {formatMoney(group.subtotal)} · ~{group.supplier.leadTimeDays}d
                    </p>
                  </header>
                  <ul className="divide-y divide-line">
                    {group.lines.map((line) => (
                      <li key={line.id} className="flex items-center gap-3.5 px-5 py-3.5">
                        <span className="size-11 shrink-0 overflow-hidden rounded-[var(--radius-xs)] border border-line">
                          <FabricSwatch
                            weave={line.product.weave as WeaveKey}
                            hex={line.colorway?.hex ?? "#C9C2B4"}
                            gsm={line.product.gsm}
                            seed={line.product.id}
                            alt=""
                            drape={false}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {line.product.name}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-subtle tnum">
                            {formatMetres(line.quantityMetres)} × {formatMoney(line.unitPrice)}/m
                            {line.colorway ? ` · ${line.colorway.name}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[13px] font-medium text-ink tnum">
                          {formatMoney(line.lineTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-ink"
                >
                  <ArrowLeft size={12} weight="bold" />
                  Back
                </button>
                <Button size="lg" onClick={placeOrder} loading={busy} trailingIcon={busy ? undefined : <Check size={14} weight="bold" />}>
                  {busy ? "Placing order…" : `Place order · ${formatMoney(cart.total)}`}
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------ summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5">
          <div className="rounded-[calc(var(--radius-xl)-7px)] border border-line bg-surface p-5 shadow-[var(--shadow-inset)]">
            <h2 className="text-[15px] font-semibold text-ink">Summary</h2>
            <dl className="mt-5 space-y-3">
              <Row
                label={`${cart.itemCount} ${pluralise(cart.itemCount, "line")} · ${formatMetres(cart.totalMetres)}`}
                value={formatMoney(cart.subtotal)}
              />
              <Row label="Shipping" value={cart.shippingFee === 0 ? "Free" : formatMoney(cart.shippingFee)} />
              <Row label="Duties & handling (5%)" value={formatMoney(cart.tax)} />
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="text-[14px] font-medium text-ink">Total</dt>
                <dd className="font-mono text-[20px] font-medium text-ink tnum">{formatMoney(cart.total)}</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-[var(--radius-sm)] bg-canvas-veil p-3">
              <p className="text-[11.5px] leading-relaxed text-subtle">
                Splitting into{" "}
                <strong className="font-medium text-muted">
                  {cart.groups.length} {pluralise(cart.groups.length, "mill order")}
                </strong>
                . Each mill confirms and dispatches independently, and each has its own tracker.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="font-mono text-[13.5px] text-ink tnum">{value}</dd>
    </div>
  );
}
