import { FabricSwatch } from "@/components/product/fabric-swatch";
import { cn } from "@/lib/utils";
import type { WeaveKey } from "@/lib/weave";

/**
 * The illustration slot in a WeaveScope analysis section.
 *
 * Takes an optional `src` and otherwise renders the fabric's own weave,
 * magnified. That fallback order is deliberate rather than lazy: the
 * procedural render is *this* fabric — its weave, its GSM, its dyed hex — so
 * it is always correct and always available. A supplied image can be better
 * looking, but it is only better if it is genuinely of this cloth; a generic
 * macro shot of "some linen" is a downgrade dressed as an upgrade.
 *
 * So the slot exists to let a real, specific image win when there is one, and
 * to guarantee something honest and good when there isn't.
 */
export function ScopeFigure({
  src,
  alt,
  weave,
  hex,
  gsm,
  seed,
  magnify = 3,
  caption,
  aspect = "square",
  className,
}: {
  /** A real photograph or render of this specific cloth, if one exists. */
  src?: string | null;
  alt: string;
  weave: WeaveKey;
  hex: string;
  gsm: number;
  seed: string;
  /** How far to enlarge the weave tile when falling back to the render. */
  magnify?: number;
  caption?: string;
  aspect?: "square" | "wide";
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-[var(--radius-xl)] border border-line bg-canvas-veil p-1.5",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[calc(var(--radius-xl)-9px)]",
          aspect === "wide" ? "aspect-4/3" : "aspect-square",
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="size-full object-cover" loading="lazy" />
        ) : (
          <FabricSwatch weave={weave} hex={hex} gsm={gsm} seed={seed} alt={alt} magnify={magnify} />
        )}

        {caption ? (
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#14120f]/80 to-transparent px-4 pt-10 pb-3">
            <span className="font-mono text-[10.5px] text-white/80">{caption}</span>
          </figcaption>
        ) : null}
      </div>
    </figure>
  );
}
