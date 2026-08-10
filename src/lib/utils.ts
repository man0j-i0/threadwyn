import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ---------------------------------------------------------------- currency */

/**
 * Threadwyn quotes in USD. The mills are Indian, but B2B textile export is
 * quoted FOB in dollars — this is the buyer's currency, not the mill's.
 *
 * One locale, one currency, one place. Every figure in the product goes
 * through here, so supporting a second currency later is a change to this
 * file rather than a sweep through fifty components.
 */
const LOCALE = "en-US";
const CURRENCY = "USD";

export function formatMoney(value: number, opts: { compact?: boolean } = {}) {
  if (opts.compact && value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (opts.compact && value >= 1_000) {
    return `$${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPerMetre(value: number) {
  return `${formatMoney(value)}/m`;
}

/* ----------------------------------------------------------------- numbers */

export function formatMetres(value: number) {
  return `${new Intl.NumberFormat(LOCALE).format(Math.round(value))} m`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat(LOCALE).format(value);
}

export function formatPercent(value: number, digits = 0) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

/* ------------------------------------------------------------------- dates */

export function formatDate(input: Date | string) {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(input: Date | string) {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatRelative(input: Date | string) {
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

/* ------------------------------------------------------------------ strings */

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function titleCase(input: string) {
  return input
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function truncate(input: string, max: number) {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}…`;
}

export function pluralise(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/* -------------------------------------------------------------------- misc */

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deterministic 32-bit hash. Used to derive stable procedural weave geometry
 * from a product id, so the same fabric renders identically on every request.
 */
export function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function orderNumber(seed: number) {
  return `TW-${seed.toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}
