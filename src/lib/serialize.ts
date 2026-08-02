import { Prisma } from "@prisma/client";

/**
 * Prisma hands back `Decimal` objects and `Date`s, neither of which survives
 * `JSON.stringify` in a shape the client can use. Rather than remembering to
 * map every query by hand, every value crossing the API boundary goes through
 * here: Decimal → number, Date → ISO string, Buffer left alone.
 *
 * Money is stored as DECIMAL(x,2) so arithmetic in Postgres stays exact. It is
 * only widened to a JS number at the very edge, for display.
 */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export function serialize<T>(value: T): Serialized<T> {
  return walk(value) as Serialized<T>;
}

function walk(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Prisma.Decimal.isDecimal(value)) return (value as Prisma.Decimal).toNumber();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(walk);

  if (typeof value === "object") {
    // Buffers and typed arrays are passed through untouched.
    if (ArrayBuffer.isView(value)) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = walk(v);
    }
    return out;
  }

  return value;
}

/** Round to 2dp without the float drift that `toFixed` round-trips introduce. */
export function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
