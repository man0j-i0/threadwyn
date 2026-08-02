import { shade } from "@/lib/weave";
import { hashString } from "@/lib/utils";
import type { FibreProfile } from "@/lib/weavescope";

/**
 * Fibre-scale rendering — roughly 600× to 1200×.
 *
 * Each fibre gets its own morphology, because they genuinely look different
 * under a microscope and those differences explain how the cloth behaves:
 *
 *   cotton    a collapsed tube, flattened and twisted — the convolutions are
 *             why short staples grip each other in a yarn
 *   linen     a cylinder with growth nodes — the nodes are why it creases hard
 *   silk      a smooth triangular filament — the prism is the lustre
 *   wool      overlapping cuticle scales — the scales are why it felts
 *   synthetic an extruded cylinder, perfectly uniform — no moisture path
 *   viscose   serrated cross-section with lengthwise striations from the bath
 *   zari      a flat metallic ribbon spiral-wound on a core
 *
 * Drawing the real morphology rather than a generic strand is the difference
 * between decoration and teaching something.
 */
export function FibreView({
  fibre,
  hex,
  seed,
  className,
  count = 3,
}: {
  fibre: FibreProfile;
  hex: string;
  seed: string;
  className?: string;
  count?: number;
}) {
  const uid = `f${hashString(seed).toString(36)}`;
  const base = shade(hex, 4);
  const dark = shade(hex, -20);
  const light = shade(hex, 26);
  const bg = shade(hex, -40);

  const lanes = Array.from({ length: count }, (_, i) => ({
    y: ((i + 1) / (count + 1)) * 100,
    phase: (hashString(`${seed}-${i}`) % 100) / 100,
    width: 13 + ((hashString(`${seed}-w${i}`) % 7) - 3),
  }));

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark} />
          <stop offset="22%" stopColor={base} />
          <stop offset="42%" stopColor={light} />
          <stop offset="70%" stopColor={base} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        {/* Silk's triangular section throws a much tighter specular band. */}
        <linearGradient id={`${uid}-prism`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark} />
          <stop offset="34%" stopColor={base} />
          <stop offset="46%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="56%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
      </defs>

      <rect width="100" height="100" fill={bg} />

      {lanes.map((lane, i) => (
        <g key={i} transform={`translate(0 ${lane.y})`}>
          {renderFibre(fibre.morphology, {
            uid,
            width: lane.width,
            phase: lane.phase,
            base,
            dark,
            light,
          })}
        </g>
      ))}
    </svg>
  );
}

type Ctx = { uid: string; width: number; phase: number; base: string; dark: string; light: string };

function renderFibre(morphology: FibreProfile["morphology"], ctx: Ctx) {
  const { uid, width: w, phase, dark, light, base } = ctx;
  const half = w / 2;

  switch (morphology) {
    /* ------------------------------------------------- cotton: twisted ribbon */
    case "convoluted-ribbon": {
      // Convolutions: the ribbon narrows and flips roughly every 18 units.
      const period = 18;
      const segments = Array.from({ length: 8 }, (_, i) => {
        const x = i * period - phase * period;
        const pinch = i % 2 === 0 ? 0.42 : 1;
        return { x, pinch };
      });
      return (
        <>
          <path
            d={
              `M-10 ${-half} ` +
              segments.map((s) => `Q${s.x + period / 2} ${-half * s.pinch * 1.35} ${s.x + period} ${-half * s.pinch}`).join(" ") +
              ` L${segments[segments.length - 1]!.x + period} ${half * 0.5} ` +
              segments
                .slice()
                .reverse()
                .map((s) => `Q${s.x + period / 2} ${half * s.pinch * 1.35} ${s.x} ${half * s.pinch}`)
                .join(" ") +
              " Z"
            }
            fill={`url(#${uid}-body)`}
          />
          {/* The twist line running down the centre of the ribbon. */}
          {segments.map((s, i) => (
            <path
              key={i}
              d={`M${s.x} ${i % 2 === 0 ? -half * 0.3 : half * 0.3} Q${s.x + period / 2} 0 ${s.x + period} ${i % 2 === 0 ? half * 0.3 : -half * 0.3}`}
              stroke={dark}
              strokeOpacity="0.5"
              strokeWidth="0.7"
              fill="none"
            />
          ))}
        </>
      );
    }

    /* ------------------------------------------------- linen: noded cylinder */
    case "noded-cylinder": {
      const nodes = Array.from({ length: 6 }, (_, i) => i * 20 + phase * 12 - 8);
      return (
        <>
          <rect x="-10" y={-half} width="130" height={w} rx={half} fill={`url(#${uid}-body)`} />
          {nodes.map((x, i) => (
            <g key={i}>
              {/* A node is a swelling with a transverse dislocation mark. */}
              <ellipse cx={x} cy="0" rx={half * 0.8} ry={half * 1.16} fill={base} />
              <ellipse cx={x} cy="0" rx={half * 0.8} ry={half * 1.16} fill={light} fillOpacity="0.24" />
              <path
                d={`M${x - half * 0.5} ${-half} L${x + half * 0.5} ${half}`}
                stroke={dark}
                strokeOpacity="0.62"
                strokeWidth="0.9"
              />
              <path
                d={`M${x + half * 0.5} ${-half} L${x - half * 0.5} ${half}`}
                stroke={dark}
                strokeOpacity="0.38"
                strokeWidth="0.6"
              />
            </g>
          ))}
          {/* The narrow central lumen runs the whole length. */}
          <line x1="-10" y1="0" x2="120" y2="0" stroke={dark} strokeOpacity="0.42" strokeWidth={w * 0.13} />
        </>
      );
    }

    /* ------------------------------------------ silk: smooth triangular prism */
    case "triangular-filament":
      return (
        <>
          <rect x="-10" y={-half * 0.8} width="130" height={w * 0.8} rx={half * 0.4} fill={`url(#${uid}-prism)`} />
          <line
            x1="-10"
            y1={-half * 0.28}
            x2="120"
            y2={-half * 0.28}
            stroke="#ffffff"
            strokeOpacity="0.55"
            strokeWidth={w * 0.07}
          />
        </>
      );

    /* --------------------------------------------------- wool: scaled cuticle */
    case "scaled-cylinder": {
      const scales = Array.from({ length: 11 }, (_, i) => i * 11.5 + phase * 8 - 8);
      return (
        <>
          <rect x="-10" y={-half} width="130" height={w} rx={half} fill={`url(#${uid}-body)`} />
          {scales.map((x, i) => (
            <path
              key={i}
              // Scale edges point toward the fibre tip — this directionality is
              // exactly what causes felting.
              d={`M${x} ${-half} Q${x + 6} 0 ${x} ${half}`}
              stroke={dark}
              strokeOpacity="0.5"
              strokeWidth="0.9"
              fill="none"
            />
          ))}
          {scales.map((x, i) => (
            <path
              key={`h${i}`}
              d={`M${x + 1.2} ${-half} Q${x + 7.2} 0 ${x + 1.2} ${half}`}
              stroke={light}
              strokeOpacity="0.3"
              strokeWidth="0.6"
              fill="none"
            />
          ))}
        </>
      );
    }

    /* ------------------------------------------- synthetic: extruded cylinder */
    case "smooth-cylinder":
      return (
        <>
          <rect x="-10" y={-half} width="130" height={w} rx={half} fill={`url(#${uid}-body)`} />
          <line
            x1="-10"
            y1={-half * 0.4}
            x2="120"
            y2={-half * 0.4}
            stroke="#ffffff"
            strokeOpacity="0.4"
            strokeWidth={w * 0.08}
          />
        </>
      );

    /* ------------------------------------------ viscose: serrated + striated */
    case "serrated-striated": {
      const striations = [-0.55, -0.2, 0.15, 0.5];
      return (
        <>
          <rect x="-10" y={-half} width="130" height={w} rx={half * 0.35} fill={`url(#${uid}-body)`} />
          {striations.map((f, i) => (
            <line
              key={i}
              x1="-10"
              y1={half * f}
              x2="120"
              y2={half * f}
              stroke={i % 2 === 0 ? dark : light}
              strokeOpacity={i % 2 === 0 ? 0.42 : 0.3}
              strokeWidth={w * 0.07}
            />
          ))}
          {/* Serrated edge from the skin setting before the core. */}
          {Array.from({ length: 26 }, (_, i) => (
            <path
              key={`e${i}`}
              d={`M${i * 5 - 8} ${-half} l2.5 ${half * 0.28} l2.5 ${-half * 0.28}`}
              stroke={dark}
              strokeOpacity="0.35"
              strokeWidth="0.6"
              fill="none"
            />
          ))}
        </>
      );
    }

    /* -------------------------------------------------- zari: metallic ribbon */
    case "flat-metallic": {
      const winds = Array.from({ length: 16 }, (_, i) => i * 8 + phase * 6 - 8);
      return (
        <>
          <rect x="-10" y={-half * 0.5} width="130" height={w * 0.5} fill={dark} />
          {winds.map((x, i) => (
            <g key={i}>
              <path
                d={`M${x} ${-half} L${x + 5} ${half} L${x + 8} ${half} L${x + 3} ${-half} Z`}
                fill={i % 2 === 0 ? "#D9BE7A" : "#B99A4F"}
                fillOpacity="0.92"
              />
              <path
                d={`M${x + 1} ${-half} L${x + 6} ${half}`}
                stroke="#ffffff"
                strokeOpacity="0.5"
                strokeWidth="0.7"
              />
            </g>
          ))}
        </>
      );
    }
  }
}
