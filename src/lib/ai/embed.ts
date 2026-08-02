import { hashString } from "@/lib/utils";

export const EMBED_DIM = 256;

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it",
  "its", "of", "on", "or", "that", "the", "this", "to", "was", "were", "will", "with", "i", "we",
  "you", "me", "my", "our", "want", "need", "looking", "some", "any", "can", "get", "would", "like",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%/.\s-]/g, " ")
    .split(/[\s\-/]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Deterministic hashing embedding — a signed random-projection bag of words
 * plus character trigrams for fuzz tolerance ("poplen" still finds "poplin").
 *
 * Why this exists: the semantic surfaces (similar products, natural-language
 * search reranking) must work on a laptop with no API key and no network. When
 * HF_TOKEN is set, `embed()` upgrades to a real sentence-transformer and the
 * same cosine code path is reused unchanged. Vectors from the two sources are
 * never mixed — `npm run ai:embed` rewrites the whole catalogue at once.
 */
export function embedLocal(text: string): number[] {
  const v = new Float64Array(EMBED_DIM);
  const tokens = tokenize(text);

  const push = (key: string, weight: number) => {
    const h = hashString(key);
    const idx = h % EMBED_DIM;
    // Sign taken from a different bit of the hash so collisions cancel rather
    // than compound — the standard hashing-trick fix.
    const sign = (h >>> 16) % 2 === 0 ? 1 : -1;
    v[idx]! += sign * weight;
  };

  for (const token of tokens) {
    push(token, 1);
    // Trigrams give partial credit to near-misses and morphological variants.
    if (token.length > 4) {
      for (let i = 0; i <= token.length - 3; i++) {
        push(`3:${token.slice(i, i + 3)}`, 0.28);
      }
    }
  }

  // Adjacent-pair features capture "organic cotton" ≠ "cotton" + "organic".
  for (let i = 0; i < tokens.length - 1; i++) {
    push(`b:${tokens[i]}_${tokens[i + 1]}`, 0.55);
  }

  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;

  return Array.from(v, (x) => x / norm);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Hosted embeddings via the Hugging Face feature-extraction endpoint, falling
 * back to the local projection on any failure. A rate limit must degrade
 * search quality, never break the page.
 */
export async function embed(text: string): Promise<number[]> {
  const token = process.env.HF_TOKEN;
  const model = process.env.HF_EMBED_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2";
  if (!token) return embedLocal(text);

  try {
    const res = await fetch(`https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HF ${res.status}`);

    const json = (await res.json()) as number[] | number[][];
    // Some models return token-level vectors; mean-pool them.
    const vec = Array.isArray(json[0]) ? meanPool(json as number[][]) : (json as number[]);
    if (!Array.isArray(vec) || vec.length === 0) throw new Error("empty embedding");
    return l2(vec);
  } catch {
    return embedLocal(text);
  }
}

function meanPool(rows: number[][]): number[] {
  const dim = rows[0]!.length;
  const out = new Array<number>(dim).fill(0);
  for (const row of rows) for (let i = 0; i < dim; i++) out[i]! += row[i]!;
  return out.map((x) => x / rows.length);
}

function l2(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
