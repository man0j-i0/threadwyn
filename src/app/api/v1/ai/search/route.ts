import { z } from "zod";

import { buildSearchHref } from "@/lib/ai/assistant";
import { describeFilters, parseQuery } from "@/lib/ai/nl-filters";
import { activeProvider, complete, parseJsonLoose, providerLabel } from "@/lib/ai/provider";
import { handleError, ok, parseBody } from "@/lib/api/respond";
import { aiSearchSchema } from "@/lib/validation/schemas";
import type { ProductFilters } from "@/server/services/product-service";

export const maxDuration = 30;

/**
 * Natural language → structured filters. Returns filters and chips only; the
 * caller redirects to /marketplace with them applied, so the AI never gets its
 * own results page and can never surface something the normal search wouldn't.
 */

const modelFilters = z.object({
  q: z.string().optional(),
  category: z.array(z.string()).optional(),
  fibre: z.array(z.string()).optional(),
  weave: z.array(z.string()).optional(),
  sustainability: z.array(z.string()).optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  gsmMin: z.number().optional(),
  gsmMax: z.number().optional(),
  stockMin: z.number().optional(),
  moqMax: z.number().optional(),
  leadTimeMax: z.number().optional(),
  inStock: z.boolean().optional(),
});

const EXTRACT_PROMPT = `Convert a fabric sourcing request into JSON filters for the Threadwyn catalogue. Reply with JSON only.

Fields (all optional, omit what wasn't asked for):
  q            free-text terms not covered by another field
  category     shirting | suiting | denim | linen | silk-satin | knits-jersey | performance | handloom-khadi | upholstery | canvas-workwear | lining | sheers-voile
  fibre        cotton | linen | silk | wool | polyester | viscose | elastane | nylon | cupro | zari
  weave        PLAIN | TWILL | SATIN | JACQUARD | HERRINGBONE | JERSEY | RIB | DOBBY | CANVAS | CREPE
  sustainability  GOTS | OEKO-TEX Standard 100 | GRS Recycled | European Flax | BCI Cotton | Fairtrade
  priceMin/priceMax   USD per metre, may carry cents (e.g. 4.5)
  gsmMin/gsmMax       grams per square metre
  stockMin            minimum metres available
  moqMax              maximum acceptable minimum-order quantity, metres
  leadTimeMax         maximum lead time, days
  inStock             true if they need stock on hand

Do not invent constraints the user did not express.`;

export async function POST(req: Request) {
  try {
    const { query } = await parseBody(req, aiSearchSchema);

    // The rule parser always runs — it is the floor. A model, when present,
    // only adds constraints the rules missed; it never overwrites them,
    // because a regex match on "under $4" is more reliable than a sample.
    const rules = parseQuery(query);
    let filters: ProductFilters = rules.filters;
    let mode: "model" | "rules" = "rules";

    if (activeProvider() !== "none") {
      const result = await complete({
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user", content: query },
        ],
        temperature: 0,
        maxTokens: 300,
        timeoutMs: 12_000,
      });

      const raw = result ? parseJsonLoose<unknown>(result.content) : null;
      const parsed = raw ? modelFilters.safeParse(raw) : null;

      if (parsed?.success) {
        filters = mergeFilters(parsed.data, rules.filters);
        mode = "model";
      }
    }

    const chips = describeFilters(filters);

    return ok({
      filters,
      chips,
      href: buildSearchHref(filters),
      mode,
      model: providerLabel(),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Rule-derived values win on conflict; the model fills gaps. */
function mergeFilters(model: ProductFilters, rules: ProductFilters): ProductFilters {
  const merged: ProductFilters = { ...model, ...rules };

  for (const key of ["category", "fibre", "weave", "sustainability"] as const) {
    const combined = [...new Set([...(rules[key] ?? []), ...(model[key] ?? [])])];
    if (combined.length) merged[key] = combined;
    else delete merged[key];
  }

  if (!merged.q?.trim()) delete merged.q;
  return merged;
}
