import { buildWeaveSpec, weaveTile, shade, type WeaveKey } from "@/lib/weave";
import { cn } from "@/lib/utils";

/**
 * Renders a true-to-colour fabric swatch from a product's specification.
 * Pure SVG, server-rendered, no client JS, no network request — so a grid of
 * 24 fabrics paints in one pass with zero layout shift and nothing to 404.
 */
export function FabricSwatch({
  weave,
  hex,
  gsm,
  seed,
  className,
  alt,
  drape = true,
  magnify = 1,
  priority: _priority,
}: {
  weave: WeaveKey;
  hex: string;
  gsm: number;
  seed: string;
  className?: string;
  alt: string;
  /** Adds the soft light banding that reads as folded cloth. */
  drape?: boolean;
  /**
   * Enlarges the weave tile without changing the structure — the same cloth,
   * closer. Used where the point is to read the interlacing rather than to
   * judge the colour.
   */
  magnify?: number;
  priority?: boolean;
}) {
  const base = buildWeaveSpec({ weave, hex, gsm, seed });
  const spec = magnify === 1 ? base : { ...base, tile: base.tile * magnify };
  const uid = `w${spec.seed.toString(36)}`;
  const tile = weaveTile(weave, spec);

  return (
    <svg
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={alt}
      className={cn("block h-full w-full", className)}
    >
      <defs>
        <pattern
          id={`${uid}-weave`}
          width={spec.tile}
          height={spec.tile}
          patternUnits="userSpaceOnUse"
          dangerouslySetInnerHTML={{ __html: tile }}
        />

        {/* Directional sheen. Strong on satin, barely there on crepe. */}
        <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor={shade(hex, 26)} stopOpacity={spec.sheen * 0.85} />
          <stop offset="38%" stopColor={shade(hex, 8)} stopOpacity={spec.sheen * 0.25} />
          <stop offset="62%" stopColor={shade(hex, -10)} stopOpacity={spec.sheen * 0.3} />
          <stop offset="100%" stopColor={shade(hex, -20)} stopOpacity={spec.sheen * 0.55} />
        </linearGradient>

        {/* Corner falloff so the swatch sits in space rather than floating flat. */}
        <radialGradient id={`${uid}-vignette`} cx="42%" cy="34%" r="82%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.17" />
        </radialGradient>

        {/* Fibre haze — the microscopic fuzz that separates cloth from plastic. */}
        <filter id={`${uid}-fibre`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="3"
            seed={spec.seed % 1000}
            result="n"
          />
          <feColorMatrix in="n" type="saturate" values="0" result="ng" />
          <feComponentTransfer in="ng">
            <feFuncA type="linear" slope={0.22 * spec.fuzz} intercept="0" />
          </feComponentTransfer>
        </filter>
      </defs>

      <rect width="400" height="400" fill={hex} />
      <rect width="400" height="400" fill={`url(#${uid}-weave)`} />
      <rect width="400" height="400" fill={`url(#${uid}-sheen)`} style={{ mixBlendMode: "overlay" }} />

      {drape ? (
        <g style={{ mixBlendMode: "soft-light" }} opacity="0.85">
          <path d="M-40 300 L200 -40 L300 -40 L-40 400 Z" fill="#fff" opacity="0.13" />
          <path d="M170 440 L440 120 L440 210 L280 440 Z" fill="#000" opacity="0.1" />
        </g>
      ) : null}

      <rect width="400" height="400" filter={`url(#${uid}-fibre)`} opacity="0.5" />
      <rect width="400" height="400" fill={`url(#${uid}-vignette)`} />
    </svg>
  );
}

/**
 * The small circular chips used to pick a colourway. Each carries the real
 * weave at a tight tile, so switching colour also previews the structure.
 */
export function ColorwayChip({
  weave,
  hex,
  gsm,
  seed,
  size = 28,
  className,
}: {
  weave: WeaveKey;
  hex: string;
  gsm: number;
  seed: string;
  size?: number;
  className?: string;
}) {
  const spec = buildWeaveSpec({ weave, hex, gsm: Math.min(gsm, 220), seed });
  const uid = `c${spec.seed.toString(36)}`;
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden
      className={cn("block shrink-0 rounded-full", className)}
    >
      <defs>
        <pattern
          id={`${uid}-w`}
          width={spec.tile}
          height={spec.tile}
          patternUnits="userSpaceOnUse"
          dangerouslySetInnerHTML={{ __html: weaveTile(weave, spec) }}
        />
      </defs>
      <circle cx="20" cy="20" r="20" fill={hex} />
      <circle cx="20" cy="20" r="20" fill={`url(#${uid}-w)`} />
      <circle cx="20" cy="20" r="19.25" fill="none" stroke="#000" strokeOpacity="0.16" strokeWidth="1.5" />
    </svg>
  );
}
