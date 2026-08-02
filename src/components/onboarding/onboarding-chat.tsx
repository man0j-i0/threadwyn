"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Keyboard, Microphone, SkipForward, Sparkle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { WeaverMark } from "@/components/brand/weaver-mark";

import { useVoice } from "@/components/ai/use-voice";

export type ScriptStep = { key: string; prompt: string; hint: string };
type Turn = { id: number; role: "user" | "assistant"; content: string };

let turnId = 0;

/**
 * Onboarding as a short conversation instead of a twelve-field form.
 *
 * The questions are a fixed script — a flow that can wander is a liability, and
 * a script works identically whether or not a model is configured. AI does the
 * part that is actually tedious: reading free-form answers back into structured
 * fields. The user then sees and edits every extracted value before anything is
 * saved.
 *
 * A "fill in the form instead" escape hatch is always visible. Conversation is
 * the default, never the only path.
 */
export function OnboardingChat({
  script,
  role,
  intro,
  onComplete,
  onSkip,
}: {
  script: readonly ScriptStep[];
  role: "BUYER" | "SUPPLIER";
  intro: string;
  onComplete: (result: {
    draft: Record<string, unknown>;
    mode: "model" | "rules";
    model: string;
    transcript: Turn[];
  }) => void;
  onSkip: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([
    { id: ++turnId, role: "assistant", content: intro },
    { id: ++turnId, role: "assistant", content: script[0]!.prompt },
  ]);
  const [stepIndex, setStepIndex] = useState(0);
  const [input, setInput] = useState("");
  const [extracting, setExtracting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoice({
    onFinal: (transcript) => {
      setInput(transcript);
      // Give the user a beat to read what was heard before it's submitted.
      window.setTimeout(() => void answer(transcript), 400);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, extracting]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [stepIndex]);

  async function answer(raw: string) {
    const text = raw.trim();
    if (!text || extracting) return;

    const nextTurns: Turn[] = [...turns, { id: ++turnId, role: "user" as const, content: text }];
    setInput("");

    const nextIndex = stepIndex + 1;

    if (nextIndex < script.length) {
      setTurns([...nextTurns, { id: ++turnId, role: "assistant", content: script[nextIndex]!.prompt }]);
      setStepIndex(nextIndex);
      return;
    }

    setTurns([
      ...nextTurns,
      { id: ++turnId, role: "assistant", content: "Got it — putting that into a profile now." },
    ]);
    setStepIndex(nextIndex);
    setExtracting(true);

    try {
      const res = await fetch("/api/v1/ai/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          transcript: nextTurns.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const body = (await res.json()) as {
        data?: { draft: Record<string, unknown>; mode: "model" | "rules"; model: string };
        error?: { message: string };
      };

      if (!res.ok || !body.data) throw new Error(body.error?.message ?? "Extraction failed.");

      onComplete({ ...body.data, transcript: nextTurns });
    } catch {
      // Extraction failing is recoverable — hand them a blank form rather than
      // trapping them in a conversation that can't finish.
      onComplete({ draft: {}, mode: "rules", model: "unavailable", transcript: nextTurns });
    } finally {
      setExtracting(false);
    }
  }

  const current = script[Math.min(stepIndex, script.length - 1)]!;
  const progress = Math.round((stepIndex / script.length) * 100);

  return (
    <div className="rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5">
      <div className="flex h-[min(34rem,72dvh)] flex-col rounded-[calc(var(--radius-xl)-7px)] border border-line bg-surface shadow-[var(--shadow-inset)]">
        {/* header + progress */}
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white">
              <Sparkle size={15} weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">Setting up your profile</p>
              <p className="font-mono text-[10.5px] text-subtle tnum">
                Question {Math.min(stepIndex + 1, script.length)} of {script.length}
              </p>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              <Keyboard size={12} weight="light" />
              Use the form instead
            </button>
          </div>

          <div
            className="mt-3 h-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Onboarding progress"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-700 ease-[var(--ease-out-expo)]"
              style={{ width: `${Math.max(6, progress)}%` }}
            />
          </div>
        </div>

        {/* transcript */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <AnimatePresence initial={false}>
            {turns.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}
              >
                <p
                  className={cn(
                    "max-w-[86%] rounded-[var(--radius-md)] px-3.5 py-2.5 text-[13.5px] leading-relaxed",
                    t.role === "user"
                      ? "rounded-br-sm bg-brand text-white dark:text-[#08110d]"
                      : "rounded-bl-sm bg-canvas-veil text-ink",
                  )}
                >
                  {t.content}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>

          {extracting ? (
            <div className="flex items-center gap-2.5">
              <WeaverMark mood="thinking" className="size-9" />
              <span className="text-[12.5px] text-subtle">Reading that back into fields…</span>
            </div>
          ) : null}
        </div>

        {/* composer */}
        {stepIndex < script.length ? (
          <div className="border-t border-line bg-canvas-veil p-3">
            <p className="mb-2 px-1 text-[11.5px] leading-relaxed text-subtle">{current.hint}</p>

            {voice.error ? (
              <p role="alert" className="mb-2 px-1 text-[11.5px] text-danger">
                {voice.error}
              </p>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void answer(input);
              }}
              className="flex items-end gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-1.5 focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
            >
              <label htmlFor="onboarding-answer" className="sr-only">
                {current.prompt}
              </label>
              <textarea
                id="onboarding-answer"
                ref={inputRef}
                rows={1}
                value={voice.listening ? voice.interim || "Listening…" : input}
                readOnly={voice.listening}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void answer(input);
                  }
                }}
                placeholder="Type your answer, or press the mic…"
                className="max-h-28 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2 text-[13.5px] leading-relaxed text-ink placeholder:text-subtle/70 focus:outline-none"
              />

              {voice.supported ? (
                <button
                  type="button"
                  onClick={voice.toggle}
                  aria-label={voice.listening ? "Stop recording" : "Answer by voice"}
                  aria-pressed={voice.listening}
                  className={cn(
                    "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors",
                    voice.listening
                      ? "animate-[tw-pulse-ring_1.6s_ease-out_infinite] bg-accent text-white"
                      : "text-subtle hover:bg-sunken hover:text-ink",
                  )}
                >
                  <Microphone size={16} weight={voice.listening ? "fill" : "light"} />
                </button>
              ) : null}

              <button
                type="submit"
                disabled={!input.trim() || extracting}
                aria-label="Send answer"
                className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-brand text-white transition-opacity hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-30 dark:text-[#08110d]"
              >
                <ArrowUp size={15} weight="bold" />
              </button>
            </form>

            <div className="mt-2 flex justify-center">
              <button
                type="button"
                onClick={() => void answer("Skip")}
                className="inline-flex cursor-pointer items-center gap-1.5 text-[11.5px] text-subtle transition-colors hover:text-ink"
              >
                <SkipForward size={11} weight="light" />
                Skip this question
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
