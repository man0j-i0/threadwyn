/**
 * How an AI surface describes what actually answered it.
 *
 * There are three states, and collapsing them into two is what made this worth
 * extracting. "No model is configured" and "a model is configured but did not
 * come back with anything usable" look identical to the caller — both fall back
 * to the deterministic engine — but they need opposite responses from whoever
 * is reading the label. The first is an environment problem; the second is a
 * timeout, a rate limit, or a reply we could not parse. Telling someone to go
 * check `HF_TOKEN` when `HF_TOKEN` is fine costs them an hour.
 *
 * `providerLabel()` returns the literal string "rule-based engine" when no
 * provider is configured, and the model id otherwise — which is how we tell the
 * two apart without threading extra state through every response shape.
 *
 * Client-safe on purpose: no `server-only`, no imports. It is rendered in four
 * client components.
 */

/**
 * - `model`    — a model produced this answer.
 * - `rules`    — the deterministic engine produced it *by design*. A query that
 *                parses cleanly into filters is answered from the query result
 *                itself; calling a model there would add latency and a chance
 *                of being wrong about numbers we already know exactly.
 * - `fallback` — we wanted a model and did not get a usable answer.
 */
export type AiMode = "model" | "rules" | "fallback";

const NO_PROVIDER = "rule-based engine";

export function modeLabel(mode: AiMode, model: string, noun = "rule-based engine"): string {
  if (mode === "model") return model;

  // No provider at all — worth surfacing, since it is usually unintended.
  if (model === NO_PROVIDER) return `${noun} · no model configured`;

  // A model exists and let us down. Distinct from the line below, which is the
  // engine doing its job.
  if (mode === "fallback") return `${noun} · ${model} unavailable, using rules`;

  return noun;
}
