import { hashString } from "./utils";

/**
 * Threadwyn renders fabric rather than photographing it.
 *
 * Stock photography lies about colour: two mills shoot the same navy poplin
 * under different lights and a buyer cannot compare them. So every swatch here
 * is generated from the product's actual specification — weave structure,
 * yarn count implied by GSM, and the colourway's exact hex. The result is
 * true-to-colour, loads instantly, never 404s, and stays consistent across the
 * whole catalogue. Suppliers can still upload real photographs; those take
 * precedence on the product page and the weave becomes the fallback.
 */

export type WeaveKey =
  | "PLAIN"
  | "TWILL"
  | "SATIN"
  | "JACQUARD"
  | "HERRINGBONE"
  | "JERSEY"
  | "RIB"
  | "DOBBY"
  | "CANVAS"
  | "CREPE";

export const WEAVE_LABELS: Record<WeaveKey, string> = {
  PLAIN: "Plain weave",
  TWILL: "Twill",
  SATIN: "Satin",
  JACQUARD: "Jacquard",
  HERRINGBONE: "Herringbone",
  JERSEY: "Jersey knit",
  RIB: "Rib knit",
  DOBBY: "Dobby",
  CANVAS: "Canvas",
  CREPE: "Crepe",
};

export const WEAVE_NOTES: Record<WeaveKey, string> = {
  PLAIN: "One over, one under. The most stable structure — crisp hand, even drape.",
  TWILL: "Diagonal float lines. Softer drape than plain, hides soil, resists wrinkling.",
  SATIN: "Long warp floats. Maximum surface sheen and fluid drape, low abrasion resistance.",
  JACQUARD: "Loom-figured pattern woven into the cloth rather than printed on it.",
  HERRINGBONE: "Reversed twill in alternating bands. Structured with visible directional texture.",
  JERSEY: "Interlooped single knit. High stretch, curls at raw edges, soft against skin.",
  RIB: "Alternating face and reverse wales. Strong widthwise recovery — cuffs and necklines.",
  DOBBY: "Small geometric figures on a plain ground. Texture without a full jacquard head.",
  CANVAS: "Heavy paired-yarn plain weave. Very high tensile strength, stiff hand.",
  CREPE: "High-twist yarns give a pebbled, matte surface that resists creasing.",
};

/* ------------------------------------------------------------------ colour */

type Hsl = { h: number; s: number; l: number };

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToCss({ h, s, l }: Hsl, alpha = 1) {
  const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
  return alpha === 1
    ? `hsl(${h.toFixed(1)} ${clamp(s).toFixed(1)}% ${clamp(l).toFixed(1)}%)`
    : `hsl(${h.toFixed(1)} ${clamp(s).toFixed(1)}% ${clamp(l).toFixed(1)}% / ${alpha})`;
}

/**
 * Shade a colour the way dyed yarn actually behaves: very dark colours lift
 * rather than darken further, and shadows pick up a little saturation instead
 * of sliding toward grey.
 */
export function shade(hex: string, amount: number) {
  const hsl = hexToHsl(hex);
  const direction = hsl.l < 18 && amount < 0 ? -amount * 0.6 : amount;
  return hslToCss({
    h: hsl.h,
    s: Math.min(100, hsl.s + (direction < 0 ? 5 : -3)),
    l: Math.min(97, Math.max(4, hsl.l + direction)),
  });
}

/* ------------------------------------------------------------- geometry */

export type WeaveSpec = {
  /** Pattern tile size in user units. Heavier cloth ⇒ visibly coarser yarn. */
  tile: number;
  seed: number;
  base: string;
  warp: string;
  weft: string;
  shadow: string;
  highlight: string;
  /** Satin and silk get a directional sheen; matte cloths do not. */
  sheen: number;
  /** Fibre-noise strength — crepe and canvas are rougher than poplin. */
  fuzz: number;
};

export function buildWeaveSpec(opts: {
  weave: WeaveKey;
  hex: string;
  gsm: number;
  seed: string;
}): WeaveSpec {
  const { weave, hex, gsm, seed } = opts;

  // 60 gsm voile → fine yarn; 480 gsm canvas → coarse yarn.
  const weight = Math.min(1, Math.max(0, (gsm - 55) / 425));
  const tile = Math.round(8 + weight * 14);

  const sheen = weave === "SATIN" ? 0.5 : weave === "JACQUARD" ? 0.26 : weave === "CREPE" ? 0.05 : 0.14;
  const fuzz = weave === "CREPE" ? 1 : weave === "CANVAS" ? 0.85 : weave === "SATIN" ? 0.25 : 0.55;

  return {
    tile,
    seed: hashString(seed),
    base: hex,
    warp: shade(hex, -7),
    weft: shade(hex, 6),
    shadow: shade(hex, -16),
    highlight: shade(hex, 13),
    sheen,
    fuzz,
  };
}

/**
 * Returns the SVG body of a <pattern> tile for the given weave. Kept as a
 * string builder rather than JSX so it can be reused by the OG-image renderer
 * and by any future raster export without dragging React along.
 */
export function weaveTile(weave: WeaveKey, s: WeaveSpec): string {
  const t = s.tile;
  const h = t / 2;
  const q = t / 4;

  switch (weave) {
    case "PLAIN":
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <rect x="0" y="0" width="${h}" height="${h}" fill="${s.warp}"/>
        <rect x="${h}" y="${h}" width="${h}" height="${h}" fill="${s.warp}"/>
        <rect x="${h}" y="0" width="${h}" height="${h}" fill="${s.weft}"/>
        <rect x="0" y="${h}" width="${h}" height="${h}" fill="${s.weft}"/>
        <line x1="${h}" y1="0" x2="${h}" y2="${t}" stroke="${s.shadow}" stroke-opacity="0.4" stroke-width="0.5"/>
        <line x1="0" y1="${h}" x2="${t}" y2="${h}" stroke="${s.shadow}" stroke-opacity="0.4" stroke-width="0.5"/>`;

    case "CANVAS":
      // Paired yarns in both directions — the basket structure of duck cloth.
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <rect x="0" y="0" width="${h}" height="${h}" fill="${s.warp}"/>
        <rect x="${h}" y="${h}" width="${h}" height="${h}" fill="${s.warp}"/>
        <rect x="${h}" y="0" width="${h}" height="${h}" fill="${s.weft}"/>
        <rect x="0" y="${h}" width="${h}" height="${h}" fill="${s.weft}"/>
        <g stroke="${s.shadow}" stroke-opacity="0.5" stroke-width="0.7">
          <line x1="${q}" y1="0" x2="${q}" y2="${h}"/>
          <line x1="${h + q}" y1="${h}" x2="${h + q}" y2="${t}"/>
          <line x1="${h}" y1="${q}" x2="${t}" y2="${q}"/>
          <line x1="0" y1="${h + q}" x2="${h}" y2="${h + q}"/>
        </g>
        <rect width="${t}" height="${t}" fill="none" stroke="${s.shadow}" stroke-opacity="0.28" stroke-width="0.6"/>`;

    case "TWILL":
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <g stroke="${s.warp}" stroke-width="${t * 0.34}" stroke-linecap="square">
          <line x1="${-t}" y1="${t}" x2="${t}" y2="${-t}"/>
          <line x1="0" y1="${t * 2}" x2="${t * 2}" y2="0"/>
        </g>
        <g stroke="${s.highlight}" stroke-opacity="0.55" stroke-width="${t * 0.1}">
          <line x1="${-t * 0.7}" y1="${t}" x2="${t * 1.3}" y2="${-t}"/>
          <line x1="${t * 0.3}" y1="${t * 2}" x2="${t * 2.3}" y2="0"/>
        </g>
        <g stroke="${s.shadow}" stroke-opacity="0.42" stroke-width="${t * 0.09}">
          <line x1="${-t * 1.3}" y1="${t}" x2="${t * 0.7}" y2="${-t}"/>
          <line x1="${-t * 0.3}" y1="${t * 2}" x2="${t * 1.7}" y2="0"/>
        </g>`;

    case "HERRINGBONE":
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <g stroke="${s.warp}" stroke-width="${t * 0.22}" fill="none" stroke-linecap="square">
          <path d="M0 ${t} L${h} ${h} L${t} ${t}"/>
          <path d="M0 ${h} L${h} 0 L${t} ${h}"/>
          <path d="M0 0 L${h} ${-h} L${t} 0"/>
        </g>
        <g stroke="${s.highlight}" stroke-opacity="0.5" stroke-width="${t * 0.07}" fill="none">
          <path d="M0 ${t - t * 0.14} L${h} ${h - t * 0.14} L${t} ${t - t * 0.14}"/>
          <path d="M0 ${h - t * 0.14} L${h} ${-t * 0.14} L${t} ${h - t * 0.14}"/>
        </g>
        <line x1="${h}" y1="0" x2="${h}" y2="${t}" stroke="${s.shadow}" stroke-opacity="0.3" stroke-width="0.6"/>`;

    case "SATIN": {
      // Long floats with sparse, offset binding points — the 5-harness order.
      const pts = [
        [q, q],
        [q * 3, q * 2],
        [q * 2, q * 3.4],
        [q * 0.4, q * 2.6],
        [q * 3.4, q * 0.6],
      ];
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <g fill="${s.shadow}" fill-opacity="0.3">
          ${pts.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${t * 0.09}" ry="${t * 0.055}"/>`).join("")}
        </g>
        <g stroke="${s.highlight}" stroke-opacity="0.34" stroke-width="${t * 0.055}">
          <line x1="0" y1="${q * 0.7}" x2="${t}" y2="${q * 0.7}"/>
          <line x1="0" y1="${q * 2.3}" x2="${t}" y2="${q * 2.3}"/>
          <line x1="0" y1="${q * 3.7}" x2="${t}" y2="${q * 3.7}"/>
        </g>`;
    }

    case "RIB":
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <rect x="0" y="0" width="${h}" height="${t}" fill="${s.warp}"/>
        <rect x="0" y="0" width="${t * 0.12}" height="${t}" fill="${s.shadow}" fill-opacity="0.55"/>
        <rect x="${h}" y="0" width="${t * 0.12}" height="${t}" fill="${s.shadow}" fill-opacity="0.4"/>
        <rect x="${t * 0.2}" y="0" width="${t * 0.12}" height="${t}" fill="${s.highlight}" fill-opacity="0.5"/>
        <rect x="${h + t * 0.22}" y="0" width="${t * 0.1}" height="${t}" fill="${s.highlight}" fill-opacity="0.32"/>`;

    case "JERSEY": {
      // Interlooped V stitches, offset row to row.
      const v = (x: number, y: number, o: number) =>
        `<path d="M${x} ${y} L${x + q} ${y + h * 0.72} L${x + h} ${y}" fill="none" stroke="${o > 0 ? s.highlight : s.shadow}" stroke-opacity="${o > 0 ? 0.5 : 0.4}" stroke-width="${t * 0.12}" stroke-linecap="round" stroke-linejoin="round"/>`;
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <g>
          ${v(0, q * 0.4, 0)}${v(h, q * 0.4, 0)}
          ${v(-q, q * 2.4, 0)}${v(q, q * 2.4, 0)}${v(q * 3, q * 2.4, 0)}
          ${v(0, q * 0.1, 1)}${v(h, q * 0.1, 1)}
          ${v(-q, q * 2.1, 1)}${v(q, q * 2.1, 1)}${v(q * 3, q * 2.1, 1)}
        </g>`;
    }

    case "DOBBY":
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <g stroke="${s.warp}" stroke-width="0.6" stroke-opacity="0.7">
          <line x1="${h}" y1="0" x2="${h}" y2="${t}"/>
          <line x1="0" y1="${h}" x2="${t}" y2="${h}"/>
        </g>
        <g fill="${s.shadow}" fill-opacity="0.42">
          <rect x="${q * 0.6}" y="${q * 0.6}" width="${q * 0.8}" height="${q * 0.8}" rx="${q * 0.2}"/>
          <rect x="${h + q * 0.6}" y="${h + q * 0.6}" width="${q * 0.8}" height="${q * 0.8}" rx="${q * 0.2}"/>
        </g>
        <g fill="${s.highlight}" fill-opacity="0.5">
          <rect x="${h + q * 0.6}" y="${q * 0.6}" width="${q * 0.8}" height="${q * 0.8}" rx="${q * 0.2}"/>
          <rect x="${q * 0.6}" y="${h + q * 0.6}" width="${q * 0.8}" height="${q * 0.8}" rx="${q * 0.2}"/>
        </g>`;

    case "CREPE": {
      // Pebbled, irregular — driven off the product seed so it is stable.
      let rnd = s.seed || 1;
      const next = () => {
        rnd = (rnd * 1664525 + 1013904223) >>> 0;
        return rnd / 4294967296;
      };
      const dots = Array.from({ length: 26 }, () => {
        const x = next() * t;
        const y = next() * t;
        const r = t * (0.045 + next() * 0.075);
        const dark = next() > 0.48;
        return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${dark ? s.shadow : s.highlight}" fill-opacity="${dark ? 0.3 : 0.34}"/>`;
      }).join("");
      return `<rect width="${t}" height="${t}" fill="${s.base}"/>${dots}`;
    }

    case "JACQUARD": {
      // A woven figure — a stylised four-petal medallion on a plain ground.
      const c = h;
      const r = t * 0.3;
      return `
        <rect width="${t}" height="${t}" fill="${s.base}"/>
        <g stroke="${s.warp}" stroke-width="0.5" stroke-opacity="0.55">
          <line x1="${h}" y1="0" x2="${h}" y2="${t}"/>
          <line x1="0" y1="${h}" x2="${t}" y2="${h}"/>
        </g>
        <g fill="none" stroke="${s.highlight}" stroke-opacity="0.62" stroke-width="${t * 0.085}" stroke-linecap="round">
          <path d="M${c} ${c - r} Q${c + r} ${c - r} ${c + r} ${c} Q${c + r} ${c + r} ${c} ${c + r} Q${c - r} ${c + r} ${c - r} ${c} Q${c - r} ${c - r} ${c} ${c - r} Z"/>
        </g>
        <g fill="${s.shadow}" fill-opacity="0.36">
          <circle cx="${c}" cy="${c}" r="${t * 0.085}"/>
          <circle cx="0" cy="0" r="${t * 0.1}"/>
          <circle cx="${t}" cy="0" r="${t * 0.1}"/>
          <circle cx="0" cy="${t}" r="${t * 0.1}"/>
          <circle cx="${t}" cy="${t}" r="${t * 0.1}"/>
        </g>`;
    }
  }
}
