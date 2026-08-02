"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "@phosphor-icons/react";

import { supplierProfileSchema, type SupplierProfileInput } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, ChipGroup, checkboxClass } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

const BUSINESS_TYPES = [
  { value: "MILL", label: "Mill — we weave or knit in-house" },
  { value: "HANDLOOM", label: "Handloom — artisan or collective" },
  { value: "WHOLESALER", label: "Wholesaler — we hold and cut stock" },
  { value: "CONVERTER", label: "Converter — we finish greige cloth" },
  { value: "AGENT", label: "Agent — we represent other mills" },
];

const CATEGORY_OPTIONS = [
  "shirting", "suiting", "denim", "linen", "silk-satin", "knits-jersey",
  "performance", "handloom-khadi", "upholstery", "canvas-workwear", "lining", "sheers-voile",
];

const FABRIC_TYPES = ["cotton", "linen", "silk", "wool", "polyester", "viscose", "elastane", "nylon", "cupro", "zari", "blend"];

const CERTS = [
  "GOTS", "OEKO-TEX Standard 100", "GRS Recycled", "European Flax", "BCI Cotton",
  "Fairtrade", "Handloom Mark", "Silk Mark", "ISO 9001", "ZDHC Compliant",
];

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

type Hours = Record<string, { open: string; close: string } | null>;

export function SupplierProfileForm({
  initial,
  mode,
  onSaved,
}: {
  initial?: Partial<SupplierProfileInput>;
  mode: "onboarding" | "settings";
  onSaved?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [hours, setHours] = useState<Hours>(
    (initial?.operatingHours as Hours) ?? {
      mon: { open: "09:00", close: "18:00" },
      tue: { open: "09:00", close: "18:00" },
      wed: { open: "09:00", close: "18:00" },
      thu: { open: "09:00", close: "18:00" },
      fri: { open: "09:00", close: "18:00" },
      sat: { open: "09:00", close: "14:00" },
      sun: null,
    },
  );

  const [form, setForm] = useState<SupplierProfileInput>({
    businessName: initial?.businessName ?? "",
    businessType: initial?.businessType ?? "MILL",
    tagline: initial?.tagline ?? "",
    description: initial?.description ?? "",
    contactEmail: initial?.contactEmail ?? "",
    contactPhone: initial?.contactPhone ?? "",
    addressLine1: initial?.addressLine1 ?? "",
    addressLine2: initial?.addressLine2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    postalCode: initial?.postalCode ?? "",
    country: initial?.country ?? "India",
    operatingHours: undefined,
    categories: initial?.categories ?? [],
    fabricTypes: initial?.fabricTypes ?? [],
    moqMetres: initial?.moqMetres ?? 100,
    leadTimeDays: initial?.leadTimeDays ?? 14,
    yearEstablished: initial?.yearEstablished ?? null,
    certifications: initial?.certifications ?? [],
    onboardingMode: initial?.onboardingMode ?? (mode === "onboarding" ? "conversation" : "form"),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof SupplierProfileInput>(key: K, value: SupplierProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const payload = { ...form, operatingHours: hours as SupplierProfileInput["operatingHours"] };
    const parsed = supplierProfileSchema.safeParse(payload);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setFormError(`${Object.keys(fieldErrors).length} field(s) need attention.`);
      document.getElementById(`sp-${Object.keys(fieldErrors)[0]}`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/v1/supplier/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json()) as { error?: { message: string; fields?: Record<string, string> } };
      if (!res.ok) {
        if (body.error?.fields) setErrors(body.error.fields);
        throw new Error(body.error?.message ?? "Could not save your profile.");
      }

      toast({
        tone: "success",
        title: mode === "onboarding" ? "Profile set up" : "Profile saved",
        description: mode === "onboarding" ? "Your console is ready — time to list some cloth." : undefined,
      });

      onSaved?.();
      router.push(mode === "onboarding" ? "/supplier/products/new" : "/supplier");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {formError ? (
        <div role="alert" className="rounded-[var(--radius-md)] border border-danger-line bg-danger-soft p-4">
          <p className="text-[13px] text-danger">{formError}</p>
        </div>
      ) : null}

      <Section title="The business" description="What buyers see at the top of your mill page.">
        <Field label="Business name" error={errors.businessName} required>
          {(p) => (
            <Input
              {...p}
              id="sp-businessName"
              value={form.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder="Coimbatore Weaving Co."
              invalid={Boolean(errors.businessName)}
            />
          )}
        </Field>

        <Field label="Business type" error={errors.businessType} required>
          {(p) => (
            <Select
              {...p}
              id="sp-businessType"
              value={form.businessType}
              onChange={(e) => set("businessType", e.target.value)}
            >
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Tagline" optional hint="One line. What you're known for.">
          {(p) => (
            <Input
              {...p}
              id="sp-tagline"
              value={form.tagline ?? ""}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Fine-count cotton shirting since 1974"
            />
          )}
        </Field>

        <Field
          label="About"
          optional
          hint="Capability, capacity, what you're strict about. Buyers use this to judge whether you can take their order."
        >
          {(p) => (
            <Textarea
              {...p}
              id="sp-description"
              rows={5}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Year established" optional>
            {(p) => (
              <Input
                {...p}
                id="sp-yearEstablished"
                type="number"
                inputMode="numeric"
                value={form.yearEstablished ?? ""}
                onChange={(e) => set("yearEstablished", e.target.value ? Number(e.target.value) : null)}
                placeholder="1974"
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Contact" description="How buyers and Threadwyn reach you about an order.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" error={errors.contactEmail} required>
            {(p) => (
              <Input
                {...p}
                id="sp-contactEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                invalid={Boolean(errors.contactEmail)}
              />
            )}
          </Field>
          <Field label="Phone" error={errors.contactPhone} required>
            {(p) => (
              <Input
                {...p}
                id="sp-contactPhone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                invalid={Boolean(errors.contactPhone)}
              />
            )}
          </Field>
        </div>

        <Field label="Address" error={errors.addressLine1} required>
          {(p) => (
            <Input
              {...p}
              id="sp-addressLine1"
              autoComplete="address-line1"
              value={form.addressLine1}
              onChange={(e) => set("addressLine1", e.target.value)}
              invalid={Boolean(errors.addressLine1)}
            />
          )}
        </Field>

        <Field label="Address line 2" optional>
          {(p) => (
            <Input
              {...p}
              id="sp-addressLine2"
              autoComplete="address-line2"
              value={form.addressLine2 ?? ""}
              onChange={(e) => set("addressLine2", e.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="City" error={errors.city} required>
            {(p) => (
              <Input {...p} id="sp-city" value={form.city} onChange={(e) => set("city", e.target.value)} invalid={Boolean(errors.city)} />
            )}
          </Field>
          <Field label="State" error={errors.state} required>
            {(p) => (
              <Input {...p} id="sp-state" value={form.state} onChange={(e) => set("state", e.target.value)} invalid={Boolean(errors.state)} />
            )}
          </Field>
          <Field label="PIN code" error={errors.postalCode} required>
            {(p) => (
              <Input
                {...p}
                id="sp-postalCode"
                inputMode="numeric"
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
                invalid={Boolean(errors.postalCode)}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Operating hours" description="When a buyer can expect to reach someone.">
        <ul className="space-y-2">
          {DAYS.map((day) => {
            const value = hours[day.key];
            const open = Boolean(value);
            return (
              <li key={day.key} className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-9 w-32 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={open}
                    onChange={(e) =>
                      setHours((prev) => ({
                        ...prev,
                        [day.key]: e.target.checked ? { open: "09:00", close: "18:00" } : null,
                      }))
                    }
                    className={checkboxClass}
                  />
                  <span className="text-[13px] text-ink">{day.label}</span>
                </label>

                {open ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${day.label} opening time`}
                      value={value!.open}
                      onChange={(e) =>
                        setHours((prev) => ({ ...prev, [day.key]: { ...value!, open: e.target.value } }))
                      }
                      className="min-h-9 rounded-[var(--radius-xs)] border border-line bg-surface px-2.5 font-mono text-[12px] text-ink focus:border-brand focus:outline-none"
                    />
                    <span className="text-[11px] text-subtle">to</span>
                    <input
                      type="time"
                      aria-label={`${day.label} closing time`}
                      value={value!.close}
                      onChange={(e) =>
                        setHours((prev) => ({ ...prev, [day.key]: { ...value!, close: e.target.value } }))
                      }
                      className="min-h-9 rounded-[var(--radius-xs)] border border-line bg-surface px-2.5 font-mono text-[12px] text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                ) : (
                  <span className="text-[12px] text-subtle">Closed</span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="What you supply" description="Drives which searches your cloth turns up in.">
        <Field label="Categories" error={errors.categories}>
          {() => (
            <ChipGroup
              columns
              options={CATEGORY_OPTIONS.map((c) => ({
                value: c,
                label: c.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" "),
              }))}
              value={form.categories}
              onChange={(v) => set("categories", v)}
            />
          )}
        </Field>

        <Field label="Fibres you work with">
          {() => (
            <ChipGroup
              options={FABRIC_TYPES.map((f) => ({ value: f, label: f[0]!.toUpperCase() + f.slice(1) }))}
              value={form.fabricTypes}
              onChange={(v) => set("fabricTypes", v)}
            />
          )}
        </Field>

        <Field label="Certifications" optional>
          {() => (
            <ChipGroup
              options={CERTS.map((c) => ({ value: c, label: c }))}
              value={form.certifications}
              onChange={(v) => set("certifications", v)}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Default minimum order"
            error={errors.moqMetres}
            required
            hint="Pre-filled on every new listing. You can override it per fabric."
          >
            {(p) => (
              <Input
                {...p}
                id="sp-moqMetres"
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
          <Field label="Default lead time" error={errors.leadTimeDays} required>
            {(p) => (
              <Input
                {...p}
                id="sp-leadTimeDays"
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

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={busy} icon={busy ? undefined : <Check size={15} weight="bold" />}>
          {mode === "onboarding" ? "Save and start listing" : "Save profile"}
        </Button>
      </div>
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
