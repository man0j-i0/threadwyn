"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  ArrowUp,
  Microphone,
  SpeakerHigh,
  SpeakerSlash,
  Sparkle,
  X,
} from "@phosphor-icons/react";

import { cn, formatMetres, formatMoney } from "@/lib/utils";
import { modeLabel, type AiMode } from "@/lib/ai/mode-label";
import { FabricSwatch } from "@/components/product/fabric-swatch";
import { WeaverMark } from "@/components/brand/weaver-mark";
import { useSpeech, useVoice } from "./use-voice";
import type { WeaveKey } from "@/lib/weave";

type Citation = {
  id: string;
  slug: string;
  name: string;
  supplier: string;
  price: number;
  gsm: number;
  widthCm: number;
  composition: string;
  weave: string;
  stockMetres: number;
  moqMetres: number;
  leadTimeDays: number;
  hex: string;
};

type Turn = {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  chips?: { label: string }[];
  searchHref?: string | null;
  mode?: AiMode;
  model?: string;
};

const OPENERS = [
  "What's the lightest cotton you have for summer shirting?",
  "Compare linen against linen-cotton for a resort shirt",
  "I need 3000m of navy jersey under ₹350",
  "Which mills can ship in under 10 days?",
];

let turnId = 0;

/**
 * The assistant lives in a dock rather than a full page, because a buyer
 * asking about fabric almost always wants to keep looking at fabric. It never
 * blocks the catalogue: close it and every filter, search and sort still works.
 */
export function AssistantDock({ productSlug, productName }: { productSlug?: string; productName?: string }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const [spokenId, setSpokenId] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeech();
  const voice = useVoice({
    onFinal: (transcript) => {
      setInput(transcript);
      void send(transcript);
    },
  });

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  // ⌘K / Ctrl-K opens it from anywhere; Escape closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;

    const userTurn: Turn = { id: ++turnId, role: "user", content: text };
    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setBusy(true);
    speech.cancel();

    try {
      const history = turns.slice(-6).map((t) => ({ role: t.role, content: t.content }));
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, productSlug }),
      });

      const body = (await res.json()) as {
        data?: {
          message: string;
          citations: Citation[];
          chips: { label: string }[];
          searchHref: string | null;
          mode: AiMode;
          model: string;
        };
        error?: { message: string };
      };

      if (!res.ok || !body.data) {
        throw new Error(body.error?.message ?? "The assistant is unavailable right now.");
      }

      setTurns((prev) => [
        ...prev,
        {
          id: ++turnId,
          role: "assistant",
          content: body.data!.message,
          citations: body.data!.citations,
          chips: body.data!.chips,
          searchHref: body.data!.searchHref,
          mode: body.data!.mode,
          model: body.data!.model,
        },
      ]);

      if (readAloud) {
        setSpokenId(turnId);
        speech.speak(body.data.message);
      }
    } catch (err) {
      setTurns((prev) => [
        ...prev,
        {
          id: ++turnId,
          role: "assistant",
          content:
            err instanceof Error
              ? `${err.message} Browsing, search and filters all still work — the assistant is an extra, not a dependency.`
              : "Something went wrong.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const openers = productSlug
    ? [
        "What's this best suited for?",
        "How much stock is on hand?",
        "What's the minimum order?",
        "How does it compare to something lighter?",
      ]
    : OPENERS;

  return (
    <>
      {/* ------------------------------------------------------- launcher */}
      <AnimatePresence>
        {!open ? (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.14 } }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            aria-label="Open the Threadwyn assistant"
            data-print-hide
            className={cn(
              "group fixed right-4 bottom-4 z-70 flex cursor-pointer items-center gap-2.5 sm:right-6 sm:bottom-6",
              "rounded-full border border-brand-line bg-brand px-5 py-3 text-white dark:text-[#08110d]",
              "shadow-[var(--shadow-lg)] transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)]",
              "hover:-translate-y-0.5 hover:shadow-[var(--shadow-xl)] active:scale-[0.98]",
            )}
          >
            <Sparkle size={16} weight="fill" />
            <span className="text-[13.5px] font-medium">Ask Threadwyn</span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* ----------------------------------------------------------- panel */}
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-70 bg-[#191713]/25 backdrop-blur-[2px] sm:hidden"
            />

            <motion.aside
              role="dialog"
              aria-label="Threadwyn assistant"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.985, transition: { duration: 0.16 } }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              data-print-hide
              className={cn(
                "fixed z-70 flex flex-col overflow-hidden bg-surface",
                "inset-x-3 bottom-3 max-h-[82dvh]",
                "sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(640px,80dvh)] sm:w-[420px]",
                "rounded-[var(--radius-xl)] border border-line shadow-[var(--shadow-xl)]",
              )}
            >
              {/* header */}
              <div className="flex items-center gap-3 border-b border-line bg-canvas-veil px-4 py-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Sparkle size={15} weight="fill" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">
                    {productName ? `About ${productName}` : "Threadwyn Assistant"}
                  </p>
                  <p className="truncate font-mono text-[10.5px] text-subtle">
                    {productName ? "grounded in this fabric's spec" : "grounded in the live catalogue"}
                  </p>
                </div>

                {speech.supported ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (readAloud || speech.speaking) {
                        speech.cancel();
                        setReadAloud(false);
                        return;
                      }
                      setReadAloud(true);
                      // Act on the conversation that is already on screen.
                      // A speaker button that only arms the *next* reply reads
                      // as broken, because clicking it does nothing you can hear.
                      const lastReply = [...turns].reverse().find((t) => t.role === "assistant");
                      if (lastReply) speech.speak(lastReply.content);
                    }}
                    aria-pressed={readAloud}
                    aria-label={
                      speech.speaking
                        ? "Stop speaking"
                        : readAloud
                          ? "Turn off spoken replies"
                          : "Read replies aloud"
                    }
                    className={cn(
                      "grid size-8 cursor-pointer place-items-center rounded-full transition-colors",
                      speech.speaking
                        ? "animate-[tw-pulse-ring_1.6s_ease-out_infinite] bg-brand text-white"
                        : readAloud
                          ? "bg-brand-soft text-brand-ink"
                          : "text-subtle hover:bg-sunken hover:text-ink",
                    )}
                  >
                    {readAloud || speech.speaking ? (
                      <SpeakerHigh size={15} weight="light" />
                    ) : (
                      <SpeakerSlash size={15} weight="light" />
                    )}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close assistant"
                  className="grid size-8 cursor-pointer place-items-center rounded-full text-subtle transition-colors hover:bg-sunken hover:text-ink"
                >
                  <X size={15} weight="bold" />
                </button>
              </div>

              {/* transcript */}
              <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {turns.length === 0 ? (
                  <div className="py-4">
                    <WeaverMark mood="search" className="mx-auto size-20" />
                    <p className="mt-4 text-center text-[13.5px] leading-relaxed text-muted">
                      {productName
                        ? "Ask anything about this fabric. I only answer from its specification — if it isn't in the data, I'll say so."
                        : "Describe what you need in plain English, or press the mic and say it. I'll turn it into filters you can see and undo."}
                    </p>
                    <div className="mt-5 space-y-2">
                      {openers.map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => void send(o)}
                          className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-line bg-canvas-veil px-3.5 py-3 text-left text-[13px] text-muted transition-colors hover:border-brand-line hover:bg-brand-soft hover:text-brand-ink"
                        >
                          {o}
                          <ArrowRight size={12} weight="bold" className="shrink-0 opacity-50" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {turns.map((t) => (
                  <TurnBubble
                    key={t.id}
                    turn={t}
                    isSpeaking={speech.speaking && spokenId === t.id}
                    onSpeak={
                      t.role === "assistant" && speech.supported
                        ? () => {
                            if (speech.speaking && spokenId === t.id) {
                              speech.cancel();
                              setSpokenId(null);
                              return;
                            }
                            setSpokenId(t.id);
                            speech.speak(t.content);
                          }
                        : undefined
                    }
                  />
                ))}

                {busy ? (
                  <div className="flex items-center gap-2.5">
                    <WeaverMark mood="thinking" className="size-9" />
                    <span className="text-[12.5px] text-subtle">Searching the catalogue…</span>
                  </div>
                ) : null}
              </div>

              {/* composer */}
              <div className="border-t border-line bg-canvas-veil p-3">
                {voice.error ? (
                  <p role="alert" className="mb-2 px-1 text-[11.5px] leading-relaxed text-danger">
                    {voice.error}
                  </p>
                ) : null}
                {voice.listening ? (
                  <div className="mb-2 flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-accent-line bg-accent-soft px-3 py-2">
                    <Waveform />
                    <p className="min-w-0 flex-1 truncate text-[12.5px] text-accent">
                      {voice.interim || "Listening…"}
                    </p>
                  </div>
                ) : null}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                  className="flex items-end gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-1.5 focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--brand-soft)]"
                >
                  <label htmlFor="assistant-input" className="sr-only">
                    Message the assistant
                  </label>
                  <textarea
                    id="assistant-input"
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(input);
                      }
                    }}
                    placeholder={productName ? "Ask about this fabric…" : "Describe what you need…"}
                    className="max-h-30 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-[13.5px] leading-relaxed text-ink placeholder:text-subtle/70 focus:outline-none"
                  />

                  {voice.supported ? (
                    <button
                      type="button"
                      onClick={voice.toggle}
                      aria-label={voice.listening ? "Stop listening" : "Speak your question"}
                      aria-pressed={voice.listening}
                      className={cn(
                        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors duration-200",
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
                    aria-label="Send"
                    className={cn(
                      "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full",
                      "bg-brand text-white transition-[opacity,transform] duration-200 dark:text-[#08110d]",
                      "hover:bg-brand-hover active:scale-95",
                      "disabled:cursor-not-allowed disabled:opacity-30",
                    )}
                  >
                    <ArrowUp size={16} weight="bold" />
                  </button>
                </form>

                <p className="mt-2 px-1 text-center text-[10.5px] text-subtle">
                  Answers come from live catalogue data. Verify specs with the mill before committing to a lot.
                </p>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function TurnBubble({
  turn,
  onSpeak,
  isSpeaking,
}: {
  turn: Turn;
  onSpeak?: () => void;
  isSpeaking?: boolean;
}) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[86%] rounded-[var(--radius-md)] rounded-br-sm bg-brand px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white dark:text-[#08110d]">
          {turn.content}
        </p>
      </div>
    );
  }

  return (
    <div className="group/turn space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink">
          <RichText text={turn.content} />
        </div>
        {onSpeak ? (
          <button
            type="button"
            onClick={onSpeak}
            aria-label={isSpeaking ? "Stop reading this reply" : "Read this reply aloud"}
            className={cn(
              "mt-0.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full transition-[color,background-color,opacity]",
              isSpeaking
                ? "bg-brand text-white opacity-100"
                : "text-subtle opacity-0 group-hover/turn:opacity-100 focus-visible:opacity-100 hover:bg-sunken hover:text-ink",
            )}
          >
            {isSpeaking ? <SpeakerSlash size={13} weight="light" /> : <SpeakerHigh size={13} weight="light" />}
          </button>
        ) : null}
      </div>

      {turn.chips?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {turn.chips.map((c, i) => (
            <span
              key={`${c.label}-${i}`}
              className="rounded-full border border-brand-line bg-brand-soft px-2.5 py-1 font-mono text-[10.5px] text-brand-ink"
            >
              {c.label}
            </span>
          ))}
        </div>
      ) : null}

      {turn.citations?.length ? (
        <div className="space-y-1.5">
          {turn.citations.map((c) => (
            <Link
              key={c.id}
              href={`/product/${c.slug}`}
              className="group flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-canvas-veil p-2 transition-colors hover:border-brand-line hover:bg-brand-soft"
            >
              <span className="size-11 shrink-0 overflow-hidden rounded-[var(--radius-xs)]">
                <FabricSwatch
                  weave={c.weave as WeaveKey}
                  hex={c.hex}
                  gsm={c.gsm}
                  seed={c.id}
                  alt=""
                  drape={false}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-ink">{c.name}</span>
                <span className="block truncate font-mono text-[10.5px] text-subtle tnum">
                  {c.gsm} gsm · {formatMoney(c.price)}/m · {formatMetres(c.stockMetres)}
                </span>
              </span>
              <ArrowRight
                size={12}
                weight="bold"
                className="shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      ) : null}

      {turn.searchHref ? (
        <Link
          href={turn.searchHref}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-ink underline underline-offset-4 hover:text-brand-hover"
        >
          Open these as filters
          <ArrowRight size={11} weight="bold" />
        </Link>
      ) : null}

      {turn.model ? (
        <p className="font-mono text-[10px] text-subtle">
          {modeLabel(turn.mode ?? "rules", turn.model ?? "rule-based engine")}
        </p>
      ) : null}
    </div>
  );
}

/** Minimal **bold** rendering. Deliberately not a markdown library — model
 *  output is untrusted, and this only ever emits text nodes. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-medium text-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Waveform() {
  return (
    <span aria-hidden className="flex h-4 shrink-0 items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-accent"
          animate={{ height: ["25%", "100%", "40%", "80%", "25%"] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.09, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}
