/**
 * Catalogue seed. The specs here are realistic: GSM, widths, MOQs, lead times
 * and price-per-metre are all in the range you'd actually be quoted by an
 * Indian mill. That matters — a marketplace demo full of "Product 1, ₹100"
 * tells a judge nothing about whether the filters, comparison and AI grounding
 * do useful work.
 */

export type Weave =
  | "PLAIN" | "TWILL" | "SATIN" | "JACQUARD" | "HERRINGBONE"
  | "JERSEY" | "RIB" | "DOBBY" | "CANVAS" | "CREPE";

export const CATEGORIES = [
  {
    slug: "shirting",
    name: "Shirting",
    accentHex: "#5A7FA8",
    description: "Poplins, oxfords, chambrays and dobbies for formal and casual shirts.",
    blurb: "Fine-count cotton wovens between 70 and 160 gsm.",
    featured: true,
  },
  {
    slug: "suiting",
    name: "Suiting & Tailoring",
    accentHex: "#4A4B58",
    description: "Worsted wools, poly-viscose blends and structured twills for tailored garments.",
    blurb: "Structured cloth that holds a press and a shoulder.",
    featured: true,
  },
  {
    slug: "denim",
    name: "Denim",
    accentHex: "#2A3A5C",
    description: "Selvedge, stretch and lightweight denims from 8oz to 14oz.",
    blurb: "Indigo warp, undyed weft, twill line running right.",
    featured: true,
  },
  {
    slug: "linen",
    name: "Linen",
    accentHex: "#9A8C6A",
    description: "European and Indian flax in pure and blended constructions.",
    blurb: "Breathable, slubby, and better after every wash.",
    featured: true,
  },
  {
    slug: "silk-satin",
    name: "Silk & Satin",
    accentHex: "#8E5A6B",
    description: "Mulberry charmeuse, dupioni, crepe de chine and woven brocade.",
    blurb: "Fluid drape and directional sheen.",
    featured: true,
  },
  {
    slug: "knits-jersey",
    name: "Knits & Jersey",
    accentHex: "#5C7A5E",
    description: "Single jersey, interlock, rib and French terry for tees and loungewear.",
    blurb: "Interlooped, stretchy, soft against skin.",
    featured: true,
  },
  {
    slug: "performance",
    name: "Performance",
    accentHex: "#3E6E82",
    description: "Moisture-managing polyester, spandex blends and engineered mesh.",
    blurb: "Built to move, wick and recover.",
  },
  {
    slug: "handloom-khadi",
    name: "Handloom & Khadi",
    accentHex: "#A8763E",
    description: "Hand-spun, hand-woven cloth from artisan clusters.",
    blurb: "Irregular by hand, not by accident.",
    featured: true,
  },
  {
    slug: "upholstery",
    name: "Upholstery & Home",
    accentHex: "#7A5344",
    description: "Heavyweight wovens, velvets and chenilles rated for furnishing.",
    blurb: "High rub counts and dimensional stability.",
  },
  {
    slug: "canvas-workwear",
    name: "Canvas & Workwear",
    accentHex: "#6B6247",
    description: "Cotton duck, waxed canvas and ripstop for bags and workwear.",
    blurb: "Heavy, honest, hard to tear.",
  },
  {
    slug: "lining",
    name: "Lining",
    accentHex: "#6E6A7A",
    description: "Cupro, viscose and taffeta linings that slide cleanly over shell fabrics.",
    blurb: "The layer nobody sees and everybody feels.",
  },
  {
    slug: "sheers-voile",
    name: "Sheers & Voile",
    accentHex: "#93A3A8",
    description: "Voiles, organzas and mulls for layering, lining and curtains.",
    blurb: "Light enough to read through.",
  },
] as const;

export const SUPPLIERS = [
  {
    slug: "coimbatore-weaving",
    businessName: "Coimbatore Weaving Co.",
    businessType: "MILL",
    tagline: "Fine-count cotton shirting since 1974",
    description:
      "A vertically integrated cotton mill in the Kongu belt running 180 air-jet looms. We spin, weave and finish in-house, which is why our lot-to-lot shade variance stays inside a 1.5 delta-E band. Best known for compact-yarn poplins and two-ply oxfords.",
    contactEmail: "sales@coimbatoreweaving.in",
    contactPhone: "+91 422 4471 200",
    addressLine1: "Plot 42, SIDCO Industrial Estate",
    addressLine2: "Kurichi",
    city: "Coimbatore",
    state: "Tamil Nadu",
    postalCode: "641021",
    categories: ["shirting", "sheers-voile", "lining"],
    fabricTypes: ["cotton", "cotton-blend"],
    moqMetres: 300,
    leadTimeDays: 12,
    yearEstablished: 1974,
    certifications: ["OEKO-TEX Standard 100", "BCI Cotton", "ISO 9001"],
    verified: true,
    rating: 4.8,
    ratingCount: 214,
    hours: { standard: "09:00-18:00", sat: "09:00-14:00" },
  },
  {
    slug: "bhiwandi-loomworks",
    businessName: "Bhiwandi Loomworks",
    businessType: "MILL",
    tagline: "Suiting cloth for the Indian tailoring trade",
    description:
      "Three generations of powerloom weaving outside Mumbai. We specialise in poly-viscose and wool-blend suiting engineered for humid climates — lighter weights that still hold a crease through a Mumbai monsoon.",
    contactEmail: "orders@bhiwandiloomworks.com",
    contactPhone: "+91 2522 268 940",
    addressLine1: "Gala 7-9, Mandai Compound",
    addressLine2: "Kalyan Road",
    city: "Bhiwandi",
    state: "Maharashtra",
    postalCode: "421302",
    categories: ["suiting", "lining"],
    fabricTypes: ["wool", "polyester", "viscose", "blend"],
    moqMetres: 200,
    leadTimeDays: 14,
    yearEstablished: 1988,
    certifications: ["ISO 9001"],
    verified: true,
    rating: 4.5,
    ratingCount: 138,
    hours: { standard: "10:00-19:00", sat: "10:00-16:00" },
  },
  {
    slug: "kutch-handloom",
    businessName: "Kutch Handloom Collective",
    businessType: "HANDLOOM",
    tagline: "Artisan-woven cloth from 60 Bhuj families",
    description:
      "A producer collective of sixty weaving families across Bhuj and Bhujodi. Every metre is hand-spun and pit-loom woven. Slub, shade drift and small width variance are inherent to the process — we quote them up front rather than pretending otherwise.",
    contactEmail: "weave@kutchhandloom.org",
    contactPhone: "+91 2832 224 118",
    addressLine1: "Bhujodi Weavers Road",
    city: "Bhuj",
    state: "Gujarat",
    postalCode: "370020",
    categories: ["handloom-khadi", "linen", "upholstery"],
    fabricTypes: ["cotton", "wool", "silk"],
    moqMetres: 50,
    leadTimeDays: 24,
    yearEstablished: 2009,
    certifications: ["Handloom Mark", "GI Kutch Weaving", "Fairtrade"],
    verified: true,
    rating: 4.9,
    ratingCount: 87,
    hours: { standard: "09:30-17:30", sat: "09:30-13:00" },
  },
  {
    slug: "ludhiana-knit-mills",
    businessName: "Ludhiana Knit Mills",
    businessType: "MILL",
    tagline: "Circular knits, dyed and finished in-house",
    description:
      "Forty-two circular knitting machines and a soft-flow dyehouse. We hold jersey, interlock, rib and terry in greige so standard shades ship in under a week. Compaction is controlled to keep residual shrinkage under 5%.",
    contactEmail: "hello@ludhianaknit.in",
    contactPhone: "+91 161 250 7788",
    addressLine1: "B-118, Focal Point Phase VI",
    city: "Ludhiana",
    state: "Punjab",
    postalCode: "141010",
    categories: ["knits-jersey", "performance"],
    fabricTypes: ["cotton", "polyester", "elastane", "blend"],
    moqMetres: 150,
    leadTimeDays: 8,
    yearEstablished: 2001,
    certifications: ["OEKO-TEX Standard 100", "GRS Recycled"],
    verified: true,
    rating: 4.6,
    ratingCount: 302,
    hours: { standard: "09:00-18:00", sat: "09:00-15:00" },
  },
  {
    slug: "surat-silk-house",
    businessName: "Surat Silk House",
    businessType: "WHOLESALER",
    tagline: "Mulberry silk and satin, cut to order",
    description:
      "Surat's largest independent silk stockist. We hold mulberry charmeuse, dupioni, crepe de chine and habotai across 60 standing shades, and cut from stock without an MOQ penalty on sampling lengths.",
    contactEmail: "trade@suratsilkhouse.com",
    contactPhone: "+91 261 246 3311",
    addressLine1: "Shop 214-218, Millennium Textile Market",
    addressLine2: "Ring Road",
    city: "Surat",
    state: "Gujarat",
    postalCode: "395002",
    categories: ["silk-satin", "lining", "sheers-voile"],
    fabricTypes: ["silk", "viscose", "polyester"],
    moqMetres: 30,
    leadTimeDays: 6,
    yearEstablished: 1996,
    certifications: ["Silk Mark"],
    verified: true,
    rating: 4.4,
    ratingCount: 176,
    hours: { standard: "10:00-20:00", sun: null },
  },
  {
    slug: "erode-linen",
    businessName: "Erode Linen Company",
    businessType: "MILL",
    tagline: "European flax, woven in Tamil Nadu",
    description:
      "We import Normandy and Belgian flax tow and weave it on 32 rapier looms. Pure linen from 120 to 280 gsm, plus linen-cotton and linen-viscose blends for buyers who want the look with less creasing.",
    contactEmail: "export@erodelinen.com",
    contactPhone: "+91 424 227 6650",
    addressLine1: "SF 221/3, Perundurai Road",
    city: "Erode",
    state: "Tamil Nadu",
    postalCode: "638011",
    categories: ["linen", "shirting", "upholstery"],
    fabricTypes: ["linen", "cotton", "viscose", "blend"],
    moqMetres: 250,
    leadTimeDays: 16,
    yearEstablished: 2005,
    certifications: ["European Flax", "OEKO-TEX Standard 100", "GOTS"],
    verified: true,
    rating: 4.7,
    ratingCount: 121,
    hours: { standard: "09:00-18:00", sat: "09:00-13:00" },
  },
  {
    slug: "ahmedabad-denim",
    businessName: "Ahmedabad Denim Works",
    businessType: "MILL",
    tagline: "Rope-dyed indigo, 8oz to 14oz",
    description:
      "Rope-dyeing and slasher lines feeding 60 projectile looms, plus four shuttle looms kept running for selvedge production. We run our own laundry, so wash-down references ship with every hanger.",
    contactEmail: "sales@ahmedabaddenim.in",
    contactPhone: "+91 79 2754 9020",
    addressLine1: "Survey 118, Narol-Aslali Highway",
    city: "Ahmedabad",
    state: "Gujarat",
    postalCode: "382405",
    categories: ["denim", "canvas-workwear"],
    fabricTypes: ["cotton", "elastane", "blend"],
    moqMetres: 400,
    leadTimeDays: 18,
    yearEstablished: 1992,
    certifications: ["OEKO-TEX Standard 100", "ZDHC Compliant"],
    verified: true,
    rating: 4.5,
    ratingCount: 198,
    hours: { standard: "09:30-18:30", sat: "09:30-14:00" },
  },
  {
    slug: "varanasi-atelier",
    businessName: "Varanasi Textile Atelier",
    businessType: "HANDLOOM",
    tagline: "Jacquard brocade on jala and jacquard looms",
    description:
      "A Varanasi weaving house working figured silk — kadhwa brocade, tanchoi and tissue — on both traditional jala and mechanical jacquard heads. Custom motif development from artwork takes about three weeks.",
    contactEmail: "atelier@varanasitextile.in",
    contactPhone: "+91 542 245 1170",
    addressLine1: "S-14/16 Peeli Kothi",
    addressLine2: "Madanpura",
    city: "Varanasi",
    state: "Uttar Pradesh",
    postalCode: "221001",
    categories: ["silk-satin", "handloom-khadi", "upholstery"],
    fabricTypes: ["silk", "zari", "cotton"],
    moqMetres: 40,
    leadTimeDays: 28,
    yearEstablished: 1961,
    certifications: ["Handloom Mark", "GI Banaras Brocade", "Silk Mark"],
    verified: true,
    rating: 4.9,
    ratingCount: 64,
    hours: { standard: "10:00-18:00", sun: null },
  },
] as const;

/* --------------------------------------------------------------- palettes */

const C = {
  optic: ["Optic White", "#F7F5F0"],
  ecru: ["Ecru", "#E7DECC"],
  natural: ["Natural", "#DDD3C0"],
  bone: ["Bone", "#E2D9C9"],
  sand: ["Sand", "#CBB48C"],
  wheat: ["Wheat", "#D6C29A"],
  camel: ["Camel", "#B08D5E"],
  tobacco: ["Tobacco", "#7B5A38"],
  chocolate: ["Chocolate", "#4A3428"],
  espresso: ["Espresso", "#362519"],
  ink: ["Ink Black", "#1A1B1F"],
  charcoal: ["Charcoal", "#3A3A3C"],
  graphite: ["Graphite", "#4C4D53"],
  slate: ["Slate", "#5A6470"],
  silver: ["Silver Grey", "#B7B8B5"],
  navy: ["Navy", "#1E2A44"],
  midnight: ["Midnight", "#161C2B"],
  indigo: ["Raw Indigo", "#2A3A5C"],
  washIndigo: ["Washed Indigo", "#5A6E92"],
  sky: ["Sky", "#A9C0D4"],
  powder: ["Powder Blue", "#BDCEDA"],
  cornflower: ["Cornflower", "#6E86AE"],
  teal: ["Deep Teal", "#1F5C5C"],
  emerald: ["Emerald", "#175D45"],
  forest: ["Forest", "#22462F"],
  sage: ["Sage", "#9BA88C"],
  olive: ["Olive", "#5B603D"],
  moss: ["Moss", "#4E5A3E"],
  ochre: ["Ochre", "#C0872E"],
  mustard: ["Mustard", "#C39A38"],
  saffron: ["Saffron", "#D9922B"],
  terracotta: ["Terracotta", "#B0603F"],
  rust: ["Rust", "#9C4A2A"],
  brick: ["Brick", "#8E3B2C"],
  clay: ["Clay", "#B57A5C"],
  wine: ["Wine", "#6B2233"],
  oxblood: ["Oxblood", "#4A1720"],
  blush: ["Blush", "#E3BFB4"],
  rose: ["Dusty Rose", "#C98B85"],
  lilac: ["Lilac", "#B0A3C4"],
  aubergine: ["Aubergine", "#4A3350"],
  ivory: ["Ivory", "#F0E9D8"],
  champagne: ["Champagne", "#DCC9A6"],
  gold: ["Antique Gold", "#B08A3C"],
} as const;

type ColorKey = keyof typeof C;

export type SeedProduct = {
  supplier: string;
  category: string;
  name: string;
  description: string;
  composition: string;
  fibres: string[];
  weave: Weave;
  gsm: number;
  widthCm: number;
  finish: string;
  handFeel: string;
  useCases: string[];
  sustainability?: string[];
  price: number;
  compareAt?: number;
  moq: number;
  stock: number;
  leadTime: number;
  featured?: boolean;
  status?: "ACTIVE" | "DRAFT" | "OUT_OF_STOCK";
  colors: ColorKey[];
};

export const PRODUCTS: SeedProduct[] = [
  /* ------------------------------------------------------------ shirting */
  {
    supplier: "coimbatore-weaving", category: "shirting",
    name: "Compact Cotton Poplin 120",
    description:
      "A 2/100s compact-yarn poplin with a clean, dry face and almost no surface hair. The compact spinning removes protruding fibres before weaving, which is why it takes a press so sharply and resists pilling at the collar fold.",
    composition: "100% Compact Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 120, widthCm: 150, finish: "Mercerised, sanforised", handFeel: "Crisp, dry, smooth",
    useCases: ["Formal shirts", "Blouses", "Uniform shirting"],
    sustainability: ["BCI Cotton", "OEKO-TEX Standard 100"],
    price: 238, moq: 300, stock: 8400, leadTime: 12, featured: true,
    colors: ["optic", "sky", "powder", "navy", "charcoal", "blush"],
  },
  {
    supplier: "coimbatore-weaving", category: "shirting",
    name: "Two-Ply Oxford 150",
    description:
      "Classic basketweave oxford in a 2/60s two-ply construction. Heavier and more textured than poplin, with the slight lustre that comes from mercerising a plied yarn. Softens noticeably after three washes without losing body.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "CANVAS",
    gsm: 150, widthCm: 150, finish: "Mercerised, pre-shrunk", handFeel: "Textured, substantial",
    useCases: ["Button-down shirts", "Casual shirting", "Overshirts"],
    sustainability: ["BCI Cotton"],
    price: 276, moq: 300, stock: 5200, leadTime: 12, featured: true,
    colors: ["optic", "sky", "ecru", "navy", "sage", "wine"],
  },
  {
    supplier: "coimbatore-weaving", category: "shirting",
    name: "Indigo Chambray 130",
    description:
      "Indigo-dyed warp against a white weft gives chambray its characteristic heathered blue. Plain weave, so it stays lighter and softer than a denim of the same weight, and it fades gently at the seams rather than blowing out.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 130, widthCm: 148, finish: "Enzyme washed", handFeel: "Soft, slightly slubby",
    useCases: ["Casual shirts", "Dresses", "Workwear shirting"],
    price: 254, moq: 300, stock: 3600, leadTime: 12,
    colors: ["washIndigo", "indigo", "slate"],
  },
  {
    supplier: "coimbatore-weaving", category: "shirting",
    name: "Dobby Pinpoint 125",
    description:
      "A small geometric dobby figure woven into a pinpoint ground. Reads as a solid from two metres away and reveals its texture up close — the standard trick for adding interest to a formal shirt without breaking a dress code.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "DOBBY",
    gsm: 125, widthCm: 150, finish: "Mercerised, easy-care", handFeel: "Crisp with fine relief",
    useCases: ["Formal shirts", "Occasion shirting"],
    price: 289, moq: 300, stock: 2400, leadTime: 14,
    colors: ["optic", "ivory", "sky", "silver", "navy"],
  },
  {
    supplier: "coimbatore-weaving", category: "shirting",
    name: "End-on-End 110",
    description:
      "Alternating coloured and white warp ends produce a fine chambray-like mottle at very low weight. Popular for summer formals where a solid poplin would read too heavy.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 110, widthCm: 150, finish: "Mercerised", handFeel: "Light, cool, crisp",
    useCases: ["Summer shirts", "Resort shirting"],
    price: 246, moq: 300, stock: 4100, leadTime: 12,
    colors: ["sky", "powder", "sage", "blush", "silver"],
  },
  {
    supplier: "coimbatore-weaving", category: "shirting",
    name: "Cotton Seersucker 115",
    description:
      "Differential warp tension puckers alternating stripes so the cloth stands off the skin. That air gap is the whole point — it is measurably cooler to wear than a flat weave of the same weight, and it never needs ironing.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 115, widthCm: 145, finish: "Loom-state pucker, washed", handFeel: "Crinkled, airy",
    useCases: ["Summer shirts", "Suits (unstructured)", "Kidswear"],
    sustainability: ["BCI Cotton"],
    price: 268, moq: 300, stock: 1900, leadTime: 14,
    colors: ["sky", "optic", "navy", "clay"],
  },
  {
    supplier: "erode-linen", category: "shirting",
    name: "Linen-Cotton Shirting 145",
    description:
      "A 55/45 linen-cotton that keeps most of linen's breathability while cutting its creasing by roughly half. The cotton content also stabilises the width, so cutting yield is more predictable than pure flax.",
    composition: "55% Linen / 45% Cotton", fibres: ["linen", "cotton"], weave: "PLAIN",
    gsm: 145, widthCm: 145, finish: "Stone washed, softened", handFeel: "Dry, textured, relaxed",
    useCases: ["Summer shirts", "Overshirts", "Resortwear"],
    sustainability: ["European Flax", "OEKO-TEX Standard 100"],
    price: 342, moq: 250, stock: 3100, leadTime: 16, featured: true,
    colors: ["natural", "optic", "sage", "terracotta", "navy", "olive"],
  },

  /* ------------------------------------------------------------- suiting */
  {
    supplier: "bhiwandi-loomworks", category: "suiting",
    name: "Super 110s Worsted Wool 240",
    description:
      "A four-ply worsted in Super 110s Australian merino. Firm enough to tailor cleanly with canvas, fine enough not to read as uniform cloth. The standard year-round weight for the Indian corporate market.",
    composition: "100% Merino Wool (Super 110s)", fibres: ["wool"], weave: "TWILL",
    gsm: 240, widthCm: 150, finish: "Piece-dyed, decatised", handFeel: "Smooth, resilient, dry",
    useCases: ["Suits", "Blazers", "Trousers"],
    price: 1180, compareAt: 1340, moq: 200, stock: 1600, leadTime: 14, featured: true,
    colors: ["charcoal", "navy", "midnight", "graphite", "slate"],
  },
  {
    supplier: "bhiwandi-loomworks", category: "suiting",
    name: "Tropical Wool 190",
    description:
      "An open-sett plain weave that lets air move through the cloth. Built for humid climates — it will not hold a crease as hard as a 280gsm worsted, and that trade is deliberate.",
    composition: "100% Wool", fibres: ["wool"], weave: "PLAIN",
    gsm: 190, widthCm: 150, finish: "Clear finish", handFeel: "Light, open, breathable",
    useCases: ["Summer suits", "Trousers", "Unstructured jackets"],
    price: 985, moq: 200, stock: 980, leadTime: 14,
    colors: ["slate", "navy", "camel", "charcoal"],
  },
  {
    supplier: "bhiwandi-loomworks", category: "suiting",
    name: "Poly-Viscose Suiting 210",
    description:
      "A 65/35 poly-viscose that carries most of the visual cues of wool at a third of the price. Excellent crease recovery and dimensional stability; the trade-off is lower breathability than a natural fibre.",
    composition: "65% Polyester / 35% Viscose", fibres: ["polyester", "viscose"], weave: "TWILL",
    gsm: 210, widthCm: 150, finish: "Heat set, calendered", handFeel: "Smooth, firm",
    useCases: ["Uniform suiting", "Institutional wear", "Volume tailoring"],
    price: 312, moq: 400, stock: 12800, leadTime: 10,
    colors: ["navy", "charcoal", "graphite", "midnight", "slate", "ink"],
  },
  {
    supplier: "bhiwandi-loomworks", category: "suiting",
    name: "Wool Herringbone 280",
    description:
      "A 6mm herringbone in a wool-poly blend. The reversing twill catches light in bands, which reads as depth on a jacket back and hides seam pucker better than a flat twill.",
    composition: "70% Wool / 30% Polyester", fibres: ["wool", "polyester"], weave: "HERRINGBONE",
    gsm: 280, widthCm: 150, finish: "Milled, pressed", handFeel: "Dense, warm, structured",
    useCases: ["Winter jackets", "Overcoats", "Waistcoats"],
    price: 742, moq: 200, stock: 720, leadTime: 16,
    colors: ["charcoal", "espresso", "forest", "graphite"],
  },
  {
    supplier: "bhiwandi-loomworks", category: "suiting",
    name: "Birdseye Worsted 250",
    description:
      "A tight birdseye dobby that reads as a textured solid. Traditional for formal business suiting because the two-colour effect hides shine at the elbow and seat far longer than a plain weave.",
    composition: "80% Wool / 20% Polyester", fibres: ["wool", "polyester"], weave: "DOBBY",
    gsm: 250, widthCm: 150, finish: "Decatised", handFeel: "Firm with fine grain",
    useCases: ["Business suits", "Trousers"],
    price: 826, moq: 200, stock: 540, leadTime: 16,
    colors: ["navy", "charcoal", "graphite"],
  },
  {
    supplier: "bhiwandi-loomworks", category: "suiting",
    name: "Stretch Wool Blend 225",
    description:
      "2% elastane in the weft gives about 12% widthwise stretch with full recovery. Aimed at travel and commute suiting where a rigid worsted feels punishing by the third hour.",
    composition: "62% Wool / 36% Polyester / 2% Elastane",
    fibres: ["wool", "polyester", "elastane"], weave: "TWILL",
    gsm: 225, widthCm: 148, finish: "Heat set, decatised", handFeel: "Supple with give",
    useCases: ["Travel suits", "Trousers", "Blazers"],
    price: 648, moq: 250, stock: 1450, leadTime: 14,
    colors: ["navy", "charcoal", "midnight", "olive"],
  },

  /* --------------------------------------------------------------- denim */
  {
    supplier: "ahmedabad-denim", category: "denim",
    name: "14oz Raw Selvedge Denim",
    description:
      "Woven on shuttle looms at 76cm width with a clean self-edge, rope-dyed to a deep unwashed indigo. Slubby, stiff off the roll, and built to fade along genuine wear lines rather than a laundry's approximation of them.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "TWILL",
    gsm: 475, widthCm: 76, finish: "Raw, unsanforised", handFeel: "Rigid, dry, hairy",
    useCases: ["Premium jeans", "Jackets", "Heritage workwear"],
    price: 895, moq: 400, stock: 2200, leadTime: 20, featured: true,
    colors: ["indigo", "ink"],
  },
  {
    supplier: "ahmedabad-denim", category: "denim",
    name: "12oz Stretch Denim",
    description:
      "Core-spun elastane weft at 1.5% gives 22% stretch with strong recovery — no bagging at the knee after a day's wear. The default construction for women's skinny and men's slim fits.",
    composition: "98% Cotton / 2% Elastane", fibres: ["cotton", "elastane"], weave: "TWILL",
    gsm: 407, widthCm: 152, finish: "Sanforised, skewed", handFeel: "Firm with recovery",
    useCases: ["Jeans", "Jeggings", "Denim skirts"],
    sustainability: ["OEKO-TEX Standard 100"],
    price: 428, moq: 500, stock: 9600, leadTime: 18, featured: true,
    colors: ["indigo", "washIndigo", "ink", "charcoal"],
  },
  {
    supplier: "ahmedabad-denim", category: "denim",
    name: "8oz Lightweight Denim",
    description:
      "A summer-weight denim that drapes rather than stands. Suited to shirts and dresses where a 12oz would sit like armour. Fades quickly, which is usually the intent at this weight.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "TWILL",
    gsm: 271, widthCm: 150, finish: "Sanforised, softened", handFeel: "Soft, fluid",
    useCases: ["Denim shirts", "Dresses", "Kidswear"],
    price: 296, moq: 400, stock: 5400, leadTime: 16,
    colors: ["washIndigo", "indigo", "ecru"],
  },
  {
    supplier: "ahmedabad-denim", category: "denim",
    name: "Ecru Undyed Denim 11oz",
    description:
      "The same twill construction with the indigo step skipped entirely. Ships ready for garment dyeing or overprinting, and saves the water footprint of rope-dyeing if you are colouring downstream anyway.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "TWILL",
    gsm: 373, widthCm: 152, finish: "Sanforised, PFD", handFeel: "Crisp, dry",
    useCases: ["Garment-dye programmes", "Printed denim", "Workwear"],
    sustainability: ["ZDHC Compliant", "Low-water process"],
    price: 342, moq: 500, stock: 3300, leadTime: 16,
    colors: ["ecru", "natural"],
  },
  {
    supplier: "ahmedabad-denim", category: "denim",
    name: "Black Coated Denim 12oz",
    description:
      "A resin-coated black denim with a faint sheen and a hand somewhere between denim and light leather. The coating sits on the face only, so the reverse stays a normal cotton twill.",
    composition: "99% Cotton / 1% Elastane", fibres: ["cotton", "elastane"], weave: "TWILL",
    gsm: 407, widthCm: 148, finish: "PU coated face", handFeel: "Smooth, slightly waxy",
    useCases: ["Fashion jeans", "Jackets"],
    price: 512, moq: 400, stock: 1100, leadTime: 20,
    colors: ["ink", "charcoal"],
  },

  /* --------------------------------------------------------------- linen */
  {
    supplier: "erode-linen", category: "linen",
    name: "Pure European Flax 165",
    description:
      "Normandy flax, wet-spun for a smoother yarn than dry-spun equivalents, woven at a balanced sett. This is the reference weight for linen shirting and light trousers — enough body to hold a shape, light enough for 40°C.",
    composition: "100% Linen", fibres: ["linen"], weave: "PLAIN",
    gsm: 165, widthCm: 145, finish: "Softened, pre-shrunk", handFeel: "Dry, crisp, cooling",
    useCases: ["Shirts", "Trousers", "Dresses", "Resortwear"],
    sustainability: ["European Flax", "GOTS", "OEKO-TEX Standard 100"],
    price: 486, moq: 250, stock: 4700, leadTime: 16, featured: true,
    colors: ["natural", "optic", "sand", "sage", "terracotta", "navy", "olive", "blush"],
  },
  {
    supplier: "erode-linen", category: "linen",
    name: "Heavy Linen Twill 240",
    description:
      "A twill-woven linen at jacket weight. The twill float softens the notorious stiffness of heavy flax, so it breaks in over weeks instead of months.",
    composition: "100% Linen", fibres: ["linen"], weave: "TWILL",
    gsm: 240, widthCm: 145, finish: "Garment washed", handFeel: "Substantial, softening",
    useCases: ["Unstructured jackets", "Trousers", "Aprons"],
    sustainability: ["European Flax"],
    price: 592, moq: 250, stock: 1800, leadTime: 18,
    colors: ["natural", "olive", "espresso", "slate", "rust"],
  },
  {
    supplier: "erode-linen", category: "linen",
    name: "Linen Slub Gauze 120",
    description:
      "Deliberately irregular slub yarn at an open sett. Almost translucent in strong light and it wrinkles freely — buyers who want it flat should look at the linen-cotton instead.",
    composition: "100% Linen", fibres: ["linen"], weave: "PLAIN",
    gsm: 120, widthCm: 140, finish: "Enzyme washed", handFeel: "Airy, textured, relaxed",
    useCases: ["Summer dresses", "Scarves", "Curtains"],
    sustainability: ["European Flax", "GOTS"],
    price: 424, moq: 250, stock: 2600, leadTime: 16,
    colors: ["natural", "optic", "blush", "sky", "sage"],
  },
  {
    supplier: "erode-linen", category: "linen",
    name: "Linen-Viscose Drape 155",
    description:
      "Viscose at 40% pulls the linen into a much softer drape and takes dye more deeply, giving richer saturated shades than pure flax can hold. Creases less, breathes slightly less.",
    composition: "60% Linen / 40% Viscose", fibres: ["linen", "viscose"], weave: "PLAIN",
    gsm: 155, widthCm: 145, finish: "Softened", handFeel: "Fluid, cool, smooth",
    useCases: ["Dresses", "Wide trousers", "Blouses"],
    price: 396, moq: 250, stock: 3400, leadTime: 16,
    colors: ["wine", "forest", "navy", "aubergine", "clay", "ink"],
  },
  {
    supplier: "kutch-handloom", category: "linen",
    name: "Handwoven Linen 180",
    description:
      "Pit-loom woven linen from the Bhujodi cluster. Width holds to 108cm ±2cm and the weft density varies slightly across a piece — the visible record of a person having made it.",
    composition: "100% Linen", fibres: ["linen"], weave: "PLAIN",
    gsm: 180, widthCm: 108, finish: "Loom state, washed", handFeel: "Rustic, dense, alive",
    useCases: ["Artisanal apparel", "Table linen", "Cushions"],
    sustainability: ["Handloom Mark", "Fairtrade"],
    price: 645, moq: 50, stock: 620, leadTime: 24,
    colors: ["natural", "indigo", "rust", "moss"],
  },

  /* ---------------------------------------------------------- silk-satin */
  {
    supplier: "surat-silk-house", category: "silk-satin",
    name: "Mulberry Charmeuse 16mm",
    description:
      "Sixteen-momme mulberry silk in a satin weave — glossy face, matte reverse. The weight most bridalwear and premium lining is cut from. Long floats mean it snags, so plan interlinings accordingly.",
    composition: "100% Mulberry Silk", fibres: ["silk"], weave: "SATIN",
    gsm: 71, widthCm: 114, finish: "Degummed, calendered", handFeel: "Liquid, cool, lustrous",
    useCases: ["Eveningwear", "Bridal", "Premium lining", "Sleepwear"],
    sustainability: ["Silk Mark"],
    price: 1240, moq: 30, stock: 1400, leadTime: 6, featured: true,
    colors: ["ivory", "champagne", "blush", "wine", "midnight", "emerald", "ink", "rose"],
  },
  {
    supplier: "surat-silk-house", category: "silk-satin",
    name: "Silk Dupioni 90",
    description:
      "Woven from double-cocoon yarn, which is why the slubs are irregular and unavoidable. Holds a sculptural shape better than any other silk at this weight — the reason it dominates structured bridalwear.",
    composition: "100% Silk", fibres: ["silk"], weave: "PLAIN",
    gsm: 90, widthCm: 110, finish: "Degummed", handFeel: "Crisp, papery, structured",
    useCases: ["Bridal", "Structured dresses", "Cushions"],
    sustainability: ["Silk Mark"],
    price: 968, moq: 30, stock: 980, leadTime: 6,
    colors: ["ivory", "gold", "wine", "teal", "aubergine", "brick"],
  },
  {
    supplier: "surat-silk-house", category: "silk-satin",
    name: "Crepe de Chine 14mm",
    description:
      "High-twist weft yarns produce a fine pebbled surface with a soft matte glow. Drapes closer to the body than charmeuse and resists creasing far better.",
    composition: "100% Silk", fibres: ["silk"], weave: "CREPE",
    gsm: 62, widthCm: 114, finish: "Degummed, washed", handFeel: "Soft, pebbled, fluid",
    useCases: ["Blouses", "Dresses", "Scarves"],
    sustainability: ["Silk Mark"],
    price: 1085, moq: 30, stock: 760, leadTime: 6,
    colors: ["ivory", "blush", "navy", "ink", "sage", "rose"],
  },
  {
    supplier: "surat-silk-house", category: "silk-satin",
    name: "Poly Satin Charmeuse 95",
    description:
      "A filament polyester satin engineered to imitate silk charmeuse at roughly a seventh of the cost. Higher shine, less breathability, and it will not water-spot — which for stagewear is a feature.",
    composition: "100% Polyester", fibres: ["polyester"], weave: "SATIN",
    gsm: 95, widthCm: 150, finish: "Heat set, calendered", handFeel: "Slippery, high-shine",
    useCases: ["Occasionwear", "Costume", "Lining", "Drapery"],
    price: 178, moq: 100, stock: 14200, leadTime: 5,
    colors: ["ivory", "blush", "wine", "emerald", "midnight", "ink", "lilac", "gold"],
  },
  {
    supplier: "varanasi-atelier", category: "silk-satin",
    name: "Banarasi Jacquard Brocade",
    description:
      "Figured silk woven on a jacquard head with a zari supplementary weft. Motif development from supplied artwork takes about three weeks; the sample loom runs before the production loom is set.",
    composition: "72% Silk / 28% Zari", fibres: ["silk", "zari"], weave: "JACQUARD",
    gsm: 165, widthCm: 112, finish: "Loom state", handFeel: "Rich, structured, textured",
    useCases: ["Bridal", "Occasionwear", "Statement upholstery"],
    sustainability: ["Handloom Mark", "GI Banaras Brocade"],
    price: 2450, moq: 40, stock: 320, leadTime: 28, featured: true,
    colors: ["wine", "gold", "emerald", "midnight", "oxblood"],
  },
  {
    supplier: "varanasi-atelier", category: "silk-satin",
    name: "Tanchoi Silk 140",
    description:
      "A satin-ground tanchoi with the extra weft floats carried on the reverse rather than cut — so the back stays clean and the cloth reads lighter than a comparable brocade.",
    composition: "100% Silk", fibres: ["silk"], weave: "JACQUARD",
    gsm: 140, widthCm: 110, finish: "Loom state, pressed", handFeel: "Smooth face, dense",
    useCases: ["Occasionwear", "Jackets", "Cushions"],
    sustainability: ["Handloom Mark", "Silk Mark"],
    price: 1780, moq: 40, stock: 260, leadTime: 28,
    colors: ["teal", "wine", "champagne", "aubergine"],
  },

  /* --------------------------------------------------------- knits-jersey */
  {
    supplier: "ludhiana-knit-mills", category: "knits-jersey",
    name: "Combed Single Jersey 180",
    description:
      "30s combed cotton on a 24-gauge circular machine, compacted to hold residual shrinkage under 5%. The workhorse tee fabric — soft, even, and predictable across repeat orders.",
    composition: "100% Combed Cotton", fibres: ["cotton"], weave: "JERSEY",
    gsm: 180, widthCm: 180, finish: "Bio-washed, compacted", handFeel: "Soft, smooth, light",
    useCases: ["T-shirts", "Basics", "Kidswear"],
    sustainability: ["OEKO-TEX Standard 100"],
    price: 312, moq: 150, stock: 18400, leadTime: 8, featured: true,
    colors: ["optic", "ink", "charcoal", "navy", "sage", "terracotta", "blush", "silver"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "knits-jersey",
    name: "Cotton Interlock 220",
    description:
      "Double-knit interlock: identical on both faces, no curl at a raw edge, and roughly twice the dimensional stability of single jersey. Costs more per metre and is worth it on anything with a raw hem.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "JERSEY",
    gsm: 220, widthCm: 175, finish: "Compacted, softened", handFeel: "Dense, smooth, stable",
    useCases: ["Polos", "Dresses", "Babywear"],
    price: 368, moq: 150, stock: 7200, leadTime: 8,
    colors: ["optic", "navy", "ink", "powder", "blush"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "knits-jersey",
    name: "2x2 Rib Knit 240",
    description:
      "Alternating face and reverse wales give roughly 80% widthwise stretch with strong recovery. Standard for cuffs, waistbands and necklines; also cuts well as a body fabric for close-fitting tops.",
    composition: "95% Cotton / 5% Elastane", fibres: ["cotton", "elastane"], weave: "RIB",
    gsm: 240, widthCm: 90, finish: "Heat set, compacted", handFeel: "Springy, elastic",
    useCases: ["Cuffs & trims", "Fitted tops", "Loungewear"],
    price: 398, moq: 150, stock: 4900, leadTime: 8,
    colors: ["optic", "ink", "charcoal", "navy", "wine", "moss"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "knits-jersey",
    name: "French Terry 300",
    description:
      "Loop-back terry with an unbrushed reverse — noticeably less bulky than fleece and far more wearable indoors. The loops trap air without the shed that brushing produces.",
    composition: "80% Cotton / 20% Polyester", fibres: ["cotton", "polyester"], weave: "JERSEY",
    gsm: 300, widthCm: 180, finish: "Compacted", handFeel: "Plush reverse, smooth face",
    useCases: ["Sweatshirts", "Joggers", "Hoodies"],
    price: 452, moq: 200, stock: 6100, leadTime: 9, featured: true,
    colors: ["silver", "charcoal", "ink", "navy", "sage", "clay", "optic"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "knits-jersey",
    name: "Cotton Pique 200",
    description:
      "Honeycomb pique with the raised texture that makes a polo read as a polo. The structure also lifts the surface off the skin, which is why pique wears cooler than jersey at the same weight.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "DOBBY",
    gsm: 200, widthCm: 175, finish: "Bio-washed, compacted", handFeel: "Textured, breathable",
    useCases: ["Polo shirts", "Uniform knitwear"],
    price: 344, moq: 150, stock: 8800, leadTime: 8,
    colors: ["optic", "navy", "ink", "forest", "wine", "silver"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "knits-jersey",
    name: "Slub Jersey 170",
    description:
      "Deliberately uneven slub yarn gives a lived-in, vintage surface straight off the machine. Batch-to-batch slub character varies slightly — worth approving a bulk swatch, not just a lab dip.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "JERSEY",
    gsm: 170, widthCm: 180, finish: "Garment washed", handFeel: "Textured, soft, dry",
    useCases: ["Premium tees", "Casual knitwear"],
    price: 356, moq: 150, stock: 3200, leadTime: 9,
    colors: ["ecru", "sand", "moss", "slate", "clay"],
  },

  /* --------------------------------------------------------- performance */
  {
    supplier: "ludhiana-knit-mills", category: "performance",
    name: "Recycled Poly Jersey 190",
    description:
      "Knitted from GRS-certified post-consumer PET yarn with a permanent wicking finish. Moisture transport tested at 4.2 on the AATCC 195 scale — comparable to virgin polyester of the same construction.",
    composition: "88% Recycled Polyester / 12% Elastane",
    fibres: ["polyester", "elastane"], weave: "JERSEY",
    gsm: 190, widthCm: 155, finish: "Wicking, anti-odour", handFeel: "Smooth, cool, elastic",
    useCases: ["Activewear", "Leggings", "Base layers"],
    sustainability: ["GRS Recycled", "OEKO-TEX Standard 100"],
    price: 478, moq: 200, stock: 5600, leadTime: 10, featured: true,
    colors: ["ink", "charcoal", "teal", "navy", "aubergine"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "performance",
    name: "Power Mesh 130",
    description:
      "An open warp-knit mesh with high two-way stretch, used as panelling for ventilation or as a support layer. Snags easily against velcro — keep it away from hook fastenings in the cutting room.",
    composition: "80% Nylon / 20% Elastane", fibres: ["nylon", "elastane"], weave: "JERSEY",
    gsm: 130, widthCm: 150, finish: "Heat set", handFeel: "Light, springy, open",
    useCases: ["Activewear panels", "Linings", "Shapewear"],
    price: 386, moq: 200, stock: 3900, leadTime: 10,
    colors: ["ink", "optic", "charcoal", "navy"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "performance",
    name: "Brushed Poly Fleece 260",
    description:
      "Single-sided brushed fleece for mid layers. Lighter than cotton terry at similar warmth, dries in about a third of the time, and holds print well on the flat face.",
    composition: "100% Polyester", fibres: ["polyester"], weave: "JERSEY",
    gsm: 260, widthCm: 160, finish: "Brushed reverse, anti-pill", handFeel: "Soft, warm, dry",
    useCases: ["Mid layers", "Track jackets", "Blankets"],
    price: 298, moq: 200, stock: 7400, leadTime: 9,
    colors: ["charcoal", "ink", "forest", "navy", "silver"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "performance",
    name: "Four-Way Stretch Woven 175",
    description:
      "A woven softshell with elastane in both directions — 30% stretch warpwise and weftwise. Cuts and sews like a woven but moves like a knit, which is the point for technical trousers.",
    composition: "86% Polyester / 14% Elastane", fibres: ["polyester", "elastane"], weave: "TWILL",
    gsm: 175, widthCm: 150, finish: "DWR, heat set", handFeel: "Smooth, dry, elastic",
    useCases: ["Technical trousers", "Outdoor shirts", "Golf apparel"],
    price: 542, moq: 250, stock: 2800, leadTime: 12,
    colors: ["ink", "olive", "charcoal", "navy", "slate"],
  },

  /* ------------------------------------------------------ handloom-khadi */
  {
    supplier: "kutch-handloom", category: "handloom-khadi",
    name: "Hand-Spun Khadi Cotton 150",
    description:
      "Charkha-spun yarn woven on a pit loom. Slub, count variation and a 2-3cm width drift are inherent to the process, not defects — cutting layouts should carry a little more allowance than for mill cloth.",
    composition: "100% Hand-Spun Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 150, widthCm: 100, finish: "Loom state, washed", handFeel: "Textured, breathable, alive",
    useCases: ["Kurtas", "Shirts", "Artisanal apparel"],
    sustainability: ["Handloom Mark", "Fairtrade", "Low-energy process"],
    price: 385, moq: 50, stock: 1450, leadTime: 24, featured: true,
    colors: ["natural", "indigo", "optic", "rust", "moss", "saffron"],
  },
  {
    supplier: "kutch-handloom", category: "handloom-khadi",
    name: "Kutchi Extra-Weft Cotton",
    description:
      "Traditional Bhujodi extra-weft motifs inserted by hand during weaving. Each panel is individually woven, so pattern placement is approximate rather than repeatable to the centimetre.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "JACQUARD",
    gsm: 180, widthCm: 100, finish: "Loom state", handFeel: "Dense, textured, structured",
    useCases: ["Stoles", "Jackets", "Cushions", "Wall panels"],
    sustainability: ["Handloom Mark", "GI Kutch Weaving", "Fairtrade"],
    price: 720, moq: 50, stock: 480, leadTime: 26,
    colors: ["natural", "indigo", "oxblood", "espresso"],
  },
  {
    supplier: "kutch-handloom", category: "handloom-khadi",
    name: "Handloom Cotton Ikat 160",
    description:
      "Warp-resist tied and dyed before weaving, which is why the motif edges feather rather than print sharp. That feathering is the authenticity marker — a printed imitation has hard edges.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 160, widthCm: 108, finish: "Washed", handFeel: "Soft, matte, textured",
    useCases: ["Dresses", "Shirts", "Home furnishing"],
    sustainability: ["Handloom Mark", "Fairtrade"],
    price: 545, moq: 50, stock: 690, leadTime: 24,
    colors: ["indigo", "rust", "moss", "natural"],
  },
  {
    supplier: "kutch-handloom", category: "handloom-khadi",
    name: "Khadi Wool Blend 260",
    description:
      "Hand-spun Kutchi desi wool blended with cotton for a lighter, less prickly hand than pure local wool. Winter-weight, with the natural lanolin left largely intact.",
    composition: "60% Desi Wool / 40% Cotton", fibres: ["wool", "cotton"], weave: "TWILL",
    gsm: 260, widthCm: 100, finish: "Loom state", handFeel: "Warm, rustic, springy",
    useCases: ["Jackets", "Shawls", "Throws"],
    sustainability: ["Handloom Mark", "Fairtrade"],
    price: 890, moq: 50, stock: 240, leadTime: 28,
    colors: ["natural", "espresso", "moss", "charcoal"],
  },

  /* ---------------------------------------------------------- upholstery */
  {
    supplier: "kutch-handloom", category: "upholstery",
    name: "Heavy Cotton Panama 400",
    description:
      "A dense basket weave rated at 30,000 Martindale rubs. Suitable for seating that gets daily use; the tight sett means it takes a staple cleanly without fraying back.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "CANVAS",
    gsm: 400, widthCm: 140, finish: "Stain-resist treated", handFeel: "Firm, dense, dry",
    useCases: ["Sofas", "Armchairs", "Cushions", "Headboards"],
    price: 685, moq: 60, stock: 1200, leadTime: 20,
    colors: ["natural", "slate", "moss", "clay", "charcoal", "teal"],
  },
  {
    supplier: "varanasi-atelier", category: "upholstery",
    name: "Cotton Velvet 340",
    description:
      "A cut-pile cotton velvet with a short 2mm nap. Directional — cut every panel the same way or the shade shifts visibly between them. Pressure marks lift with steam.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 340, widthCm: 140, finish: "Pile cut, sheared", handFeel: "Plush, dense, directional",
    useCases: ["Upholstery", "Curtains", "Occasion jackets"],
    price: 940, moq: 40, stock: 780, leadTime: 22, featured: true,
    colors: ["emerald", "wine", "midnight", "oxblood", "espresso", "teal"],
  },
  {
    supplier: "erode-linen", category: "upholstery",
    name: "Linen-Blend Chenille 380",
    description:
      "Chenille weft over a linen ground gives a soft, light-catching surface with better abrasion numbers than pure linen. Rated 25,000 Martindale.",
    composition: "55% Linen / 45% Cotton", fibres: ["linen", "cotton"], weave: "DOBBY",
    gsm: 380, widthCm: 140, finish: "Backed, stain-resist", handFeel: "Soft pile, substantial",
    useCases: ["Sofas", "Cushions", "Curtains"],
    price: 810, moq: 60, stock: 640, leadTime: 20,
    colors: ["sand", "sage", "slate", "clay", "graphite"],
  },

  /* ----------------------------------------------------- canvas-workwear */
  {
    supplier: "ahmedabad-denim", category: "canvas-workwear",
    name: "10oz Cotton Duck",
    description:
      "Paired-yarn plain weave in the classic duck construction. Stiff off the roll and softens considerably with use. The default for tote bags and shop aprons.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "CANVAS",
    gsm: 340, widthCm: 152, finish: "Sanforised", handFeel: "Stiff, dry, hard-wearing",
    useCases: ["Bags", "Aprons", "Workwear", "Covers"],
    price: 268, moq: 300, stock: 8900, leadTime: 14,
    colors: ["natural", "olive", "sand", "charcoal", "ink"],
  },
  {
    supplier: "ahmedabad-denim", category: "canvas-workwear",
    name: "Waxed Cotton Canvas 380",
    description:
      "Paraffin-wax impregnated canvas — water-repellent, self-patinating, and re-waxable rather than disposable. Do not dry clean; the solvent strips the wax out entirely.",
    composition: "100% Cotton (wax finish)", fibres: ["cotton"], weave: "CANVAS",
    gsm: 380, widthCm: 145, finish: "Paraffin wax impregnated", handFeel: "Waxy, firm, weathering",
    useCases: ["Field jackets", "Bags", "Outdoor gear"],
    price: 620, moq: 200, stock: 1600, leadTime: 18, featured: true,
    colors: ["olive", "tobacco", "espresso", "charcoal"],
  },
  {
    supplier: "ahmedabad-denim", category: "canvas-workwear",
    name: "Cotton Ripstop 210",
    description:
      "A reinforcing grid every 8mm stops a tear from propagating past one square. Lighter than duck at comparable practical durability, which is why military spec favours it.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 210, widthCm: 150, finish: "Sanforised, DWR", handFeel: "Crisp, light, gridded",
    useCases: ["Cargo trousers", "Field shirts", "Bags"],
    price: 312, moq: 300, stock: 4200, leadTime: 14,
    colors: ["olive", "sand", "charcoal", "ink", "moss"],
  },
  {
    supplier: "coimbatore-weaving", category: "canvas-workwear",
    name: "Herringbone Twill Workwear 260",
    description:
      "The HBT construction used in mid-century workwear: broken twill bands that resist a tear better than a straight twill and disguise soil across the diagonal.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "HERRINGBONE",
    gsm: 260, widthCm: 150, finish: "Sanforised, softened", handFeel: "Substantial, textured",
    useCases: ["Chore coats", "Trousers", "Overalls"],
    price: 336, moq: 300, stock: 2700, leadTime: 14,
    colors: ["ecru", "olive", "slate", "espresso"],
  },

  /* -------------------------------------------------------------- lining */
  {
    supplier: "surat-silk-house", category: "lining",
    name: "Bemberg Cupro Lining 78",
    description:
      "Regenerated cellulose from cotton linter. Breathes and manages moisture far better than polyester lining, has a natural anti-static behaviour, and slides cleanly over a wool shell. The standard for good tailoring.",
    composition: "100% Cupro", fibres: ["cupro"], weave: "TWILL",
    gsm: 78, widthCm: 140, finish: "Calendered", handFeel: "Cool, slippery, breathable",
    useCases: ["Jacket lining", "Trouser lining", "Dress lining"],
    sustainability: ["OEKO-TEX Standard 100"],
    price: 264, moq: 100, stock: 6800, leadTime: 6,
    colors: ["ink", "charcoal", "navy", "ivory", "espresso", "wine"],
  },
  {
    supplier: "bhiwandi-loomworks", category: "lining",
    name: "Viscose Twill Lining 90",
    description:
      "A mid-price viscose twill lining that sits between cupro and polyester on both breathability and cost. Prone to shrinking if pressed too wet, so pre-shrink before cutting.",
    composition: "100% Viscose", fibres: ["viscose"], weave: "TWILL",
    gsm: 90, widthCm: 145, finish: "Calendered", handFeel: "Smooth, soft, cool",
    useCases: ["Jacket lining", "Skirt lining"],
    price: 148, moq: 200, stock: 11400, leadTime: 8,
    colors: ["ink", "navy", "charcoal", "ivory", "silver"],
  },
  {
    supplier: "coimbatore-weaving", category: "lining",
    name: "Cotton Pocketing 120",
    description:
      "Tight plain-weave cotton for pocket bags. Chosen for tear strength at the corner seam rather than hand — this is a structural component, not a comfort layer.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 120, widthCm: 150, finish: "Sanforised", handFeel: "Crisp, thin, tough",
    useCases: ["Pocket bags", "Waistband curtain"],
    price: 132, moq: 300, stock: 9200, leadTime: 10,
    colors: ["optic", "ecru", "silver"],
  },

  /* -------------------------------------------------------- sheers-voile */
  {
    supplier: "coimbatore-weaving", category: "sheers-voile",
    name: "Cotton Voile 62",
    description:
      "High-twist single yarn at an open sett — semi-transparent, extremely light, and surprisingly durable for its weight. Almost always needs a lining or a doubled construction in apparel.",
    composition: "100% Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 62, widthCm: 145, finish: "Mercerised, softened", handFeel: "Sheer, crisp, airy",
    useCases: ["Summer dresses", "Layering", "Curtains", "Dupattas"],
    sustainability: ["BCI Cotton"],
    price: 196, moq: 300, stock: 6300, leadTime: 12,
    colors: ["optic", "ivory", "blush", "sky", "sage", "lilac"],
  },
  {
    supplier: "surat-silk-house", category: "sheers-voile",
    name: "Silk Organza 40",
    description:
      "Stiff, transparent, and structural. Used as an interlining to hold a shape without adding weight, or as a face fabric where the silhouette needs to stand away from the body.",
    composition: "100% Silk", fibres: ["silk"], weave: "PLAIN",
    gsm: 40, widthCm: 110, finish: "Degummed, sized", handFeel: "Crisp, papery, transparent",
    useCases: ["Bridal", "Interlining", "Structured overlays"],
    sustainability: ["Silk Mark"],
    price: 745, moq: 30, stock: 540, leadTime: 6,
    colors: ["ivory", "blush", "champagne", "sky"],
  },
  {
    supplier: "erode-linen", category: "sheers-voile",
    name: "Linen Sheer 95",
    description:
      "An open-sett pure linen woven specifically for window treatments. Filters light with visible slub texture and resists UV degradation better than cotton at the same exposure.",
    composition: "100% Linen", fibres: ["linen"], weave: "PLAIN",
    gsm: 95, widthCm: 280, finish: "Washed", handFeel: "Dry, textured, translucent",
    useCases: ["Curtains", "Room dividers", "Layered apparel"],
    sustainability: ["European Flax", "OEKO-TEX Standard 100"],
    price: 452, moq: 100, stock: 2100, leadTime: 16,
    colors: ["natural", "optic", "sand"],
  },

  /* ---------------- deliberately low / zero stock, to exercise real states */
  {
    supplier: "coimbatore-weaving", category: "shirting",
    name: "Giza 87 Poplin 105",
    description:
      "Extra-long-staple Egyptian Giza 87 in a 2/140s poplin. The finest cloth we weave and the slowest to make — allocated to standing orders first, so quote lead time before promising a delivery date.",
    composition: "100% Giza 87 Cotton", fibres: ["cotton"], weave: "PLAIN",
    gsm: 105, widthCm: 150, finish: "Mercerised, singed", handFeel: "Silken, cool, very fine",
    useCases: ["Luxury shirting", "Bespoke tailoring"],
    sustainability: ["OEKO-TEX Standard 100"],
    price: 985, moq: 200, stock: 140, leadTime: 26,
    colors: ["optic", "ivory", "sky"],
  },
  {
    supplier: "ludhiana-knit-mills", category: "knits-jersey",
    name: "Organic Cotton Jersey 200",
    description:
      "GOTS-certified organic cotton, undyed and unbleached so the natural cotton colour comes through. Currently between lots — the next greige batch is on the machine.",
    composition: "100% Organic Cotton", fibres: ["cotton"], weave: "JERSEY",
    gsm: 200, widthCm: 180, finish: "Bio-washed, undyed", handFeel: "Soft, natural, dry",
    useCases: ["Babywear", "Premium tees", "Sleepwear"],
    sustainability: ["GOTS", "OEKO-TEX Standard 100"],
    price: 425, moq: 200, stock: 0, leadTime: 14, status: "OUT_OF_STOCK",
    colors: ["natural", "ecru"],
  },
  {
    supplier: "varanasi-atelier", category: "silk-satin",
    name: "Tissue Silk with Zari 85",
    description:
      "A gossamer silk shot with flat zari, so light it is almost weightless and correspondingly fragile. Handle on rollers, never folded — a crease line in tissue silk does not fully recover.",
    composition: "80% Silk / 20% Zari", fibres: ["silk", "zari"], weave: "PLAIN",
    gsm: 85, widthCm: 110, finish: "Loom state", handFeel: "Weightless, shimmering, delicate",
    useCases: ["Bridal overlays", "Dupattas", "Occasionwear"],
    sustainability: ["Handloom Mark", "Silk Mark"],
    price: 1980, moq: 40, stock: 95, leadTime: 30,
    colors: ["gold", "champagne", "blush", "ivory"],
  },
  {
    supplier: "erode-linen", category: "linen",
    name: "Linen Herringbone 200",
    description:
      "A 4mm herringbone in pure linen. Still on the sampling loom — pricing is indicative and the finish is not yet locked.",
    composition: "100% Linen", fibres: ["linen"], weave: "HERRINGBONE",
    gsm: 200, widthCm: 145, finish: "In development", handFeel: "Dry, structured",
    useCases: ["Jackets", "Trousers"],
    sustainability: ["European Flax"],
    price: 560, moq: 250, stock: 0, leadTime: 30, status: "DRAFT",
    colors: ["natural", "slate"],
  },
];

export function colorValue(key: ColorKey): { name: string; hex: string } {
  const [name, hex] = C[key];
  return { name, hex };
}
