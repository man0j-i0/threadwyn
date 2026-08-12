/**
 * Colour naming for the fabric scan.
 *
 * The browser measures a dominant RGB from the uploaded photo; this turns that
 * triple into a name. The names are not invented — they come from the
 * colourways suppliers actually listed, so the answer is always a colour
 * Threadwyn can sell, and the name is a term that appears in `searchText`.
 *
 * This is the part of the scan that needs no model at all. It runs on pixels,
 * so it works when the inference provider does not.
 */

export type Rgb = { r: number; g: number; b: number };

export type Swatch = { name: string; hex: string };

export function hexToRgb(hex: string): Rgb | null {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/**
 * "Redmean" — a low-cost approximation of perceptual distance.
 *
 * Plain Euclidean RGB distance is wrong in the way that matters here: it treats
 * a shift in blue as being as visible as the same shift in green, so two
 * near-neutrals that look identical on cloth score far apart. Redmean weights
 * each channel by where the pair sits on the red axis and is close enough to
 * CIE76 for naming, without pulling in a Lab conversion.
 *
 * Returned unsquared — only the ordering is used.
 */
export function colourDistance(a: Rgb, b: Rgb): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db,
  );
}

export type ColourMatch = {
  name: string;
  hex: string;
  /** Redmean distance to the measured colour. Lower is closer. */
  distance: number;
};

/** Nearest named swatch, or `null` when the palette is empty. */
export function nearestSwatch(measured: Rgb, palette: readonly Swatch[]): ColourMatch | null {
  let best: ColourMatch | null = null;

  for (const swatch of palette) {
    const rgb = hexToRgb(swatch.hex);
    if (!rgb) continue;
    const distance = colourDistance(measured, rgb);
    if (!best || distance < best.distance) {
      best = { name: swatch.name, hex: swatch.hex, distance };
    }
  }

  return best;
}

/**
 * How much to trust the name.
 *
 * The thresholds are distances, not probabilities. A near-exact hit on a
 * catalogue swatch is worth stating plainly; a photo whose average colour sits
 * between two swatches is not, and saying so is more useful than picking one.
 */
export function colourCertainty(distance: number): "confident" | "likely" | "uncertain" {
  if (distance <= 40) return "confident";
  if (distance <= 110) return "likely";
  return "uncertain";
}

/** `{ r: 231, g: 222, b: 204 }` → `#e7decc`. */
export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, "0")).join("")}`;
}
