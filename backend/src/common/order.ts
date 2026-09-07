import { conflict } from "./errors";

export const ORDER_GAP = 1024;
const MIN_GAP = 1e-6;

/**
 * Fractional position key between two neighbours (`null` = open end).
 * Single source of truth — clients never compute order values.
 * Throws 409 ORDER_DENSE when the gap is exhausted (caller should
 * renormalize the container, practically unreachable in float64).
 */
export function keyBetween(before: number | null, after: number | null): number {
  if (before === null) {
    if (after === null) return ORDER_GAP;
    return after - ORDER_GAP;
  }
  if (after === null) return before + ORDER_GAP;
  if (after - before < MIN_GAP) {
    throw conflict("ORDER_DENSE", "Position gap exhausted, reload and retry");
  }
  return (before + after) / 2;
}

/** Key for appending after the current max (`null` when empty). */
export function keyAfterLast(lastMax: number | null): number {
  return lastMax == null ? ORDER_GAP : lastMax + ORDER_GAP;
}
