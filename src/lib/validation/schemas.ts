import { z } from "zod";

/**
 * Shared contracts. The same schema validates the form in the browser and the
 * request on the server, so a rule can never drift between the two.
 */

/* -------------------------------------------------------------- auth */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  .max(200)
  .toLowerCase();

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(200, "That password is too long.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["BUYER", "SUPPLIER"]),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

/* ------------------------------------------------------------ profiles */

export const buyerProfileSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(160),
  businessType: z.string().trim().min(1, "Choose a business type."),
  industry: z.string().trim().min(1, "Tell us your industry.").max(120),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  categoryInterest: z.array(z.string()).max(12).default([]),
  preferredFabrics: z.array(z.string()).max(12).default([]),
  typicalOrderQty: z.string().trim().min(1, "Choose a typical order size."),
  budgetMin: z.coerce.number().int().min(0).max(100_000).optional().nullable(),
  budgetMax: z.coerce.number().int().min(0).max(100_000).optional().nullable(),
  notes: z.string().trim().max(1200).optional().or(z.literal("")),
  onboardingMode: z.enum(["conversation", "form"]).default("form"),
});

const hoursSchema = z
  .object({ open: z.string(), close: z.string() })
  .nullable();

export const supplierProfileSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(160),
  businessType: z.string().trim().min(1, "Choose a business type."),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  contactEmail: emailSchema,
  contactPhone: z.string().trim().min(6, "Enter a contact number.").max(40),
  addressLine1: z.string().trim().min(3, "Enter your address.").max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1, "Enter a city.").max(120),
  state: z.string().trim().min(1, "Enter a state.").max(120),
  postalCode: z.string().trim().min(4, "Enter a postal code.").max(20),
  country: z.string().trim().max(120).default("India"),
  operatingHours: z
    .object({
      mon: hoursSchema, tue: hoursSchema, wed: hoursSchema,
      thu: hoursSchema, fri: hoursSchema, sat: hoursSchema, sun: hoursSchema,
    })
    .partial()
    .optional(),
  categories: z.array(z.string()).max(12).default([]),
  fabricTypes: z.array(z.string()).max(16).default([]),
  moqMetres: z.coerce.number().int().min(1, "MOQ must be at least 1 metre.").max(100_000),
  leadTimeDays: z.coerce.number().int().min(1, "Lead time must be at least a day.").max(365),
  yearEstablished: z.coerce.number().int().min(1800).max(new Date().getFullYear()).optional().nullable(),
  certifications: z.array(z.string()).max(16).default([]),
  onboardingMode: z.enum(["conversation", "form"]).default("form"),
});

/* ------------------------------------------------------------ products */

export const weaveEnum = z.enum([
  "PLAIN", "TWILL", "SATIN", "JACQUARD", "HERRINGBONE",
  "JERSEY", "RIB", "DOBBY", "CANVAS", "CREPE",
]);

export const colorwaySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name the colourway.").max(60),
  hex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, "Use a 6-digit hex value, e.g. #1E2A44."),
  stockMetres: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const productSchema = z.object({
  name: z.string().trim().min(3, "Give the fabric a name.").max(160),
  categorySlug: z.string().trim().min(1, "Choose a category."),
  description: z.string().trim().min(20, "Write at least a sentence or two.").max(4000),
  composition: z.string().trim().min(3, "State the fibre composition.").max(160),
  fibres: z.array(z.string()).min(1, "Select at least one fibre.").max(8),
  weave: weaveEnum,
  gsm: z.coerce.number().int().min(10, "GSM looks too low.").max(2000),
  widthCm: z.coerce.number().int().min(20, "Width looks too narrow.").max(500),
  finish: z.string().trim().min(2, "Describe the finish.").max(160),
  handFeel: z.string().trim().min(2, "Describe the hand-feel.").max(160),
  useCases: z.array(z.string().trim().max(80)).max(10).default([]),
  sustainability: z.array(z.string().trim().max(80)).max(10).default([]),
  pricePerMetre: z.coerce.number().min(1, "Price must be above zero.").max(1_000_000),
  compareAtPrice: z.coerce.number().min(0).max(1_000_000).optional().nullable(),
  moqMetres: z.coerce.number().int().min(1, "MOQ must be at least 1 metre.").max(1_000_000),
  leadTimeDays: z.coerce.number().int().min(1).max(365),
  status: z.enum(["DRAFT", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED"]).default("ACTIVE"),
  featured: z.boolean().default(false),
  colorways: z.array(colorwaySchema).min(1, "Add at least one colourway.").max(16),
  images: z
    .array(z.object({ url: z.string().min(1), alt: z.string().max(200).default("") }))
    .max(8)
    .default([]),
});

export const stockUpdateSchema = z.object({
  colorways: z.array(z.object({ id: z.string(), stockMetres: z.coerce.number().int().min(0).max(1_000_000) })),
});

/* ---------------------------------------------------------------- cart */

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  colorwayId: z.string().nullable().optional(),
  quantityMetres: z.coerce.number().int().min(1, "Quantity must be at least 1 metre.").max(1_000_000),
});

export const cartUpdateSchema = z.object({
  quantityMetres: z.coerce.number().int().min(1).max(1_000_000),
});

/* -------------------------------------------------------------- orders */

export const checkoutSchema = z.object({
  shippingName: z.string().trim().min(2, "Enter a contact name.").max(160),
  shippingCompany: z.string().trim().max(160).optional().or(z.literal("")),
  shippingPhone: z.string().trim().min(6, "Enter a phone number.").max(40),
  shippingEmail: emailSchema,
  shippingLine1: z.string().trim().min(3, "Enter the delivery address.").max(200),
  shippingLine2: z.string().trim().max(200).optional().or(z.literal("")),
  shippingCity: z.string().trim().min(1, "Enter a city.").max(120),
  shippingState: z.string().trim().min(1, "Enter a state.").max(120),
  shippingPostalCode: z.string().trim().min(4, "Enter a postal code.").max(20),
  shippingCountry: z.string().trim().max(120).default("India"),
  deliveryNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  /**
   * The total the buyer actually saw on the review step.
   *
   * Without it the server has no idea what the checkout page was showing, so a
   * cart edited in another tab is ordered at the new figure without anyone
   * noticing — the review said 40 m, the order is 50 m, and every layer behaved
   * correctly on its own. This is the buyer's half of the agreement.
   *
   * Optional: a request that omits it is accepted and simply skips the check,
   * so an older client can never be locked out by this field appearing.
   */
  expectedTotal: z.number().nonnegative().optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "PREPARING", "READY_FOR_DISPATCH", "COMPLETED", "CANCELLED"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  expectedReadyAt: z.string().datetime().optional().nullable(),
});

/* ------------------------------------------------------------------ ai */

export const aiChatSchema = z.object({
  message: z.string().trim().min(1, "Say something.").max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([]),
  productSlug: z.string().max(200).optional(),
});

export const aiSearchSchema = z.object({
  query: z.string().trim().min(1).max(500),
});

/**
 * A fabric photo, inline.
 *
 * The image arrives as a data URI rather than multipart because it is never
 * stored — it goes to the model and is dropped, so there is nothing to stream
 * to disk. The browser downsizes and re-encodes before posting; the ceiling
 * here is the backstop, sized so a compressed 768px WebP always fits and a
 * full-resolution phone photo never does.
 */
export const aiFabricScanSchema = z.object({
  image: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp|avif);base64,[A-Za-z0-9+/=]+$/, "Upload a JPEG, PNG, WebP or AVIF image.")
    .max(1_400_000, "That image is too large. Try a smaller photo."),
  /** Dominant colour, measured in the browser. */
  measured: z.object({
    r: z.number().int().min(0).max(255),
    g: z.number().int().min(0).max(255),
    b: z.number().int().min(0).max(255),
  }),
});

export const aiOnboardingSchema = z.object({
  role: z.enum(["BUYER", "SUPPLIER"]),
  transcript: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type BuyerProfileInput = z.infer<typeof buyerProfileSchema>;
export type SupplierProfileInput = z.infer<typeof supplierProfileSchema>;
