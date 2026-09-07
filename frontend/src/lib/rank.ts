/**
 * Client mirror of backend src/common/lexorank.ts (optimistic ranks only —
 * the server recomputes canonical values). The two implementations are
 * cross-checked in backend/scripts/verify-trello.ts; keep them in sync.
 */
const INT_WIDTH = 8;
const INT_BASE = 5_000_000;

function padInt(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99_999_999) throw new Error("rank int out of range");
  return String(n).padStart(INT_WIDTH, "0");
}

function split(rank: string): { int: number; frac: string } {
  const dot = rank.indexOf(".");
  if (dot < 0) throw new Error(`invalid rank ${JSON.stringify(rank)}`);
  return { int: Number.parseInt(rank.slice(0, dot), 10), frac: rank.slice(dot + 1) };
}

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
  return `${padInt(a.int)}.${a.frac}5`;
}

export function rankAt(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new Error("rankAt: index must be a non-negative integer");
  return `${padInt(INT_BASE + index + 1)}.5`;
}

export function rankAppend(max: string | null): string {
  return max === null ? rankAt(0) : rankBetween(max, null);
}
