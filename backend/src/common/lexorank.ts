/**
 * Fractional ranks as decimal strings: zero-padded integer part plus a
 * minimal fraction, e.g. `00000001.5`. Lexicographic order ALWAYS equals
 * numeric order (fixed-width int, canonical fractions without trailing
 * zeros), so plain string comparison + ORDER BY "just work".
 *
 * Why this shape:
 * - midpoint of two terminating decimals (÷2) always terminates, so a
 *   strict between-value exists at every gap — no exhaustion, ever;
 * - integer part is unbounded in both directions (signed, fixed width),
 *   so prepends/appends are O(1) forever;
 * - length grows ≤1 char per same-int insertion; `needsRebalance` flags
 *   pathological clients, not math.
 */
const INT_WIDTH = 8;
/** Integer space starts mid-range: ~5M sequential prepends/appends of
 *  headroom in each direction before the fixed width is exhausted.
 *  (Negative ints would break lexicographic order, so the floor is
 *  never approached in practice; crossing it throws loudly.) */
const INT_BASE = 5_000_000;
const INT_MIN = 0;
const INT_MAX = 99_999_999;

function padInt(n: number): string {
  if (!Number.isInteger(n) || n < INT_MIN || n > INT_MAX) throw new Error("rank int out of range");
  return String(n).padStart(INT_WIDTH, "0");
}

function split(rank: string): { int: number; frac: string } {
  const dot = rank.indexOf(".");
  if (dot < 0) throw new Error(`invalid rank ${JSON.stringify(rank)}`);
  return { int: Number.parseInt(rank.slice(0, dot), 10), frac: rank.slice(dot + 1) };
}

/** Midpoint fraction strictly between fa and fb (same int part). */
function fracMidpoint(fa: string, fb: string): string {
  const len = Math.max(fa.length, fb.length) + 1;
  const a = BigInt((fa + "0".repeat(len - fa.length)) || "0");
  const b = BigInt((fb + "0".repeat(len - fb.length)) || "0");
  if (a >= b) throw new Error("rankBetween: bounds must differ");
  const sum = a + b;
  let digits = (sum / 2n).toString();
  if (sum % 2n === 1n) digits += "5";
  digits = digits.replace(/0+$/, "");
  return digits === "" ? "0" : digits;
}

export function rankBetween(before: string | null, after: string | null): string {
  if (before === null && after === null) return rankAt(0);
  if (before === null && after !== null) {
    const b = split(after);
    return `${padInt(b.int - 1)}.5`;
  }
  if (before !== null && after === null) {
    const a = split(before);
    return `${padInt(a.int + 1)}.5`;
  }
  const a = split(before as string);
  const b = split(after as string);
  if (a.int === b.int) {
    if (a.frac === b.frac) throw new Error("rankBetween: bounds must differ");
    return `${padInt(a.int)}.${fracMidpoint(a.frac, b.frac)}`;
  }
  if (b.int - a.int >= 2) return `${padInt(a.int + 1)}.5`;
  if (b.int - a.int <= 0) throw new Error("rankBetween: bounds must differ");
  // Adjacent ints: extend the lower fraction — always strictly inside.
  return `${padInt(a.int)}.${a.frac}5`;
}

/** Rank for the i-th item of a fresh sequence (backfills, seeds). */
export function rankAt(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error("rankAt: index must be a non-negative integer");
  return `${padInt(INT_BASE + index + 1)}.5`;
}

/** Append key after the current max (`null` when empty). */
export function rankAppend(max: string | null): string {
  return max === null ? rankAt(0) : rankBetween(max, null);
}

/** Defensive: absurdly long ranks suggest a client bug, not math. */
export function needsRebalance(rank: string): boolean {
  return rank.length > 40;
}
