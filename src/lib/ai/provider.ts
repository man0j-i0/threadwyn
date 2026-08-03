import "server-only";

/**
 * Provider resolution, in order:
 *
 *   1. HF_TOKEN     → Hugging Face Router (OpenAI-compatible). Works in prod.
 *   2. OLLAMA_HOST  → a local Qwen. No key, no cost, good for development.
 *   3. neither      → `null`, and every caller falls back to the deterministic
 *                     engine in `nl-filters.ts` / `assistant.ts`.
 *
 * Tier 3 is a product decision, not a shortcut. A demo that dies because an
 * inference endpoint rate-limited is a self-inflicted wound, and a buyer whose
 * search box stops working because a GPU is busy will not come back. So the AI
 * is an *enhancement layer* over a system that already works without it.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ProviderKind = "huggingface" | "ollama" | "none";

export function activeProvider(): ProviderKind {
  if (process.env.HF_TOKEN) return "huggingface";
  if (process.env.OLLAMA_HOST) return "ollama";
  return "none";
}

export function providerLabel(): string {
  switch (activeProvider()) {
    case "huggingface":
      return process.env.HF_CHAT_MODEL ?? "Qwen/Qwen2.5-7B-Instruct";
    case "ollama":
      return process.env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b-instruct";
    default:
      return "rule-based engine";
  }
}

type CompletionResult = {
  content: string;
  toolCalls: ToolCall[];
} | null;

/**
 * One round-trip to whichever provider is live. Returns `null` — not a thrown
 * error — when there is no provider or the call fails, so callers treat "no
 * model" and "model unavailable" identically and always have a fallback path.
 */
/**
 * Candidate model ids to try, in order.
 *
 * The Hugging Face OpenAI-compatible router usually wants the serving provider
 * pinned as a suffix — `Qwen/Qwen2.5-7B-Instruct:together` — and auto-routing a
 * bare id is not guaranteed to resolve. Rather than betting on one form, we try
 * the configured id first and fall back through a couple of known-good pins.
 * The winner is cached for the process, so this costs one extra request once.
 */
function candidateModels(): string[] {
  const configured = process.env.HF_CHAT_MODEL?.trim();
  if (configured?.includes(":")) return [configured];

  const base = configured || "Qwen/Qwen2.5-7B-Instruct";
  return [base, `${base}:together`, `${base}:nebius`, `${base}:hf-inference`];
}

let resolvedModel: string | null = null;

/** Last failure, verbatim. `npm run ai:check` prints this. */
export let lastProviderError: string | null = null;

export async function complete(opts: {
  messages: ChatMessage[];
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<CompletionResult> {
  const provider = activeProvider();
  if (provider === "none") return null;

  // The model must give up before the platform kills the function, otherwise
  // the request dies outright instead of degrading to the rule engine. Vercel
  // Hobby caps a function at 60s but defaults to 10s, so this is tunable:
  // set AI_TIMEOUT_MS below your plan's ceiling and the fallback always wins
  // the race.
  const budget = Number(process.env.AI_TIMEOUT_MS) || 20_000;
  const { messages, tools, temperature = 0.2, maxTokens = 800, timeoutMs = budget } = opts;

  const attempts =
    provider === "huggingface"
      ? resolvedModel
        ? [resolvedModel]
        : candidateModels()
      : [process.env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b-instruct"];

  const url =
    provider === "huggingface"
      ? "https://router.huggingface.co/v1/chat/completions"
      : `${process.env.OLLAMA_HOST!.replace(/\/$/, "")}/v1/chat/completions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "huggingface") headers.Authorization = `Bearer ${process.env.HF_TOKEN}`;

  for (const model of attempts) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastProviderError = `${res.status} ${res.statusText} — ${body.slice(0, 400)}`;
        // 4xx on a model id usually means "wrong pin": worth trying the next
        // candidate. Anything else is a real outage — stop and degrade.
        const worthRetrying = res.status === 400 || res.status === 404 || res.status === 422;
        if (worthRetrying && model !== attempts[attempts.length - 1]) continue;
        console.warn(`[ai] ${provider} ${model} → ${res.status}; using the rule-based engine`);
        return null;
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
      };
      const message = json.choices?.[0]?.message;
      if (!message) {
        lastProviderError = "response had no choices[0].message";
        return null;
      }

      // Remember which id actually worked so later calls go straight there.
      resolvedModel = model;
      lastProviderError = null;

      return {
        content: (message.content ?? "").trim(),
        toolCalls: message.tool_calls ?? [],
      };
    } catch (err) {
      lastProviderError = err instanceof Error ? err.message : String(err);
      if (model === attempts[attempts.length - 1]) {
        console.warn("[ai] provider call failed; using the rule-based engine", err);
        return null;
      }
    }
  }

  return null;
}

/** The model id that actually answered, once one has. */
export function activeModelId() {
  return resolvedModel ?? providerLabel();
}

export function parseJsonLoose<T>(raw: string): T | null {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();

  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
