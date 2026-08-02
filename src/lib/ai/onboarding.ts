import "server-only";

import { z } from "zod";

import { activeProvider, complete, parseJsonLoose, providerLabel } from "./provider";

/**
 * Conversational onboarding.
 *
 * The *questions* are a fixed script, not model-generated — an onboarding flow
 * that can wander is a liability, and a scripted flow works identically with or
 * without a model. What AI does here is the genuinely tedious part: turning
 * free-form answers ("we're a small womenswear label in Bangalore, mostly linen
 * and silk, orders around a thousand metres, nothing over ₹800") into a
 * structured profile.
 *
 * Nothing is saved from this directly. The extraction is returned to the client
 * as an editable draft with a confidence note, the user corrects it, and only
 * then does the normal validated profile endpoint write to the database.
 * AI proposes; the user disposes.
 */

export const BUYER_SCRIPT = [
  {
    key: "business",
    prompt: "What's your business called, and what do you make?",
    hint: "e.g. “Marigold Apparel — small-batch womenswear out of Bengaluru”",
  },
  {
    key: "materials",
    prompt: "What sort of cloth are you usually buying?",
    hint: "Fibres, categories, weights — however you'd describe it to a colleague.",
  },
  {
    key: "volume",
    prompt: "Roughly what quantity do you order at a time, and what's your ceiling on price per metre?",
    hint: "e.g. “usually 500 to 2000 metres, nothing over ₹800”",
  },
  {
    key: "extra",
    prompt: "Anything else that matters — certifications, lead times, things you avoid?",
    hint: "Optional. Say “nothing else” to skip.",
  },
] as const;

export const SUPPLIER_SCRIPT = [
  {
    key: "business",
    prompt: "Tell me about your mill — the name, what kind of operation it is, and where you're based.",
    hint: "e.g. “Coimbatore Weaving Co., a cotton mill in Coimbatore, running since 1974”",
  },
  {
    key: "capability",
    prompt: "What do you weave or hold, and what are you best known for?",
    hint: "Categories, fibres, any certifications.",
  },
  {
    key: "terms",
    prompt: "What's your usual minimum order and lead time?",
    hint: "e.g. “300 metres minimum, about two weeks”",
  },
  {
    key: "contact",
    prompt: "Finally — a contact email, phone number and your address.",
    hint: "This is what buyers use to reach you about an order.",
  },
] as const;

const buyerExtraction = z.object({
  businessName: z.string().optional(),
  businessType: z.enum(["BRAND", "MANUFACTURER", "BOUTIQUE", "EXPORTER", "RETAILER", "OTHER"]).optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  categoryInterest: z.array(z.string()).optional(),
  preferredFabrics: z.array(z.string()).optional(),
  typicalOrderQty: z.enum(["under-500", "500-2000", "2000-10000", "10000-plus"]).optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  notes: z.string().optional(),
});

const supplierExtraction = z.object({
  businessName: z.string().optional(),
  businessType: z.enum(["MILL", "HANDLOOM", "WHOLESALER", "CONVERTER", "AGENT"]).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  categories: z.array(z.string()).optional(),
  fabricTypes: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  moqMetres: z.number().optional(),
  leadTimeDays: z.number().optional(),
  yearEstablished: z.number().optional(),
});

export type BuyerDraft = z.infer<typeof buyerExtraction>;
export type SupplierDraft = z.infer<typeof supplierExtraction>;

const CATEGORY_SLUGS = [
  "shirting", "suiting", "denim", "linen", "silk-satin", "knits-jersey",
  "performance", "handloom-khadi", "upholstery", "canvas-workwear", "lining", "sheers-voile",
];
const FIBRES = ["cotton", "linen", "silk", "wool", "polyester", "viscose", "elastane", "nylon", "cupro", "zari"];
const CERTS = [
  "GOTS", "OEKO-TEX Standard 100", "GRS Recycled", "European Flax",
  "BCI Cotton", "Fairtrade", "Handloom Mark", "Silk Mark", "ISO 9001",
];

const BUYER_PROMPT = `Extract a structured buyer profile from this onboarding conversation. Reply with JSON only, omitting anything the person did not actually say. Never invent a value.

  businessName      their company name
  businessType      BRAND | MANUFACTURER | BOUTIQUE | EXPORTER | RETAILER | OTHER
  industry          what they make, e.g. "Womenswear", "Corporate uniforms"
  city              where they are based
  categoryInterest  slugs from: ${CATEGORY_SLUGS.join(", ")}
  preferredFabrics  from: ${FIBRES.join(", ")}
  typicalOrderQty   under-500 | 500-2000 | 2000-10000 | 10000-plus
  budgetMin         INR per metre, lower bound
  budgetMax         INR per metre, upper bound
  notes             anything else worth remembering, one or two sentences`;

const SUPPLIER_PROMPT = `Extract a structured supplier profile from this onboarding conversation. Reply with JSON only, omitting anything the person did not actually say. Never invent a value — especially not contact details or an address.

  businessName     the mill's name
  businessType     MILL | HANDLOOM | WHOLESALER | CONVERTER | AGENT
  tagline          one short line on what they're known for
  description      two or three sentences on capability, drawn only from what they said
  contactEmail     only if they gave one
  contactPhone     only if they gave one
  addressLine1     street address, only if given
  city, state, postalCode
  categories       slugs from: ${CATEGORY_SLUGS.join(", ")}
  fabricTypes      from: ${FIBRES.join(", ")}, blend
  certifications   from: ${CERTS.join(", ")}
  moqMetres        minimum order in metres
  leadTimeDays     lead time in days
  yearEstablished  founding year`;

export async function extractProfile(
  role: "BUYER" | "SUPPLIER",
  transcript: { role: "user" | "assistant"; content: string }[],
) {
  const conversation = transcript
    .map((m) => `${m.role === "user" ? "Them" : "Us"}: ${m.content}`)
    .join("\n");

  const answers = transcript.filter((m) => m.role === "user").map((m) => m.content);
  const rules = role === "BUYER" ? rulesBuyer(answers) : rulesSupplier(answers);

  if (activeProvider() === "none") {
    return { draft: rules, mode: "rules" as const, model: providerLabel() };
  }

  const result = await complete({
    messages: [
      { role: "system", content: role === "BUYER" ? BUYER_PROMPT : SUPPLIER_PROMPT },
      { role: "user", content: conversation },
    ],
    temperature: 0,
    maxTokens: 600,
    timeoutMs: 20_000,
  });

  const raw = result ? parseJsonLoose<unknown>(result.content) : null;
  const schema = role === "BUYER" ? buyerExtraction : supplierExtraction;
  const parsed = raw ? schema.safeParse(raw) : null;

  if (!parsed?.success) {
    return { draft: rules, mode: "rules" as const, model: providerLabel() };
  }

  // The model fills gaps; the rule pass wins where both found something, since
  // a regex on "₹800" is more reliable than a sample from a 7B model.
  return {
    draft: { ...parsed.data, ...stripEmpty(rules) } as BuyerDraft & SupplierDraft,
    mode: "model" as const,
    model: providerLabel(),
  };
}

function stripEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && !v.trim()) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

/* ------------------------------------------------------------ rules pass */

function matchList(text: string, options: string[]): string[] {
  const lower = text.toLowerCase();
  return options.filter((o) => lower.includes(o.toLowerCase().replace(/-/g, " ")) || lower.includes(o.toLowerCase()));
}

function firstNumber(text: string, pattern: RegExp): number | undefined {
  const m = text.match(pattern);
  if (!m?.[1]) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function rulesBuyer(answers: string[]): BuyerDraft {
  const all = answers.join(" \n ");
  const lower = all.toLowerCase();

  const qtyHint = firstNumber(lower, /(\d[\d,]*)\s*(?:m\b|metres?|meters?)/);
  const typicalOrderQty =
    qtyHint == null
      ? undefined
      : qtyHint < 500
        ? ("under-500" as const)
        : qtyHint < 2000
          ? ("500-2000" as const)
          : qtyHint < 10_000
            ? ("2000-10000" as const)
            : ("10000-plus" as const);

  const budgetMax =
    firstNumber(lower, /(?:under|below|max|upto|up to|nothing over|no more than|ceiling of)\s*₹?\s*(\d[\d,]*)/) ??
    undefined;
  const budgetMin = firstNumber(lower, /(?:from|above|over|at least)\s*₹?\s*(\d[\d,]*)\s*(?:per|a|\/)\s*(?:m|metre)/);

  const businessType = /\bbrand\b|\blabel\b/.test(lower)
    ? ("BRAND" as const)
    : /manufactur|factory|garment unit|cmt/.test(lower)
      ? ("MANUFACTURER" as const)
      : /boutique|atelier|tailor/.test(lower)
        ? ("BOUTIQUE" as const)
        : /export/.test(lower)
          ? ("EXPORTER" as const)
          : /retail|store|shop/.test(lower)
            ? ("RETAILER" as const)
            : undefined;

  // The first answer is "name and what you make", so the name is usually the
  // clause before a dash or comma.
  const first = answers[0] ?? "";
  const nameMatch = first.match(/^\s*(?:we(?:'re| are)\s+)?([A-Z][\w&.\- ]{2,60}?)\s*(?:[—–-]|,|\.|$)/);

  return stripEmpty({
    businessName: nameMatch?.[1]?.trim(),
    businessType,
    industry: /womenswear|menswear|kidswear|uniform|home|activewear|bridal/i.exec(all)?.[0],
    city: /\b(?:in|from|based in|out of)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/.exec(all)?.[1],
    categoryInterest: matchList(all, CATEGORY_SLUGS),
    preferredFabrics: matchList(all, FIBRES),
    typicalOrderQty,
    budgetMin,
    budgetMax,
    notes: answers[3] && !/^\s*(no|nothing|none|nope|skip)\b/i.test(answers[3]) ? answers[3].trim() : undefined,
  }) as BuyerDraft;
}

function rulesSupplier(answers: string[]): SupplierDraft {
  const all = answers.join(" \n ");
  const lower = all.toLowerCase();

  const businessType = /handloom|pit loom|artisan|collective/.test(lower)
    ? ("HANDLOOM" as const)
    : /wholesal|stockist|trader/.test(lower)
      ? ("WHOLESALER" as const)
      : /convert|finish|process house/.test(lower)
        ? ("CONVERTER" as const)
        : /\bagent\b|represent/.test(lower)
          ? ("AGENT" as const)
          : /mill|weav|knit|loom/.test(lower)
            ? ("MILL" as const)
            : undefined;

  const first = answers[0] ?? "";
  const nameMatch = first.match(/^\s*(?:we(?:'re| are)\s+)?([A-Z][\w&.\- ]{2,60}?)\s*(?:[—–-]|,|\.|$)/);

  return stripEmpty({
    businessName: nameMatch?.[1]?.trim(),
    businessType,
    city: /\b(?:in|from|based in|out of|outside)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/.exec(all)?.[1],
    contactEmail: /[\w.+-]+@[\w-]+\.[\w.]+/.exec(all)?.[0],
    contactPhone: /(\+?\d[\d\s-]{8,15}\d)/.exec(all)?.[1]?.trim(),
    categories: matchList(all, CATEGORY_SLUGS),
    fabricTypes: matchList(all, [...FIBRES, "blend"]),
    certifications: CERTS.filter((c) => lower.includes(c.toLowerCase().split(" ")[0]!)),
    moqMetres: firstNumber(lower, /(\d[\d,]*)\s*(?:m\b|metres?|meters?)\s*(?:minimum|moq|min)/) ??
      firstNumber(lower, /(?:minimum|moq|min)\s*(?:of|is)?\s*(\d[\d,]*)/),
    leadTimeDays:
      firstNumber(lower, /(\d+)\s*(?:days?|working days?)/) ??
      (/(\d+)\s*weeks?/.exec(lower) ? Number(/(\d+)\s*weeks?/.exec(lower)![1]) * 7 : undefined),
    yearEstablished: firstNumber(lower, /\b(?:since|est(?:ablished)?\.?|from)\s*(\d{4})/),
    description: answers[1]?.trim(),
  }) as SupplierDraft;
}
