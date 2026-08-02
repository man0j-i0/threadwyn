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
export async function complete(opts: {
  messages: ChatMessage[];
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<CompletionResult> {
  const provider = activeProvider();
  if (provider === "none") return null;

  const { messages, tools, temperature = 0.2, maxTokens = 800, timeoutMs = 28_000 } = opts;

  try {
    const { url, headers, model } =
      provider === "huggingface"
        ? {
            url: "https://router.huggingface.co/v1/chat/completions",
            headers: {
              Authorization: `Bearer ${process.env.HF_TOKEN}`,
              "Content-Type": "application/json",
            },
            model: process.env.HF_CHAT_MODEL ?? "Qwen/Qwen2.5-7B-Instruct",
          }
        : {
            url: `${process.env.OLLAMA_HOST!.replace(/\/$/, "")}/v1/chat/completions`,
            headers: { "Content-Type": "application/json" },
            model: process.env.OLLAMA_CHAT_MODEL ?? "qwen2.5:7b-instruct",
          };

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
      console.warn(`[ai] ${provider} returned ${res.status}; falling back to the rule-based engine`);
      return null;
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
    };
    const message = json.choices?.[0]?.message;
    if (!message) return null;

    return {
      content: (message.content ?? "").trim(),
      toolCalls: message.tool_calls ?? [],
    };
  } catch (err) {
    console.warn("[ai] provider call failed; falling back to the rule-based engine", err);
    return null;
  }
}

/**
 * Coerces a model's JSON reply into an object. Models routinely wrap JSON in
 * prose or a fence, so we recover rather than reject — but the result is still
 * schema-validated by the caller before anything touches the database.
 */
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
