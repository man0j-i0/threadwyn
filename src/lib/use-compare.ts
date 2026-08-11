"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The compare shortlist.
 *
 * The comparison page reads its columns from the URL — `?slugs=a,b,c` — which is
 * the right source of truth: it is shareable, the back button works, and the
 * page stays a server component. What was missing was anywhere to *collect*
 * slugs before you get there, so the only entry point pushed a single slug and
 * every comparison had one column in it.
 *
 * This is that collection step, and it is deliberately not a database table or
 * a context provider. A shortlist is a scratch pad — it belongs to the tab, it
 * does not need to survive a sign-out, and nothing server-side has any use for
 * it. localStorage plus `useSyncExternalStore` gives every card, the product
 * page and the floating bar one shared value with no provider to thread.
 *
 * Capped at four because the comparison table is a fixed grid, and a fifth
 * column stops being a comparison and starts being a spreadsheet.
 */

const KEY = "threadwyn-compare";
export const COMPARE_LIMIT = 4;

/** Same array identity for every empty read — `useSyncExternalStore` compares
 *  snapshots with `Object.is`, and a fresh `[]` each call is an infinite loop. */
const EMPTY: readonly string[] = [];

let cache: readonly string[] = EMPTY;
let cacheRaw: string | null = null;

const listeners = new Set<() => void>();

function read(): readonly string[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(KEY);
  if (raw === cacheRaw) return cache;

  cacheRaw = raw;
  if (!raw) {
    cache = EMPTY;
    return cache;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    cache = Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string").slice(0, COMPARE_LIMIT)
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: readonly string[]) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  // localStorage only fires `storage` in *other* tabs, so this tab is told by hand.
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useCompare() {
  const slugs = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((slug: string) => {
    const current = read();
    if (current.includes(slug)) {
      write(current.filter((s) => s !== slug));
      return { added: false, full: false };
    }
    if (current.length >= COMPARE_LIMIT) return { added: false, full: true };
    write([...current, slug]);
    return { added: true, full: false };
  }, []);

  /** Unconditional removal. `toggle` would re-add a slug that was never in the
   *  list — which is exactly what happens when someone opens a shared
   *  `?slugs=` link and then drops a column from it. */
  const remove = useCallback((slug: string) => {
    const current = read();
    if (current.includes(slug)) write(current.filter((s) => s !== slug));
  }, []);

  const clear = useCallback(() => write(EMPTY), []);

  return {
    slugs,
    count: slugs.length,
    full: slugs.length >= COMPARE_LIMIT,
    has: (slug: string) => slugs.includes(slug),
    toggle,
    remove,
    clear,
    href: `/compare?slugs=${slugs.join(",")}`,
  };
}
