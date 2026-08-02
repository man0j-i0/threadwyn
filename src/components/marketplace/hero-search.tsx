"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const SUGGESTIONS = [
  "breathable cotton for summer shirting under ₹300",
  "heavy linen for unstructured jackets",
  "GOTS organic jersey, 200 gsm",
  "selvedge denim, 14oz",
];

/**
 * The search bar is the primary CTA on a marketplace, so it gets the visual
 * weight normally given to a button. Typing plain English is the fast path:
 * the query goes to the assistant, which turns it into real filters and hands
 * off to the same deterministic search the sidebar uses. Pressing enter on a
 * plain keyword skips the model entirely.
 */
export function HeroSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(query: string) {
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    // Anything that reads like a sentence goes through natural-language
    // parsing; one or two words is just a keyword search.
    const conversational = q.split(/\s+/).length >= 4;
    router.push(`/marketplace?${conversational ? "ask" : "q"}=${encodeURIComponent(q)}`);
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        role="search"
        className={cn(
          "group relative flex items-center gap-2 rounded-full border border-line bg-surface p-1.5 pl-5",
          "shadow-[var(--shadow-md)]",
          "transition-[border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]",
          "focus-within:border-brand focus-within:shadow-[var(--shadow-lg),0_0_0_4px_var(--brand-soft)]",
        )}
      >
        <MagnifyingGlass size={18} weight="light" aria-hidden className="shrink-0 text-subtle" />
        <label htmlFor="hero-search" className="sr-only">
          Search fabrics by name, fibre, weight or in plain English
        </label>
        <input
          id="hero-search"
          ref={inputRef}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          enterKeyHint="search"
          placeholder="Describe the fabric you need…"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-subtle/80 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          aria-label="Search"
          className={cn(
            "group/btn flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-brand pr-2 pl-5",
            "text-[14px] font-medium text-white dark:text-[#08110d]",
            "transition-[background-color,transform] duration-300 ease-[var(--ease-spring)]",
            "hover:bg-brand-hover active:scale-[0.98] disabled:opacity-60",
          )}
        >
          <span className="hidden sm:inline">Search</span>
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-full bg-white/15 transition-transform duration-300 ease-[var(--ease-spring)] group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-px dark:bg-black/15"
          >
            {busy ? <Spinner className="size-4" /> : <ArrowRight size={14} weight="bold" />}
          </span>
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-subtle">
          <Sparkle size={12} weight="fill" className="text-accent" />
          Try
        </span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setValue(s);
              submit(s);
            }}
            className={cn(
              "cursor-pointer rounded-full border border-line bg-surface/70 px-3 py-1.5 text-[12px] text-muted",
              "transition-[background-color,border-color,color] duration-200",
              "hover:border-brand-line hover:bg-brand-soft hover:text-brand-ink",
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
