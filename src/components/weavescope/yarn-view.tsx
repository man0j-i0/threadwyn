import { shade, type WeaveKey } from "@/lib/weave";
import { hashString } from "@/lib/utils";

/**
 * Yarn-scale rendering — roughly 40× to 400×.
 *
 * At this magnification the weave is no longer a texture, it is individual
 * yarns passing over and under each other, so it gets its own renderer rather
 * than a scaled-up pattern tile. The interlacing follows the actual lift plan
 * for the weave: plain alternates every end, twill steps one each pick, satin
 * scatters its binding points across a five-end repeat.
 *
 * Each yarn carries twist striations at the correct handedness (Z-twist, which
 * is what almost all commercial ring-spun yarn uses), so the direction you see
 * is the direction you would see under a real loupe.
 */
export function YarnView({
  weave,
  hex,
  cells = 7,
  seed,
  className,
}: {
  weave: WeaveKey;
  hex: string;
  cells?: number;
  seed: string;
  className?: string;
}) {
  const uid = `y${hashString(seed).toString(36)}`;
  const size = 100;
  const step = size / cells;
  const yarnW = step * 0.78;

  const warpColor = shade(hex, -6);
  const weftColor = shade(hex, 7);
  const shadow = shade(hex, -22);
  const highlight = shade(hex, 18);

  /** True when the warp end sits on top at this intersection. */
  const warpOnTop = (col: number, row: number) => {
    switch (weave) {
      case "PLAIN":
      case "JERSEY":
      case "CREPE":
        return (col + row) % 2 === 0;
      case "CANVAS":
        return (Math.floor(col / 2) + Math.floor(row / 2)) % 2 === 0;
      case "TWILL":
      case "DOBBY":
        return (col + row) % 3 !== 0;
      case "HERRINGBONE": {
        // Reverses direction every four ends, which is what makes the chevron.
        const band = Math.floor(col / 4) % 2 === 0;
        return band ? (col + row) % 3 !== 0 : (col - row + 12) % 3 !== 0;
      }
      case "SATIN":
        // 5-end satin, step 2 — the classic scattered binding order.
        return (col * 2 + row) % 5 !== 0;
      case "JACQUARD":
        return (col * 2 + row) % 4 !== 0 || (col + row) % 7 === 0;
      case "RIB":
        return col % 2 === 0;
      default:
        return (col + row) % 2 === 0;
    }
  };

  const indices = Array.from({ length: cells }, (_, i) => i);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={className}
    >
      <defs>
        {/* Cylindrical shading — a yarn is a round body, so it is lit down its
            length rather than flat-filled. */}
        <linearGradient id={`${uid}-warp`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={shadow} />
          <stop offset="28%" stopColor={warpColor} />
          <stop offset="46%" stopColor={highlight} />
          <stop offset="68%" stopColor={warpColor} />
          <stop offset="100%" stopColor={shadow} />
        </linearGradient>
        <linearGradient id={`${uid}-weft`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shadow} />
          <stop offset="28%" stopColor={weftColor} />
          <stop offset="46%" stopColor={highlight} />
          <stop offset="68%" stopColor={weftColor} />
          <stop offset="100%" stopColor={shadow} />
        </linearGradient>

        {/* Z-twist striations, drawn once and reused down every yarn. */}
        <pattern
          id={`${uid}-twist-v`}
          width={yarnW}
          height={yarnW * 0.62}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0 ${yarnW * 0.62} L${yarnW} 0`}
            stroke={shadow}
            strokeOpacity="0.34"
            strokeWidth={yarnW * 0.1}
            fill="none"
          />
          <path
            d={`M0 ${yarnW * 0.62 + yarnW * 0.16} L${yarnW} ${yarnW * 0.16}`}
            stroke={highlight}
            strokeOpacity="0.26"
            strokeWidth={yarnW * 0.06}
            fill="none"
          />
        </pattern>
        <pattern
          id={`${uid}-twist-h`}
          width={yarnW * 0.62}
          height={yarnW}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M0 0 L${yarnW * 0.62} ${yarnW}`}
            stroke={shadow}
            strokeOpacity="0.34"
            strokeWidth={yarnW * 0.1}
            fill="none"
          />
          <path
            d={`M${yarnW * 0.16} 0 L${yarnW * 0.62 + yarnW * 0.16} ${yarnW}`}
            stroke={highlight}
            strokeOpacity="0.26"
            strokeWidth={yarnW * 0.06}
            fill="none"
          />
        </pattern>
      </defs>

      {/* The gap between yarns — this is the air that makes cloth breathe. */}
      <rect width={size} height={size} fill={shade(hex, -34)} />

      {/* Under-layer: every yarn drawn flat, so nothing shows through a gap. */}
      <g opacity="0.55">
        {indices.map((c) => (
          <rect
            key={`wu-${c}`}
            x={c * step + (step - yarnW) / 2}
            y={-step}
            width={yarnW}
            height={size + step * 2}
            rx={yarnW / 2}
            fill={`url(#${uid}-warp)`}
          />
        ))}
        {indices.map((r) => (
          <rect
            key={`fu-${r}`}
            x={-step}
            y={r * step + (step - yarnW) / 2}
            width={size + step * 2}
            height={yarnW}
            rx={yarnW / 2}
            fill={`url(#${uid}-weft)`}
          />
        ))}
      </g>

      {/* Top layer: only the segments that float over at each intersection. */}
      {indices.map((r) =>
        indices.map((c) => {
          const top = warpOnTop(c, r);
          const x = c * step + (step - yarnW) / 2;
          const y = r * step + (step - yarnW) / 2;

          return top ? (
            <g key={`t-${c}-${r}`}>
              <rect
                x={x}
                y={r * step - step * 0.06}
                width={yarnW}
                height={step * 1.12}
                rx={yarnW / 2}
                fill={`url(#${uid}-warp)`}
              />
              <rect
                x={x}
                y={r * step - step * 0.06}
                width={yarnW}
                height={step * 1.12}
                rx={yarnW / 2}
                fill={`url(#${uid}-twist-v)`}
              />
            </g>
          ) : (
            <g key={`t-${c}-${r}`}>
              <rect
                x={c * step - step * 0.06}
                y={y}
                width={step * 1.12}
                height={yarnW}
                rx={yarnW / 2}
                fill={`url(#${uid}-weft)`}
              />
              <rect
                x={c * step - step * 0.06}
                y={y}
                width={step * 1.12}
                height={yarnW}
                rx={yarnW / 2}
                fill={`url(#${uid}-twist-h)`}
              />
            </g>
          );
        }),
      )}

      {/* Contact shadow where one yarn crosses beneath another. */}
      <g fill={shadow} fillOpacity="0.2">
        {indices.map((r) =>
          indices.map((c) =>
            warpOnTop(c, r) ? (
              <ellipse
                key={`s-${c}-${r}`}
                cx={c * step + step / 2}
                cy={r * step + step / 2}
                rx={yarnW * 0.62}
                ry={yarnW * 0.3}
              />
            ) : null,
          ),
        )}
      </g>
    </svg>
  );
}
