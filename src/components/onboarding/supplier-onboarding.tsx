"use client";

import { useState } from "react";
import { ArrowLeft, Sparkle } from "@phosphor-icons/react";

import type { SupplierProfileInput } from "@/lib/validation/schemas";
import { SupplierProfileForm } from "@/components/supplier/profile-form";
import { WeaverMark } from "@/components/brand/weaver-mark";
import { OnboardingChat, type ScriptStep } from "./onboarding-chat";

const SCRIPT: readonly ScriptStep[] = [
  {
    key: "business",
    prompt: "Tell me about your mill — the name, what kind of operation it is, and where you're based.",
    hint: "e.g. “Coimbatore Weaving Co., a cotton mill in Coimbatore, running since 1974”",
  },
  {
    key: "capability",
    prompt: "What do you weave or hold, and what are you best known for?",
    hint: "Categories, fibres, any certifications.",
  },
  {
    key: "terms",
    prompt: "What's your usual minimum order and lead time?",
    hint: "e.g. “300 metres minimum, about two weeks”",
  },
  {
    key: "contact",
    prompt: "Finally — a contact email, phone number and your address.",
    hint: "This is what buyers use to reach you about an order.",
  },
];

export function SupplierOnboarding({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [stage, setStage] = useState<"chat" | "review">("chat");
  const [source, setSource] = useState<{ mode: "model" | "rules"; model: string } | null>(null);
  const [draft, setDraft] = useState<Partial<SupplierProfileInput>>({
    businessName: defaultName,
    contactEmail: defaultEmail,
    onboardingMode: "conversation",
  });

  if (stage === "chat") {
    return (
      <OnboardingChat
        role="SUPPLIER"
        script={SCRIPT}
        intro="Four questions and your mill is set up. Type or talk — whichever's quicker while you're on the floor."
        onComplete={(result) => {
          const d = result.draft as Partial<SupplierProfileInput>;
          setDraft((prev) => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(d).filter(([, v]) => {
                if (v === undefined || v === null) return false;
                if (Array.isArray(v) && v.length === 0) return false;
                if (typeof v === "string" && !v.trim()) return false;
                return true;
              }),
            ),
            onboardingMode: "conversation",
          }));
          setSource({ mode: result.mode, model: result.model });
          setStage("review");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onSkip={() => {
          setDraft((prev) => ({ ...prev, onboardingMode: "form" }));
          setStage("review");
        }}
      />
    );
  }

  return (
    <div>
      {source ? (
        <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-md)] border border-brand-line bg-brand-soft p-4">
          <WeaverMark mood="done" className="size-10 shrink-0" />
          <div className="min-w-0">
            <p className="text-[13.5px] leading-relaxed text-ink">
              Here&apos;s your profile from what you told me.{" "}
              <strong className="font-medium">Check the contact details and address in particular</strong> —
              those are the fields buyers actually use, and the ones extraction is most likely to get wrong.
            </p>
            <p className="mt-1.5 font-mono text-[10.5px] text-subtle">
              {source.mode === "model" ? source.model : "rule-based extraction · no model configured"}
            </p>
          </div>
        </div>
      ) : null}

      <SupplierProfileForm mode="onboarding" initial={draft} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStage("chat")}
          className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-subtle transition-colors hover:text-ink"
        >
          <ArrowLeft size={12} weight="bold" />
          Back to the conversation
        </button>
        <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
          <Sparkle size={11} weight="fill" className="text-accent" />
          Nothing is saved until you press save.
        </p>
      </div>
    </div>
  );
}
