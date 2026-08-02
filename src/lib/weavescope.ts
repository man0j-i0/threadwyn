import type { WeaveKey } from "./weave";

/**
 * WeaveScope — the derivation layer.
 *
 * Everything the experience shows is computed from data Threadwyn already
 * stores about the fabric: weave, GSM, width, composition, fibres. Nothing is
 * authored per product, which is why it works across the whole catalogue
 * rather than on one hand-made hero.
 *
 * Where a figure is an *estimate* rather than a stored fact, the UI says so and
 * shows the derivation. A procurement tool that quietly presents a guess as a
 * measurement is worse than one that shows nothing.
 */

/* ------------------------------------------------------------ fibre facts */

export type FibreKey =
  | "cotton" | "linen" | "silk" | "wool"
  | "polyester" | "nylon" | "viscose" | "cupro" | "elastane" | "zari";

export type FibreProfile = {
  key: FibreKey;
  label: string;
  /** Cross-section and surface, which is what the morphology view draws. */
  morphology: "convoluted-ribbon" | "noded-cylinder" | "triangular-filament" | "scaled-cylinder" | "smooth-cylinder" | "serrated-striated" | "flat-metallic";
  /** Staple fibres are spun from short lengths; filaments run continuous. */
  staple: boolean;
  /** Micrometres — real published ranges. */
  diameterUm: [number, number];
  note: string;
  /** Provenance beats, in order. Drives the origin scenes. */
  origin: { title: string; body: string }[];
  /** 0–100 intrinsic contributions, before weave and weight are applied. */
  traits: {
    breathability: number;
    drape: number;
    structure: number;
    wrinkleRecovery: number;
    thermal: number;
    moisture: number;
  };
};

export const FIBRES: Record<FibreKey, FibreProfile> = {
  cotton: {
    key: "cotton",
    label: "Cotton",
    morphology: "convoluted-ribbon",
    staple: true,
    diameterUm: [12, 20],
    note:
      "A collapsed tube. As the boll dries, the fibre flattens and twists on itself 60 or so times per centimetre — those convolutions are what let short cotton staples grip each other in a yarn without any adhesive.",
    origin: [
      { title: "Boll", body: "The fibre grows as a seed hair inside the cotton boll, one cell, up to 30mm long." },
      { title: "Ginning", body: "Lint is separated from seed. What leaves the gin is still a tangled mass of individual fibres." },
      { title: "Carding & combing", body: "Fibres are drawn parallel into a sliver. Combing removes the short ones — that is what a 'combed' cotton actually means." },
      { title: "Spinning", body: "The sliver is drafted thinner and twisted. Twist is what converts loose fibre into a yarn with tensile strength." },
    ],
    traits: { breathability: 78, drape: 55, structure: 62, wrinkleRecovery: 32, thermal: 45, moisture: 80 },
  },
  linen: {
    key: "linen",
    label: "Linen",
    morphology: "noded-cylinder",
    staple: true,
    diameterUm: [12, 30],
    note:
      "A bast fibre taken from the stem, not a seed. The visible nodes along its length are growth dislocations — they are why linen creases sharply and why it conducts heat away from the skin faster than cotton.",
    origin: [
      { title: "Flax", body: "Linum usitatissimum, pulled rather than cut so the full stem length is kept." },
      { title: "Retting", body: "The stems are left to controlled microbial decay, which dissolves the pectin binding the fibre to the woody core." },
      { title: "Scutching & hackling", body: "The woody boon is beaten away and the long line fibres are combed out from the short tow." },
      { title: "Wet spinning", body: "Line flax is spun through a hot water bath, which softens residual pectin and yields a much finer, smoother yarn." },
    ],
    traits: { breathability: 92, drape: 48, structure: 74, wrinkleRecovery: 18, thermal: 22, moisture: 88 },
  },
  silk: {
    key: "silk",
    label: "Silk",
    morphology: "triangular-filament",
    staple: false,
    diameterUm: [10, 13],
    note:
      "A continuous extruded filament with a rounded-triangular cross-section. That prism is the whole reason silk has its particular lustre — it refracts incoming light at many angles instead of scattering it.",
    origin: [
      { title: "Bombyx mori", body: "The silkworm extrudes two fibroin filaments bound in sericin gum, building a cocoon in a single unbroken thread." },
      { title: "Reeling", body: "Cocoons are softened and several filaments reeled together — a single cocoon yields 600 to 900 metres." },
      { title: "Degumming", body: "The sericin is boiled off. The cloth loses about 25% of its weight and gains its drape and shine." },
      { title: "Throwing", body: "Reeled filaments are twisted together. Twist level decides everything from flat habotai to pebbled crepe." },
    ],
    traits: { breathability: 70, drape: 95, structure: 30, wrinkleRecovery: 55, thermal: 58, moisture: 65 },
  },
  wool: {
    key: "wool",
    label: "Wool",
    morphology: "scaled-cylinder",
    staple: true,
    diameterUm: [18, 40],
    note:
      "The surface is tiled with overlapping cuticle scales pointing toward the tip. Those scales are what makes wool felt when it is agitated wet — and the natural crimp underneath is what traps the air that keeps you warm.",
    origin: [
      { title: "Fleece", body: "Shorn in one piece. Fibre diameter, measured in microns, decides whether it becomes a suit or a carpet." },
      { title: "Scouring", body: "Grease and suint are washed out. Recovered lanolin becomes a separate product." },
      { title: "Combing", body: "Worsted processing combs the fibres parallel and removes the short ones — that is what gives worsted suiting its clean, smooth face." },
      { title: "Spinning", body: "Crimp lets wool yarns be spun with air between the fibres, which is where the insulation comes from." },
    ],
    traits: { breathability: 66, drape: 68, structure: 82, wrinkleRecovery: 88, thermal: 92, moisture: 72 },
  },
  polyester: {
    key: "polyester",
    label: "Polyester",
    morphology: "smooth-cylinder",
    staple: false,
    diameterUm: [10, 25],
    note:
      "Melt-extruded through a spinneret, so the cross-section is whatever shape the hole was — usually a perfect circle. Utterly uniform, which is a strength for consistency and a weakness for moisture: there is nowhere for water to go.",
    origin: [
      { title: "Polymer", body: "PET chip, from petrochemical feedstock or from recovered bottles in the recycled grades." },
      { title: "Extrusion", body: "Melted and forced through a spinneret. Hole geometry sets the cross-section — trilobal for shine, hollow for insulation." },
      { title: "Drawing", body: "The filament is stretched several times its length, aligning the polymer chains. This is where the strength comes from." },
      { title: "Texturising", body: "False-twist crimping gives a flat filament bulk and stretch, so it behaves less like fishing line." },
    ],
    traits: { breathability: 34, drape: 62, structure: 70, wrinkleRecovery: 92, thermal: 55, moisture: 12 },
  },
  nylon: {
    key: "nylon",
    label: "Nylon",
    morphology: "smooth-cylinder",
    staple: false,
    diameterUm: [10, 22],
    note:
      "A polyamide filament, smoother and considerably more abrasion-resistant than polyester at the same denier. It takes acid dyes, which polyester will not.",
    origin: [
      { title: "Polymer", body: "Polyamide 6 or 6,6 chip." },
      { title: "Extrusion", body: "Melt-spun into continuous filament." },
      { title: "Drawing", body: "Cold-drawn to align the chains — nylon's abrasion resistance comes from this step." },
      { title: "Texturising", body: "Crimped or air-jet textured for bulk in apparel; left flat for technical use." },
    ],
    traits: { breathability: 38, drape: 66, structure: 68, wrinkleRecovery: 88, thermal: 50, moisture: 22 },
  },
  viscose: {
    key: "viscose",
    label: "Viscose",
    morphology: "serrated-striated",
    staple: true,
    diameterUm: [12, 20],
    note:
      "Regenerated cellulose. The serrated cross-section and lengthwise striations come from the filament skin setting before its core does as it hits the spin bath. It drapes beautifully and loses a lot of strength when wet.",
    origin: [
      { title: "Wood pulp", body: "Dissolving-grade cellulose, usually beech, eucalyptus or bamboo." },
      { title: "Xanthation", body: "Treated with caustic soda and carbon disulphide to make a soluble cellulose xanthate — the viscous 'viscose' the fibre is named for." },
      { title: "Wet spinning", body: "Extruded into an acid bath that regenerates the cellulose as a solid filament." },
      { title: "Cutting", body: "Filament tow is cut to a staple length and spun like a natural fibre." },
    ],
    traits: { breathability: 68, drape: 88, structure: 34, wrinkleRecovery: 30, thermal: 42, moisture: 84 },
  },
  cupro: {
    key: "cupro",
    label: "Cupro",
    morphology: "serrated-striated",
    staple: false,
    diameterUm: [8, 14],
    note:
      "Cellulose regenerated from cotton linter through a copper-ammonia solution. Finer than viscose, naturally anti-static, and it breathes far better than any polyester lining — which is why good tailoring uses it.",
    origin: [
      { title: "Linter", body: "The short fibres left clinging to the cotton seed after ginning — a by-product, not a crop." },
      { title: "Cuprammonium", body: "Dissolved in a copper and ammonia solution." },
      { title: "Stretch spinning", body: "Extruded and drawn down to a very fine filament, finer than viscose can reach." },
      { title: "Finishing", body: "Calendered to the slick face that lets a jacket slide over a shirt." },
    ],
    traits: { breathability: 74, drape: 90, structure: 28, wrinkleRecovery: 38, thermal: 46, moisture: 82 },
  },
  elastane: {
    key: "elastane",
    label: "Elastane",
    morphology: "smooth-cylinder",
    staple: false,
    diameterUm: [20, 50],
    note:
      "A segmented polyurethane that recovers from 500% extension. It is almost never used alone — it is core-spun inside another fibre, so what you see on the cloth face is cotton or polyester wrapped around it.",
    origin: [
      { title: "Prepolymer", body: "Segmented polyurethane, alternating rigid and flexible blocks." },
      { title: "Dry spinning", body: "Extruded into a heated column where the solvent evaporates and the filament sets." },
      { title: "Core spinning", body: "Wrapped inside a sheath of cotton or polyester so the cloth face keeps that fibre's hand." },
      { title: "Heat setting", body: "The finished cloth is heat-set to lock in recovery. Skip it and the fabric bags at the knee." },
    ],
    traits: { breathability: 30, drape: 58, structure: 40, wrinkleRecovery: 80, thermal: 52, moisture: 10 },
  },
  zari: {
    key: "zari",
    label: "Zari",
    morphology: "flat-metallic",
    staple: false,
    diameterUm: [60, 200],
    note:
      "A flat metallic strip wound around a silk or cotton core. Real zari uses silver-gilt; the modern trade mostly uses metallised polyester. It is a supplementary weft — it sits on the surface rather than binding the cloth.",
    origin: [
      { title: "Core", body: "A fine silk or cotton thread that carries the metal." },
      { title: "Flattening", body: "Silver or metallised film drawn and rolled into a ribbon a few microns thick." },
      { title: "Gilding", body: "In traditional kalabattu, the silver ribbon is gilded before winding." },
      { title: "Winding", body: "The ribbon is spiral-wound around the core, which is why zari catches light along its whole length." },
    ],
    traits: { breathability: 20, drape: 35, structure: 60, wrinkleRecovery: 45, thermal: 40, moisture: 15 },
  },
};

/* ------------------------------------------------- weave characterisation */

type WeaveTraits = {
  /** Average float length in threads — 1 for plain, higher for satin. */
  float: number;
  /** How much of the area is yarn versus air, roughly, at a given sett. */
  coverBias: number;
  /** Warp-faced weaves pack more ends than picks. */
  warpBias: number;
  interlacing: string;
};

const WEAVE_TRAITS: Record<WeaveKey, WeaveTraits> = {
  PLAIN: { float: 1, coverBias: 1.0, warpBias: 1.0, interlacing: "1 over, 1 under" },
  CANVAS: { float: 2, coverBias: 1.12, warpBias: 1.0, interlacing: "2 over, 2 under (paired yarns)" },
  TWILL: { float: 3, coverBias: 1.18, warpBias: 1.15, interlacing: "2 over, 1 under, stepped each pick" },
  HERRINGBONE: { float: 3, coverBias: 1.16, warpBias: 1.12, interlacing: "twill reversing every 6 to 8 ends" },
  SATIN: { float: 5, coverBias: 1.34, warpBias: 1.45, interlacing: "4 over, 1 under, binding points scattered" },
  JACQUARD: { float: 4, coverBias: 1.22, warpBias: 1.2, interlacing: "figure-controlled, each end lifted individually" },
  DOBBY: { float: 2, coverBias: 1.08, warpBias: 1.05, interlacing: "small repeating geometric figure" },
  CREPE: { float: 2, coverBias: 1.05, warpBias: 1.0, interlacing: "scattered, high-twist yarns" },
  JERSEY: { float: 1, coverBias: 0.9, warpBias: 1.0, interlacing: "interlooped, not interlaced" },
  RIB: { float: 1, coverBias: 0.95, warpBias: 1.0, interlacing: "alternating face and reverse wales" },
};

/* ----------------------------------------------------------- construction */

export type Construction = {
  /** Estimated warp ends per centimetre. */
  endsPerCm: number;
  /** Estimated weft picks per centimetre. */
  picksPerCm: number;
  /** Combined, the figure a pick glass actually measures. */
  threadsPerCm: number;
  threadsPerInch: number;
  /** Estimated yarn linear density. */
  yarnTex: number;
  /** Approximate yarn diameter in millimetres. */
  yarnDiameterMm: number;
  /** 0–1: how much of the cloth plane is yarn rather than air. */
  coverFactor: number;
  /** How many individual fibres sit in one yarn cross-section. */
  fibresPerYarn: number;
  /** Metres of yarn consumed by one square metre of cloth. */
  yarnMetresPerSqm: number;
  interlacing: string;
  floatLength: number;
};

/**
 * Estimates construction from stored spec.
 *
 * The arithmetic is the standard mass balance: cloth mass per square metre is
 * the sum of warp and weft yarn mass, so gsm = (ends/m × tex_warp + picks/m ×
 * tex_weft) ÷ 1000. Two unknowns, one equation — so yarn tex is bracketed from
 * the weight class (a 70 gsm voile is not spun from the same count as a 480 gsm
 * duck) and the ends/picks split comes from the weave's warp bias.
 *
 * Presented in the UI as an estimate, with this derivation shown.
 */
export function deriveConstruction(input: {
  weave: WeaveKey;
  gsm: number;
  fibre: FibreProfile;
}): Construction {
  const traits = WEAVE_TRAITS[input.weave];
  const { gsm } = input;

  // Typical yarn linear density by weight class, in tex (g per 1000 m).
  const baseTex =
    gsm < 80 ? 7 : gsm < 130 ? 12 : gsm < 200 ? 20 : gsm < 300 ? 32 : gsm < 420 ? 52 : 78;

  // Longer floats let a weaver pack more threads into the same width.
  const yarnTex = baseTex / traits.coverBias;

  // gsm = 0.1 × (ends/cm + picks/cm) × tex  →  total = 10 × gsm / tex
  const totalPerCm = (10 * gsm) / yarnTex;
  const endsPerCm = (totalPerCm * traits.warpBias) / (1 + traits.warpBias);
  const picksPerCm = totalPerCm - endsPerCm;

  // Yarn diameter from tex, using the standard d(mm) ≈ sqrt(tex) / 27 for
  // cellulosic yarns at typical packing density.
  const yarnDiameterMm = Math.sqrt(yarnTex) / 27;

  // Fibre count in the yarn cross-section, from the areas.
  const fibreDiameterUm = (input.fibre.diameterUm[0] + input.fibre.diameterUm[1]) / 2;
  const yarnAreaUm2 = Math.PI * ((yarnDiameterMm * 1000) / 2) ** 2;
  const fibreAreaUm2 = Math.PI * (fibreDiameterUm / 2) ** 2;
  const fibresPerYarn = Math.round((yarnAreaUm2 / fibreAreaUm2) * 0.62); // 0.62 packing factor

  const coverFactor = Math.min(
    0.99,
    ((endsPerCm + picksPerCm) * yarnDiameterMm) / 10 / (1 + traits.float * 0.06),
  );

  // One square metre needs 100 cm of each thread, plus crimp take-up.
  const crimp = 1 + 0.04 * (4 - Math.min(traits.float, 4));
  const yarnMetresPerSqm = Math.round((endsPerCm + picksPerCm) * 100 * 1 * crimp);

  return {
    endsPerCm: Math.round(endsPerCm),
    picksPerCm: Math.round(picksPerCm),
    threadsPerCm: Math.round(totalPerCm),
    threadsPerInch: Math.round(totalPerCm * 2.54),
    yarnTex: Math.round(yarnTex * 10) / 10,
    yarnDiameterMm: Math.round(yarnDiameterMm * 1000) / 1000,
    coverFactor: Math.round(coverFactor * 100) / 100,
    fibresPerYarn: Math.max(1, fibresPerYarn),
    yarnMetresPerSqm,
    interlacing: traits.interlacing,
    floatLength: traits.float,
  };
}

/* -------------------------------------------------------------- behaviour */

export type BehaviourScore = {
  key: string;
  label: string;
  value: number;
  /** Plain-English statement of what drove the number. */
  because: string;
};

/**
 * Five indicators, each a blend of the fibre's intrinsic trait, the weave's
 * openness and the cloth's weight. These are *indicative*, not lab results, and
 * the UI labels them as such — but they are derived consistently, so comparing
 * two fabrics on them is meaningful even if the absolute number is not.
 */
export function deriveBehaviour(input: {
  weave: WeaveKey;
  gsm: number;
  fibre: FibreProfile;
  construction: Construction;
}): BehaviourScore[] {
  const { fibre, gsm, construction, weave } = input;
  const traits = WEAVE_TRAITS[weave];
  const clamp = (n: number) => Math.max(4, Math.min(98, Math.round(n)));

  // Openness: light cloth with a low cover factor breathes; dense cloth does not.
  const openness = (1 - construction.coverFactor) * 100;
  const weightPenalty = Math.min(45, (gsm / 500) * 45);
  const isKnit = weave === "JERSEY" || weave === "RIB";

  return [
    {
      key: "breathability",
      label: "Breathability",
      value: clamp(fibre.traits.breathability * 0.55 + openness * 0.3 - weightPenalty * 0.4 + (isKnit ? 8 : 0)),
      because: `${fibre.label} fibre, ${construction.coverFactor.toFixed(2)} cover factor, ${gsm} gsm`,
    },
    {
      key: "drape",
      label: "Drape",
      value: clamp(fibre.traits.drape * 0.6 + traits.float * 6 - (gsm > 300 ? 18 : 0) + (isKnit ? 10 : 0)),
      because: `${fibre.label} fibre with a ${traits.float}-thread float`,
    },
    {
      key: "structure",
      label: "Structure",
      value: clamp(fibre.traits.structure * 0.45 + weightPenalty * 1.1 + construction.coverFactor * 30 - (isKnit ? 22 : 0)),
      because: `${gsm} gsm at ${construction.threadsPerCm} threads/cm`,
    },
    {
      key: "wrinkleRecovery",
      label: "Crease recovery",
      value: clamp(fibre.traits.wrinkleRecovery * 0.72 + traits.float * 3.5 + (gsm > 220 ? 10 : 0)),
      because: `${fibre.label} is the dominant factor here`,
    },
    {
      key: "thermal",
      label: "Warmth",
      value: clamp(fibre.traits.thermal * 0.5 + weightPenalty * 1.05 + construction.coverFactor * 22),
      because: `${gsm} gsm with ${(construction.coverFactor * 100).toFixed(0)}% cover`,
    },
  ];
}

/* ------------------------------------------------------------- magnifiers */

export const MAGNIFICATIONS = [
  { at: 0.0, label: "1×", caption: "As it arrives on the roll" },
  { at: 0.18, label: "8×", caption: "A pick glass — the loupe a mill uses to count threads" },
  { at: 0.36, label: "40×", caption: "Individual warp and weft yarns resolve" },
  { at: 0.58, label: "200×", caption: "Twist becomes visible in the yarn" },
  { at: 0.8, label: "600×", caption: "Single fibres" },
  { at: 1.0, label: "1200×", caption: "Fibre surface and cross-section" },
] as const;

/** Picks the dominant fibre — the one the cloth actually behaves like. */
export function primaryFibre(fibres: string[]): FibreProfile {
  const order: FibreKey[] = ["silk", "linen", "wool", "cotton", "cupro", "viscose", "nylon", "polyester", "zari", "elastane"];
  for (const key of order) {
    if (fibres.includes(key)) return FIBRES[key];
  }
  return FIBRES.cotton;
}

/** Reads a composition string into rough percentage shares. */
export function parseComposition(composition: string): { label: string; pct: number }[] {
  const matches = [...composition.matchAll(/(\d{1,3})\s*%\s*([A-Za-z][A-Za-z\s-]*)/g)];
  if (matches.length === 0) return [{ label: composition, pct: 100 }];
  return matches.map((m) => ({ label: m[2]!.trim(), pct: Number(m[1]) }));
}
