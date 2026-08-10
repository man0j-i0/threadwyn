"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, Sparkle } from "@phosphor-icons/react";

import { buyerProfileSchema, type BuyerProfileInput } from "@/lib/validation/schemas";
import { modeLabel, type AiMode } from "@/lib/ai/mode-label";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, ChipGroup } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { WeaverMark } from "@/components/brand/weaver-mark";
import { OnboardingChat, type ScriptStep } from "./onboarding-chat";

const BUSINESS_TYPES = [
  { value: "BRAND", label: "Brand or label" },
  { value: "MANUFACTURER", label: "Garment manufacturer" },
  { value: "BOUTIQUE", label: "Boutique or atelier" },
  { value: "EXPORTER", label: "Exporter" },
  { value: "RETAILER", label: "Retailer" },
  { value: "OTHER", label: "Something else" },
];

const ORDER_SIZES = [
  { value: "under-500", label: "Under 500 m" },
  { value: "500-2000", label: "500 – 2,000 m" },
  { value: "2000-10000", label: "2,000 – 10,000 m" },
  { value: "10000-plus", label: "Over 10,000 m" },
];

const CATEGORIES = [
  "shirting", "suiting", "denim", "linen", "silk-satin", "knits-jersey",
  "performance", "handloom-khadi", "upholstery", "canvas-workwear", "lining", "sheers-voile",
];

const FIBRES = ["cotton", "linen", "silk", "wool", "polyester", "viscose", "elastane", "nylon", "cupro"];

const SCRIPT: readonly ScriptStep[] = [
  {
    key: "business",
    prompt: "What's your business called, and what do you make?",
    hint: "e.g. “Marigold Apparel — small-batch womenswear out of Bengaluru”",
  },
  {
    key: "materials",
    prompt: "What sort of cloth are you usually buying?",
    hint: "Fibres, categories, weights — however you'd describe it to a colleague.",
  },
  {
    key: "volume",
    prompt: "Roughly what quantity do you order at a time, and what's your ceiling on price per metre?",
    hint: "e.g. “usually 500 to 2000 metres, nothing over $10”",
  },
  {
    key: "extra",
    prompt: "Anything else that matters — certifications, lead times, things you avoid?",
    hint: "Optional. Say “nothing else” to skip.",
  },
];

export function BuyerOnboarding({
  defaultName,
  initial,
  mode = "onboarding",
}: {
  defaultName: string;
  initial?: Partial<BuyerProfileInput>;
  /** "settings" skips the conversation and opens straight on the editable form. */
  mode?: "onboarding" | "settings";
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [stage, setStage] = useState<"chat" | "review">(mode === "settings" ? "review" : "chat");
  const [source, setSource] = useState<{ mode: AiMode; model: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<BuyerProfileInput>({
    businessName: initial?.businessName ?? "",
    businessType: initial?.businessType ?? "BRAND",
    industry: initial?.industry ?? "",
    city: initial?.city ?? "",
    categoryInterest: initial?.categoryInterest ?? [],
    preferredFabrics: initial?.preferredFabrics ?? [],
    typicalOrderQty: initial?.typicalOrderQty ?? "500-2000",
    budgetMin: initial?.budgetMin ?? null,
    budgetMax: initial?.budgetMax ?? null,
    notes: initial?.notes ?? "",
    onboardingMode: initial?.onboardingMode ?? (mode === "settings" ? "form" : "conversation"),
  });

  // Which fields the extraction actually filled — used to mark them in the UI
  // so the user can see what was inferred versus what they still need to check.
  const [extracted, setExtracted] = useState<Set<string>>(new Set());

  function set<K extends keyof BuyerProfileInput>(key: K, value: BuyerProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setExtracted((prev) => {
      if (!prev.has(key as string)) return prev;
      const next = new Set(prev);
      next.delete(key as string);
      return next;
    });
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function applyDraft(result: {
    draft: Record<string, unknown>;
    mode: "model" | "rules";
    model: string;
  }) {
    const d = result.draft as Partial<BuyerProfileInput>;
    const filled = new Set<string>();

    setForm((prev) => {
      const next = { ...prev, onboardingMode: "conversation" as const };
      for (const key of Object.keys(d) as (keyof BuyerProfileInput)[]) {
        const value = d[key];
        if (value === undefined || value === null) continue;
        if (Array.isArray(value) && value.length === 0) continue;
        if (typeof value === "string" && !value.trim()) continue;
        // @ts-expect-error — keys are validated against the same schema on save
        next[key] = value;
        filled.add(key as string);
      }
      return next;
    });

    setExtracted(filled);
    setSource({ mode: result.mode, model: result.model });
    setStage("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = buyerProfileSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setFormError("A couple of fields still need a value.");
      document.getElementById(`bo-${Object.keys(fieldErrors)[0]}`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/v1/buyer/profile", {
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
        title: mode === "settings" ? "Profile saved" : "You're set up",
        description: "Recommendations are now tuned to what you told us.",
      });
      router.push(mode === "settings" ? "/dashboard" : "/marketplace");
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "chat") {
    return (
      <OnboardingChat
        role="BUYER"
        script={SCRIPT}
        intro={`Hi ${defaultName.split(" ")[0]} — four quick questions and I'll set up your sourcing profile. Type or talk, whichever's faster.`}
        onComplete={applyDraft}
        onSkip={() => {
          setSource(null);
          setForm((prev) => ({ ...prev, onboardingMode: "form" }));
          setStage("review");
        }}
      />
    );
  }

  return (
    <form onSubmit={save} noValidate>
      {source ? (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-brand-line bg-brand-soft p-4">
          <WeaverMark mood="done" className="size-10 shrink-0" />
          <div className="min-w-0">
            <p className="text-[13.5px] leading-relaxed text-ink">
              Here&apos;s what I picked up. <strong className="font-medium">Check it before saving</strong> —
              anything highlighted was inferred from what you said, so it&apos;s the most likely to be wrong.
            </p>
            <p className="mt-1.5 font-mono text-[10.5px] text-subtle">
              {modeLabel(source.mode, source.model, "rule-based extraction")}
            </p>
          </div>
        </div>
      ) : null}

      {formError ? (
        <div role="alert" className="mb-6 rounded-[var(--radius-md)] border border-danger-line bg-danger-soft p-4">
          <p className="text-[13px] text-danger">{formError}</p>
        </div>
      ) : null}

      <div className="space-y-6">
        <Section title="Your business">
          <Field label="Business name" error={errors.businessName} required>
            {(p) => (
              <Input
                {...p}
                id="bo-businessName"
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                invalid={Boolean(errors.businessName)}
                className={extracted.has("businessName") ? "border-brand bg-brand-soft/40" : undefined}
              />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Business type" error={errors.businessType} required>
              {(p) => (
                <Select
                  {...p}
                  id="bo-businessType"
                  value={form.businessType}
                  onChange={(e) => set("businessType", e.target.value)}
                  className={extracted.has("businessType") ? "border-brand bg-brand-soft/40" : undefined}
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Industry" error={errors.industry} required hint="Womenswear, uniforms, home…">
              {(p) => (
                <Input
                  {...p}
                  id="bo-industry"
                  value={form.industry}
                  onChange={(e) => set("industry", e.target.value)}
                  invalid={Boolean(errors.industry)}
                  className={extracted.has("industry") ? "border-brand bg-brand-soft/40" : undefined}
                />
              )}
            </Field>
          </div>

          <Field label="City" optional>
            {(p) => (
              <Input
                {...p}
                id="bo-city"
                value={form.city ?? ""}
                onChange={(e) => set("city", e.target.value)}
                className={extracted.has("city") ? "border-brand bg-brand-soft/40" : undefined}
              />
            )}
          </Field>
        </Section>

        <Section title="What you buy">
          <Field label="Categories you source" hint="Drives what shows up on your dashboard.">
            {() => (
              <ChipGroup
                columns
                options={CATEGORIES.map((c) => ({
                  value: c,
                  label: c.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" "),
                }))}
                value={form.categoryInterest}
                onChange={(v) => set("categoryInterest", v)}
              />
            )}
          </Field>

          <Field label="Preferred fibres">
            {() => (
              <ChipGroup
                options={FIBRES.map((f) => ({ value: f, label: f[0]!.toUpperCase() + f.slice(1) }))}
                value={form.preferredFabrics}
                onChange={(v) => set("preferredFabrics", v)}
              />
            )}
          </Field>
        </Section>

        <Section title="Order size & budget">
          <Field label="Typical order quantity" error={errors.typicalOrderQty} required>
            {(p) => (
              <Select
                {...p}
                id="bo-typicalOrderQty"
                value={form.typicalOrderQty}
                onChange={(e) => set("typicalOrderQty", e.target.value)}
                className={extracted.has("typicalOrderQty") ? "border-brand bg-brand-soft/40" : undefined}
              >
                {ORDER_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Budget from" optional hint="Per metre.">
              {(p) => (
                <Input
                  {...p}
                  id="bo-budgetMin"
                  type="number"
                  inputMode="numeric"
                  prefix="$"
                  value={form.budgetMin ?? ""}
                  onChange={(e) => set("budgetMin", e.target.value ? Number(e.target.value) : null)}
                />
              )}
            </Field>
            <Field label="Budget up to" optional hint="Per metre.">
              {(p) => (
                <Input
                  {...p}
                  id="bo-budgetMax"
                  type="number"
                  inputMode="numeric"
                  prefix="$"
                  value={form.budgetMax ?? ""}
                  onChange={(e) => set("budgetMax", e.target.value ? Number(e.target.value) : null)}
                  className={extracted.has("budgetMax") ? "border-brand bg-brand-soft/40" : undefined}
                />
              )}
            </Field>
          </div>

          <Field label="Anything else" optional hint="Certifications you require, things you avoid, lead-time constraints.">
            {(p) => (
              <Textarea
                {...p}
                id="bo-notes"
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                className={extracted.has("notes") ? "border-brand bg-brand-soft/40" : undefined}
              />
            )}
          </Field>
        </Section>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        {mode === "onboarding" ? (
          <button
            type="button"
            onClick={() => setStage("chat")}
            className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-ink"
          >
            <ArrowLeft size={12} weight="bold" />
            Back to the conversation
          </button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" loading={busy} icon={busy ? undefined : <Check size={15} weight="bold" />}>
          {mode === "settings" ? "Save changes" : "Save and start sourcing"}
        </Button>
      </div>

      {mode === "onboarding" ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11.5px] text-subtle">
          <Sparkle size={11} weight="fill" className="text-accent" />
          Nothing was saved until you pressed save. You can change any of this later.
        </p>
      ) : null}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-xl)] border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}
