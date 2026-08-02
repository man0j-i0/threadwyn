"use client";

import { useId, useMemo, useState } from "react";

import { cn, formatMoney } from "@/lib/utils";

type Point = { label: string; value: number };

/**
 * Twelve-week order value. Deliberately a **single series**, which decides most
 * of the design:
 *
 *  - No legend box. The title names the series, so a legend would be noise.
 *  - No categorical palette. Threadwyn's brand hues are deep and low-chroma —
 *    correct for UI, and they fail CVD separation as a categorical set (checked
 *    with the palette validator). A single series sidesteps that entirely; it
 *    only has to clear 3:1 against the surface, which emerald does in light
 *    mode and the desaturated tonal variant does in dark.
 *  - Direct labels on the two points that carry meaning — latest and peak —
 *    rather than a number on every point.
 *  - A table view, because a chart alone is not screen-reader friendly.
 *
 * Dark mode uses its own stroke, chosen against the dark surface rather than
 * inverted from the light one.
 */
export function TrendChart({
  data,
  title,
  className,
}: {
  data: Point[];
  title: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const W = 640;
  const H = 200;
  const PAD = { top: 18, right: 16, bottom: 26, left: 48 };

  const geometry = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 1);
    // Round the ceiling up to a clean tick so the axis reads as a scale, not a
    // consequence of the data.
    const magnitude = 10 ** Math.floor(Math.log10(max));
    const ceiling = Math.ceil(max / magnitude) * magnitude || 1;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) => PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / ceiling) * innerH;

    const points = data.map((d, i) => ({ ...d, x: x(i), y: y(d.value), index: i }));
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L${points[points.length - 1]!.x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L${points[0]!.x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

    const ticks = [0, 0.5, 1].map((f) => ({ value: ceiling * f, y: y(ceiling * f) }));

    return { points, line, area, ticks, ceiling, baseline: PAD.top + innerH, innerW };
  }, [data]);

  const peak = geometry.points.reduce((best, p) => (p.value > best.value ? p : best), geometry.points[0]!);
  const latest = geometry.points[geometry.points.length - 1]!;
  const active = hover != null ? geometry.points[hover] : null;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const empty = total === 0;

  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-[12.5px] text-subtle">
            {empty
              ? "No orders in this window yet."
              : `${formatMoney(total, { compact: true })} across the last 12 weeks`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className="cursor-pointer rounded-full border border-line bg-canvas-veil px-3 py-1.5 font-mono text-[10.5px] text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-64 overflow-y-auto px-5 pb-5">
          <table className="w-full text-left">
            <caption className="sr-only">{title}, weekly order value</caption>
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line">
                <th scope="col" className="py-2 text-[11px] font-medium text-subtle">
                  Week ending
                </th>
                <th scope="col" className="py-2 text-right text-[11px] font-medium text-subtle">
                  Order value
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.label} className="border-b border-line/60 last:border-0">
                  <td className="py-2 text-[12.5px] text-muted">{d.label}</td>
                  <td className="py-2 text-right font-mono text-[12.5px] text-ink tnum">
                    {formatMoney(d.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-2 pb-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            role="img"
            aria-label={`${title}. Weekly order value over 12 weeks, peaking at ${formatMoney(peak.value)} in the week ending ${peak.label}, most recently ${formatMoney(latest.value)}. A table view of the same data is available.`}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid: low-contrast so it never competes with the data. */}
            <g>
              {geometry.ticks.map((t) => (
                <g key={t.value}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={t.y}
                    y2={t.y}
                    stroke="var(--line)"
                    strokeWidth="1"
                    strokeDasharray={t.value === 0 ? undefined : "3 4"}
                  />
                  <text
                    x={PAD.left - 8}
                    y={t.y + 3.5}
                    textAnchor="end"
                    className="fill-[var(--ink-subtle)] font-mono text-[9px]"
                  >
                    {t.value === 0 ? "0" : formatMoney(t.value, { compact: true })}
                  </text>
                </g>
              ))}
            </g>

            {!empty ? (
              <>
                <path d={geometry.area} fill={`url(#${uid}-fill)`} />
                <path
                  d={geometry.line}
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : null}

            {/* Crosshair + hit targets. The invisible rect is far wider than the
                marker so pointing at the chart is enough. */}
            {geometry.points.map((p) => (
              <g key={p.index}>
                <rect
                  x={p.x - geometry.innerW / (data.length * 2)}
                  y={PAD.top}
                  width={geometry.innerW / data.length}
                  height={geometry.baseline - PAD.top}
                  fill="transparent"
                  onMouseEnter={() => setHover(p.index)}
                  onFocus={() => setHover(p.index)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Week ending ${p.label}: ${formatMoney(p.value)}`}
                  className="cursor-crosshair focus:outline-none"
                />
                {hover === p.index ? (
                  <line
                    x1={p.x}
                    x2={p.x}
                    y1={PAD.top}
                    y2={geometry.baseline}
                    stroke="var(--line-strong)"
                    strokeWidth="1"
                  />
                ) : null}
              </g>
            ))}

            {/* Markers: 8px, with a surface ring so they read on the fill. */}
            {!empty
              ? geometry.points.map((p) => {
                  const emphasised = p.index === latest.index || p.index === peak.index || hover === p.index;
                  if (!emphasised) return null;
                  return (
                    <circle
                      key={`m-${p.index}`}
                      cx={p.x}
                      cy={p.y}
                      r={hover === p.index ? 5 : 4}
                      fill="var(--brand)"
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                  );
                })
              : null}

            {/* Direct labels on the two points that mean something. */}
            {!empty && !active ? (
              <>
                <text
                  x={latest.x}
                  y={latest.y - 11}
                  textAnchor="end"
                  className="fill-[var(--ink)] font-mono text-[10px] font-medium"
                >
                  {formatMoney(latest.value, { compact: true })}
                </text>
                {peak.index !== latest.index ? (
                  <text
                    x={peak.x}
                    y={peak.y - 11}
                    textAnchor="middle"
                    className="fill-[var(--ink-subtle)] font-mono text-[10px]"
                  >
                    peak {formatMoney(peak.value, { compact: true })}
                  </text>
                ) : null}
              </>
            ) : null}

            {/* x labels — every third week, so they never crowd on mobile. */}
            {geometry.points.map((p) =>
              p.index % 3 === 0 || p.index === geometry.points.length - 1 ? (
                <text
                  key={`x-${p.index}`}
                  x={p.x}
                  y={H - 8}
                  textAnchor={p.index === geometry.points.length - 1 ? "end" : "middle"}
                  className="fill-[var(--ink-subtle)] font-mono text-[9px]"
                >
                  {p.label}
                </text>
              ) : null,
            )}

            {active ? (
              <g transform={`translate(${Math.min(Math.max(active.x, 60), W - 70)}, ${PAD.top - 4})`}>
                <rect
                  x="-58"
                  y="-14"
                  width="116"
                  height="28"
                  rx="7"
                  fill="var(--surface)"
                  stroke="var(--line-strong)"
                />
                <text textAnchor="middle" y="-1" className="fill-[var(--ink-subtle)] font-mono text-[8.5px]">
                  {active.label}
                </text>
                <text
                  textAnchor="middle"
                  y="9"
                  className="fill-[var(--ink)] font-mono text-[10px] font-medium"
                >
                  {formatMoney(active.value)}
                </text>
              </g>
            ) : null}
          </svg>
        </div>
      )}
    </div>
  );
}
