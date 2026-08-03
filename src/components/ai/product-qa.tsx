"use client";

import { useState } from "react";
import { ArrowUp, Microphone, Sparkle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { modeLabel } from "@/lib/ai/mode-label";
import { WeaverMark } from "@/components/brand/weaver-mark";
import { useVoice } from "./use-voice";

type Exchange = { id: number; question: string; answer: string | null; mode?: "model" | "rules"; model?: string };

let exchangeId = 0;

/**
 * Q&A scoped to a single fabric. The API answers only from this product's row,
 * so the model cannot drift onto a neighbouring SKU — and when no model is
 * configured, an intent-matched answer comes straight off the spec.
 */
export function ProductQA({ slug, name, suggestions }: { slug: string; name: string; suggestions: string[] }) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const voice = useVoice({
    onFinal: (transcript) => {
      setInput(transcript);
      void ask(transcript);
    },
  });

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;

    const id = ++exchangeId;
    setExchanges((prev) => [...prev, { id, question, answer: null }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, productSlug: slug, history: [] }),
      });
      const body = (await res.json()) as {
        data?: { message: string; mode: "model" | "rules"; model: string };
        error?: { message: string };
      };

      if (!res.ok || !body.data) throw new Error(body.error?.message ?? "The assistant is unavailable.");

      setExchanges((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, answer: body.data!.message, mode: body.data!.mode, model: body.data!.model } : e,
        ),
      );
    } catch (err) {
      setExchanges((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                answer:
                  err instanceof Error
                    ? `${err.message} The full specification is in the table above — everything I'd answer from is already on this page.`
                    : "Something went wrong.",
              }
            : e,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="product-qa" className="scroll-mt-24">
      <div className="rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5">
        <div className="rounded-[calc(var(--radius-xl)-7px)] border border-line bg-surface p-5 shadow-[var(--shadow-inset)] sm:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white">
              <Sparkle size={16} weight="fill" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-ink">Ask about this fabric</h2>
              <p className="mt-0.5 text-[12.5px] text-subtle">
                Answered only from {name}&apos;s specification. If it isn&apos;t in the data, I&apos;ll say so.
              </p>
            </div>
          </div>

          {exchanges.length > 0 ? (
            <div className="mt-6 space-y-5">
              {exchanges.map((e) => (
                <div key={e.id} className="space-y-2.5">
                  <p className="text-[13.5px] font-medium text-ink">{e.question}</p>
                  {e.answer === null ? (
                    <div className="flex items-center gap-2.5">
                      <WeaverMark mood="thinking" className="size-8" />
                      <span className="text-[12.5px] text-subtle">Reading the spec…</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-[13.5px] leading-relaxed text-muted">{e.answer}</p>
                      {e.model ? (
                        <p className="font-mono text-[10px] text-subtle">
                          {modeLabel(e.mode ?? "rules", e.model ?? "rule-based engine")}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {voice.error ? (
            <p role="alert" className="mt-4 text-[12px] text-danger">
              {voice.error}
            </p>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="mt-6 flex items-center gap-2 rounded-[var(--radius-md)] border border-line bg-canvas-veil p-1.5 focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
          >
            <label htmlFor="product-question" className="sr-only">
              Ask a question about {name}
            </label>
            <input
              id="product-question"
              value={voice.listening ? voice.interim || "Listening…" : input}
              onChange={(e) => setInput(e.target.value)}
              readOnly={voice.listening}
              placeholder="Will this hold a crease? What's the shrinkage?"
              className="min-h-10 min-w-0 flex-1 bg-transparent px-3 text-[13.5px] text-ink placeholder:text-subtle/75 focus:outline-none"
            />

            {voice.supported ? (
              <button
                type="button"
                onClick={voice.toggle}
                aria-label={voice.listening ? "Stop listening" : "Ask by voice"}
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
              disabled={!input.trim() || busy}
              aria-label="Ask"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-brand text-white transition-opacity hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-30 dark:text-[#08110d]"
            >
              <ArrowUp size={15} weight="bold" />
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="cursor-pointer rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-brand-line hover:bg-brand-soft hover:text-brand-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
