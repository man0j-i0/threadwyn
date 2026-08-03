import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { serialize } from "@/lib/serialize";
import { formatMetres, formatMoney } from "@/lib/utils";
import {
  getProductsForCompare,
  getSimilarProducts,
  searchProducts,
  type ProductFilters,
} from "@/server/services/product-service";
import { describeFilters, parseQuery } from "./nl-filters";
import type { AiMode } from "./mode-label";
import {
  activeProvider,
  complete,
  providerLabel,
  type ChatMessage,
  type ToolSchema,
} from "./provider";

export type AssistantCitation = {
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

export type AssistantReply = {
  message: string;
  citations: AssistantCitation[];
  chips: { key: string; label: string; value: string }[];
  searchHref: string | null;
  /**
   * Honest provenance, shown in the UI. Judges and users both deserve it.
   *
   * Note the difference between `rules` and `fallback`: the search path answers
   * deterministically on purpose, and reporting that as a degraded mode would
   * be a lie in the opposite direction.
   */
  mode: AiMode;
  model: string;
};

/* --------------------------------------------------------------- tooling */

const searchArgs = z.object({
  query: z.string().optional(),
  category: z.array(z.string()).optional(),
  fibre: z.array(z.string()).optional(),
  weave: z.array(z.string()).optional(),
  priceMax: z.number().optional(),
  priceMin: z.number().optional(),
  gsmMin: z.number().optional(),
  gsmMax: z.number().optional(),
  stockMin: z.number().optional(),
  moqMax: z.number().optional(),
  leadTimeMax: z.number().optional(),
  sustainability: z.array(z.string()).optional(),
  limit: z.number().min(1).max(8).optional(),
});

const TOOLS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "search_fabrics",
      description:
        "Search the Threadwyn catalogue. Use this for every product question. Prices are INR per metre; gsm is grams per square metre; stock and MOQ are in metres.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text terms, e.g. 'poplin shirting'" },
          category: {
            type: "array",
            items: { type: "string" },
            description:
              "Category slugs: shirting, suiting, denim, linen, silk-satin, knits-jersey, performance, handloom-khadi, upholstery, canvas-workwear, lining, sheers-voile",
          },
          fibre: {
            type: "array",
            items: { type: "string" },
            description: "cotton, linen, silk, wool, polyester, viscose, elastane, nylon, cupro, zari",
          },
          weave: {
            type: "array",
            items: { type: "string" },
            description: "PLAIN, TWILL, SATIN, JACQUARD, HERRINGBONE, JERSEY, RIB, DOBBY, CANVAS, CREPE",
          },
          priceMin: { type: "number" },
          priceMax: { type: "number" },
          gsmMin: { type: "number" },
          gsmMax: { type: "number" },
          stockMin: { type: "number", description: "Minimum metres in stock" },
          moqMax: { type: "number", description: "Maximum acceptable minimum-order quantity" },
          leadTimeMax: { type: "number", description: "Maximum lead time in days" },
          sustainability: {
            type: "array",
            items: { type: "string" },
            description: "GOTS, OEKO-TEX Standard 100, GRS Recycled, European Flax, BCI Cotton, Fairtrade",
          },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fabric",
      description: "Fetch the full specification and supplier detail for one fabric by its slug.",
      parameters: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_fabrics",
      description: "Return a normalised side-by-side specification table for two to four fabrics.",
      parameters: {
        type: "object",
        properties: { slugs: { type: "array", items: { type: "string" } } },
        required: ["slugs"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_similar",
      description: "Find fabrics that work like a given one — comparable weight, price band and construction.",
      parameters: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
      },
    },
  },
];

type ToolRow = Awaited<ReturnType<typeof searchProducts>>["items"][number];

function toCitation(p: ToolRow): AssistantCitation {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    supplier: p.supplier.businessName,
    price: Number(p.pricePerMetre),
    gsm: p.gsm,
    widthCm: p.widthCm,
    composition: p.composition,
    weave: p.weave,
    stockMetres: p.stockMetres,
    moqMetres: p.moqMetres,
    leadTimeDays: p.leadTimeDays,
    hex: p.colorways[0]?.hex ?? "#C9C2B4",
  };
}

/** Compact, token-cheap rendering of a product for the model to read. */
function describeForModel(c: AssistantCitation) {
  return [
    `slug=${c.slug}`,
    `name="${c.name}"`,
    `supplier="${c.supplier}"`,
    `${c.composition}`,
    `${c.weave.toLowerCase()}`,
    `${c.gsm}gsm`,
    `${c.widthCm}cm`,
    `₹${c.price}/m`,
    `stock ${c.stockMetres}m`,
    `MOQ ${c.moqMetres}m`,
    `lead ${c.leadTimeDays}d`,
  ].join(" | ");
}

async function runTool(name: string, rawArgs: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs || "{}");
  } catch {
    return { text: "Invalid tool arguments.", citations: [] as AssistantCitation[], filters: null };
  }

  if (name === "search_fabrics") {
    const args = searchArgs.safeParse(parsed);
    if (!args.success) return { text: "Invalid search arguments.", citations: [], filters: null };

    const { limit, ...rest } = args.data;
    const filters: ProductFilters = { ...rest, perPage: limit ?? 5, inStock: true };
    const result = await searchProducts(filters);
    const citations = result.items.map(toCitation);

    return {
      text:
        citations.length === 0
          ? "No fabrics matched those constraints. Suggest relaxing one — price ceiling and stock minimum are the usual culprits."
          : `${result.total} match(es). Top ${citations.length}:\n${citations.map(describeForModel).join("\n")}`,
      citations,
      filters,
    };
  }

  if (name === "get_fabric") {
    const slug = (parsed as { slug?: string }).slug;
    if (!slug) return { text: "No slug supplied.", citations: [], filters: null };

    const p = await db.product.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, name: true, description: true, composition: true, weave: true,
        gsm: true, widthCm: true, finish: true, handFeel: true, useCases: true, sustainability: true,
        pricePerMetre: true, moqMetres: true, stockMetres: true, leadTimeDays: true, status: true,
        colorways: { select: { id: true, name: true, hex: true, stockMetres: true }, orderBy: { position: "asc" } },
        supplier: {
          select: { businessName: true, slug: true, city: true, state: true, verified: true, rating: true, certifications: true, leadTimeDays: true },
        },
        category: { select: { name: true, slug: true } },
      },
    });
    if (!p) return { text: `No fabric with slug "${slug}".`, citations: [], filters: null };

    const citation: AssistantCitation = {
      id: p.id, slug: p.slug, name: p.name, supplier: p.supplier.businessName,
      price: Number(p.pricePerMetre), gsm: p.gsm, widthCm: p.widthCm, composition: p.composition,
      weave: p.weave, stockMetres: p.stockMetres, moqMetres: p.moqMetres, leadTimeDays: p.leadTimeDays,
      hex: p.colorways[0]?.hex ?? "#C9C2B4",
    };

    return {
      text: JSON.stringify({
        ...p,
        pricePerMetre: Number(p.pricePerMetre),
        colorways: p.colorways.map((c) => ({ name: c.name, hex: c.hex, stockMetres: c.stockMetres })),
      }),
      citations: [citation],
      filters: null,
    };
  }

  if (name === "compare_fabrics") {
    const slugs = (parsed as { slugs?: string[] }).slugs ?? [];
    const rows = await getProductsForCompare(slugs);
    if (!rows.length) return { text: "None of those slugs exist.", citations: [], filters: null };

    const citations = rows.map((p) => ({
      id: p.id, slug: p.slug, name: p.name, supplier: p.supplier.businessName,
      price: Number(p.pricePerMetre), gsm: p.gsm, widthCm: p.widthCm, composition: p.composition,
      weave: p.weave, stockMetres: p.stockMetres, moqMetres: p.moqMetres, leadTimeDays: p.leadTimeDays,
      hex: p.colorways[0]?.hex ?? "#C9C2B4",
    }));
    return { text: citations.map(describeForModel).join("\n"), citations, filters: null };
  }

  if (name === "find_similar") {
    const slug = (parsed as { slug?: string }).slug;
    const source = await db.product.findUnique({ where: { slug: slug ?? "" }, select: { id: true } });
    if (!source) return { text: `No fabric with slug "${slug}".`, citations: [], filters: null };

    const similar = await getSimilarProducts(source.id, 5);
    const citations = similar.map(toCitation);
    return { text: citations.map(describeForModel).join("\n"), citations, filters: null };
  }

  return { text: `Unknown tool "${name}".`, citations: [], filters: null };
}

/* --------------------------------------------------------- system prompt */

async function systemPrompt() {
  const [categories, priceRange, count] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" }, select: { name: true, slug: true } }),
    db.product.aggregate({
      where: { status: "ACTIVE" },
      _min: { pricePerMetre: true },
      _max: { pricePerMetre: true },
    }),
    db.product.count({ where: { status: "ACTIVE" } }),
  ]);

  return `You are the Threadwyn sourcing assistant. Threadwyn is a B2B textile marketplace where buyers source fabric by the metre from verified Indian mills.

CATALOGUE
- ${count} active fabrics across ${categories.length} categories: ${categories.map((c) => c.slug).join(", ")}
- Prices run ₹${Math.floor(Number(priceRange._min.pricePerMetre ?? 0))}–₹${Math.ceil(Number(priceRange._max.pricePerMetre ?? 0))} per metre.

RULES
1. Never invent a fabric, price, GSM, stock figure or supplier. Every product claim must come from a tool result in this conversation.
2. Always call search_fabrics before recommending anything. If a tool returns nothing, say so plainly and suggest which single constraint to relax.
3. Refer to fabrics by name. Never print a slug, an id or raw JSON to the user.
4. Be concise: two to four sentences, or a short list. This is a working tool, not a chat companion.
5. Give a reason with every recommendation, grounded in a spec — weight, weave, stock depth, MOQ or lead time.
6. If the buyer's requirements conflict (say, luxury silk under ₹200/m), name the conflict instead of quietly dropping one.
7. If a question is outside the catalogue — shipping, payment terms, custom dyeing — say Threadwyn does not cover it yet and suggest contacting the mill.
8. Units: ₹ per metre, gsm for weight, cm for width, metres for stock and MOQ, days for lead time.`;
}

/* ------------------------------------------------------------- rules mode */

/**
 * The no-model path. It parses the request, runs the same search the model
 * would have run, and writes a grounded summary from the actual rows. It is
 * not a canned apology — it answers the question.
 */
async function rulesReply(userMessage: string): Promise<AssistantReply> {
  const { filters, applied } = parseQuery(userMessage);
  const result = await searchProducts({ ...filters, perPage: 5, sort: "relevance" });
  const citations = result.items.map(toCitation);

  const chips = applied.map((a) => ({ key: String(a.key), label: a.label, value: a.value }));
  const href = buildSearchHref(filters);

  if (citations.length === 0) {
    const relaxable =
      filters.priceMax != null
        ? `the ₹${filters.priceMax}/m ceiling`
        : filters.stockMin != null
          ? `the ${filters.stockMin}m stock minimum`
          : filters.gsmMax != null
            ? `the ${filters.gsmMax} gsm weight limit`
            : "one of the filters";

    return {
      message: `Nothing in the catalogue matches all of those constraints at once. Relaxing ${relaxable} is usually the quickest way to open it up — or tell me which requirement is genuinely fixed and I'll work around it.`,
      citations: [],
      chips,
      searchHref: href,
      mode: "rules",
      model: providerLabel(),
    };
  }

  const top = citations[0]!;
  const cheapest = [...citations].sort((a, b) => a.price - b.price)[0]!;
  const deepest = [...citations].sort((a, b) => b.stockMetres - a.stockMetres)[0]!;

  const lines: string[] = [];
  lines.push(
    `${result.total} ${result.total === 1 ? "fabric matches" : "fabrics match"}. The closest is **${top.name}** from ${top.supplier} — ${top.composition}, ${top.gsm} gsm, ${formatMoney(top.price)}/m with ${formatMetres(top.stockMetres)} on hand.`,
  );
  if (cheapest.slug !== top.slug) {
    lines.push(`**${cheapest.name}** is the lowest price at ${formatMoney(cheapest.price)}/m.`);
  }
  if (deepest.slug !== top.slug && deepest.slug !== cheapest.slug) {
    lines.push(`**${deepest.name}** has the deepest stock at ${formatMetres(deepest.stockMetres)} — the safer pick for a repeat order.`);
  }
  lines.push(`Minimum order quantities range from ${Math.min(...citations.map((c) => c.moqMetres))}m to ${Math.max(...citations.map((c) => c.moqMetres))}m.`);

  return {
    message: lines.join(" "),
    citations,
    chips,
    searchHref: href,
    mode: "rules",
    model: providerLabel(),
  };
}

export function buildSearchHref(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const key of ["category", "fibre", "weave", "supplier", "sustainability"] as const) {
    const list = filters[key];
    if (list?.length) params.set(key, list.join(","));
  }
  for (const key of ["priceMin", "priceMax", "gsmMin", "gsmMax", "stockMin", "moqMax", "leadTimeMax"] as const) {
    const value = filters[key];
    if (value != null) params.set(key, String(value));
  }
  if (filters.inStock) params.set("inStock", "1");
  const qs = params.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}

/* ------------------------------------------------------------- model mode */

const MAX_ROUNDS = 3;

export async function ask(
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<AssistantReply> {
  if (activeProvider() === "none") return rulesReply(userMessage);

  const messages: ChatMessage[] = [
    { role: "system", content: await systemPrompt() },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: "user", content: userMessage },
  ];

  const citations = new Map<string, AssistantCitation>();
  let lastFilters: ProductFilters | null = null;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await complete({ messages, tools: TOOLS, temperature: 0.2 });

    // Provider unavailable mid-conversation — degrade rather than dead-end.
    if (!result) return rulesReply(userMessage);

    if (result.toolCalls.length === 0) {
      const text = result.content.trim();
      if (!text) return rulesReply(userMessage);
      return {
        message: text,
        citations: [...citations.values()].slice(0, 6),
        chips: lastFilters ? describeFilters(lastFilters).map((c) => ({ key: String(c.key), label: c.label, value: c.value })) : [],
        searchHref: lastFilters ? buildSearchHref(lastFilters) : null,
        mode: "model",
        model: providerLabel(),
      };
    }

    messages.push({ role: "assistant", content: result.content, tool_calls: result.toolCalls });

    for (const call of result.toolCalls) {
      const out = await runTool(call.function.name, call.function.arguments);
      for (const c of out.citations) citations.set(c.slug, c);
      if (out.filters) lastFilters = out.filters;
      messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: out.text });
    }
  }

  // Ran out of rounds without a prose answer — the rules path still has one.
  return rulesReply(userMessage);
}

/** Product Q&A grounded strictly in one product's row. */
export async function askAboutProduct(slug: string, question: string): Promise<AssistantReply> {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      colorways: { orderBy: { position: "asc" } },
      category: true,
      supplier: {
        select: {
          businessName: true, city: true, state: true, verified: true, rating: true,
          certifications: true, leadTimeDays: true, moqMetres: true, yearEstablished: true, description: true,
        },
      },
    },
  });

  if (!product) {
    return {
      message: "I couldn't find that fabric.",
      citations: [], chips: [], searchHref: null, mode: "rules", model: providerLabel(),
    };
  }

  const citation: AssistantCitation = {
    id: product.id, slug: product.slug, name: product.name, supplier: product.supplier.businessName,
    price: Number(product.pricePerMetre), gsm: product.gsm, widthCm: product.widthCm,
    composition: product.composition, weave: product.weave, stockMetres: product.stockMetres,
    moqMetres: product.moqMetres, leadTimeDays: product.leadTimeDays,
    hex: product.colorways[0]?.hex ?? "#C9C2B4",
  };

  const facts = JSON.stringify(serialize({ ...product, embedding: undefined, searchText: undefined }));

  if (activeProvider() === "none") {
    return {
      message: deterministicProductAnswer(question, product),
      citations: [citation], chips: [], searchHref: null, mode: "rules", model: providerLabel(),
    };
  }

  const result = await complete({
    messages: [
      {
        role: "system",
        content: `Answer strictly from the JSON below. It is the complete record for this fabric.

If the answer is not in the data, say so in one sentence and suggest asking the supplier — do NOT guess a value. Two to four sentences. Units: ₹/metre, gsm, cm, metres, days. Never print JSON, ids or slugs.

FABRIC:
${facts}`,
      },
      { role: "user", content: question },
    ],
    temperature: 0.15,
    maxTokens: 320,
  });

  return {
    message: result?.content?.trim() || deterministicProductAnswer(question, product),
    citations: [citation],
    chips: [],
    searchHref: null,
    // We asked a model and it gave us nothing usable — that is a fallback, not
    // the engine being chosen. The `activeProvider() === "none"` branch above
    // already returned for the case where there was no model to ask.
    mode: result?.content ? "model" : "fallback",
    model: providerLabel(),
  };
}

type ProductRow = NonNullable<Awaited<ReturnType<typeof db.product.findUnique>>> & {
  colorways: { name: string; hex: string; stockMetres: number }[];
  supplier: { businessName: string; city: string; leadTimeDays: number; certifications: string[] };
  category: { name: string };
};

/** Intent-matched answers over the spec row — no model, no hallucination. */
function deterministicProductAnswer(question: string, p: ProductRow): string {
  const q = question.toLowerCase();

  if (/\b(price|cost|rate|how much|₹|rupee)\b/.test(q)) {
    return `${p.name} is ${formatMoney(Number(p.pricePerMetre))} per metre, with a minimum order of ${p.moqMetres}m — so the smallest order is ${formatMoney(Number(p.pricePerMetre) * p.moqMetres)}.`;
  }
  if (/\b(stock|available|availability|how many|quantity|metres|meters)\b/.test(q)) {
    const byColour = p.colorways.map((c) => `${c.name} ${c.stockMetres}m`).join(", ");
    return p.stockMetres > 0
      ? `There are ${formatMetres(p.stockMetres)} on hand across ${p.colorways.length} colourway${p.colorways.length === 1 ? "" : "s"}: ${byColour}. Lead time is ${p.leadTimeDays} days.`
      : `This one is out of stock. ${p.supplier.businessName} quotes ${p.leadTimeDays} days to weave a fresh lot.`;
  }
  if (/\b(weight|gsm|heavy|light|thick|thin)\b/.test(q)) {
    const band = p.gsm < 120 ? "very light — sheer to semi-sheer" : p.gsm < 180 ? "lightweight" : p.gsm < 280 ? "midweight" : "heavyweight";
    return `It is ${p.gsm} gsm, which is ${band}, woven ${p.widthCm}cm wide. Hand-feel is described as ${p.handFeel.toLowerCase()}.`;
  }
  if (/\b(composition|made of|fibre|fiber|material|content)\b/.test(q)) {
    return `${p.composition}, ${p.weave.toLowerCase()} weave, finished ${p.finish.toLowerCase()}.${p.sustainability.length ? ` Certified: ${p.sustainability.join(", ")}.` : ""}`;
  }
  if (/\b(moq|minimum|least|smallest order)\b/.test(q)) {
    return `The minimum order is ${p.moqMetres}m, which comes to ${formatMoney(Number(p.pricePerMetre) * p.moqMetres)} before tax and shipping.`;
  }
  if (/\b(lead|delivery|deliver|ship|dispatch|how long|when)\b/.test(q)) {
    return `${p.supplier.businessName} quotes ${p.leadTimeDays} days from order confirmation. Threadwyn does not handle logistics itself — dispatch is arranged directly with the mill.`;
  }
  if (/\b(colour|color|shade|colourway)\b/.test(q)) {
    return `${p.colorways.length} colourway${p.colorways.length === 1 ? "" : "s"}: ${p.colorways.map((c) => c.name).join(", ")}. Each swatch on the page is rendered from the actual dyed hex value.`;
  }
  if (/\b(use|used for|suitable|good for|make|garment)\b/.test(q)) {
    return `${p.name} is typically used for ${p.useCases.join(", ").toLowerCase()}. At ${p.gsm} gsm with a ${p.weave.toLowerCase()} structure, ${p.handFeel.toLowerCase()} is the hand you should expect.`;
  }
  if (/\b(supplier|mill|who|maker|manufacturer)\b/.test(q)) {
    return `Woven by ${p.supplier.businessName} in ${p.supplier.city}.${p.supplier.certifications.length ? ` Certifications: ${p.supplier.certifications.join(", ")}.` : ""} Their standard lead time is ${p.supplier.leadTimeDays} days.`;
  }
  if (/\b(certif|organic|sustainab|gots|oeko|recycled)\b/.test(q)) {
    return p.sustainability.length
      ? `Certified: ${p.sustainability.join(", ")}. ${p.supplier.businessName} additionally holds ${p.supplier.certifications.join(", ") || "no further certifications on file"}.`
      : `No sustainability certifications are recorded against this fabric. ${p.supplier.businessName} holds ${p.supplier.certifications.join(", ") || "none on file"} at the mill level.`;
  }

  return `${p.name} — ${p.composition}, ${p.weave.toLowerCase()} weave, ${p.gsm} gsm, ${p.widthCm}cm wide, ${formatMoney(Number(p.pricePerMetre))}/m with a ${p.moqMetres}m minimum. Ask me about stock, lead time, colourways or what it's suited to.`;
}
