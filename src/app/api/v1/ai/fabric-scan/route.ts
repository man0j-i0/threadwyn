import { chipsFor, hrefFor, relaxationLadder, scanFabric } from "@/lib/ai/fabric-scan";
import { handleError, ok, parseBody, rateLimit } from "@/lib/api/respond";
import { RATE_RULES } from "@/lib/rate-limit";
import { aiFabricScanSchema } from "@/lib/validation/schemas";
import { getColourwayPalette, searchProducts } from "@/server/services/product-service";

// A vision round-trip is slower than a text one, and the model tier has a 25s
// budget of its own. This has to outlast that, or the platform kills the
// function before the fallback can run.
export const maxDuration = 45;

/** Rows shown inline. Past four the page stops being a summary. */
const PREVIEW = 4;

/**
 * Fabric photo → structured filters.
 *
 * Returns readings and filters only. The caller renders them and links to
 * `/marketplace`, exactly as the `?ask=` path does for typed queries — the scan
 * never gets its own results page, so it cannot show a fabric the ordinary
 * search would not.
 *
 * Open to signed-out visitors on purpose: a buyer holding a swatch has no
 * reason to have an account yet, and this is the cheapest possible way to show
 * them the catalogue is worth one. Rate limiting, not authentication, is what
 * keeps it from being a free vision endpoint.
 *
 * The image is never written anywhere. It is held for the length of one request
 * and dropped — there is no row, no blob, no log line containing it.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, RATE_RULES.aiFabricScan);
  if (limited) return limited;

  try {
    const { image, measured } = await parseBody(req, aiFabricScanSchema);
    const palette = await getColourwayPalette();

    const scan = await scanFabric({ imageDataUri: image, measured, palette });

    // The matches come from `searchProducts` — the same function the
    // marketplace grid calls, with the same ranking. The scan returns a
    // preview of them rather than the caller fetching separately, because
    // there is no public catalogue endpoint to fetch from and adding one to
    // serve four cards would be the wrong trade.
    //
    // Walked tightest-first, giving up one reading at a time, and *topped up*
    // rather than stopped: exact hits keep their place at the head of the list
    // and looser rungs fill the rest.
    //
    // Both halves of that matter. Stopping at the first non-empty rung is
    // precise but returns one row against a catalogue this size, which reads as
    // a broken recommender. Jumping straight to a loose query fills the list
    // but loses the exact match entirely — with `q` dropped there is no
    // relevance signal left to rank it up, so the best answer falls out of the
    // top four.
    type Item = Awaited<ReturnType<typeof searchProducts>>["items"][number];

    const ladder = relaxationLadder(scan.filters);
    const picked: Item[] = [];
    const seen = new Set<string>();

    /** How many matched every reading. Zero when the tightest rung came back empty. */
    let exact = 0;
    /** Last rung we actually took a row from — what "see all" and the chips show. */
    let widest: { filters: typeof scan.filters; total: number; relaxed: string[] } | null = null;

    for (const [index, rung] of ladder.entries()) {
      if (picked.length >= PREVIEW) break;

      const results = await searchProducts({ ...rung.filters, perPage: PREVIEW, page: 1 });
      if (index === 0) exact = results.total;
      if (results.total === 0) continue;

      let drew = false;
      for (const item of results.items) {
        if (picked.length >= PREVIEW || seen.has(item.id)) continue;
        seen.add(item.id);
        picked.push(item);
        drew = true;
      }
      if (drew) widest = { filters: rung.filters, total: results.total, relaxed: rung.relaxed };
    }

    const shown = widest ?? { filters: scan.filters, total: 0, relaxed: [] };

    return ok({
      ...scan,
      // The filters that actually produced these rows, not the ones the reading
      // implied — otherwise "see all 21" would land on a different result set
      // than the one on screen.
      filters: shown.filters,
      chips: chipsFor(shown.filters),
      href: hrefFor(shown.filters),
      // Reported from the widest rung drawn from, not the first one that
      // answered. Those differ whenever an exact hit was too thin to fill the
      // list: taking it from the first rung would say "nothing was relaxed"
      // while the chips and the link had quietly dropped the colour.
      relaxed: shown.relaxed,
      // Lets the page distinguish "no exact match, here is the nearest" from
      // "one exact match, plus near misses to fill the list".
      exact,
      matches: picked,
      total: shown.total,
    });
  } catch (err) {
    return handleError(err);
  }
}
