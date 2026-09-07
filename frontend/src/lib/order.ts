export const ORDER_GAP = 1024;

/** Mirror of the backend key strategy — optimistic order only, server decides. */
export function keyBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return ORDER_GAP;
  if (before == null && after != null) return after - ORDER_GAP;
  if (before != null && after == null) return before + ORDER_GAP;
  return (before + after) / 2;
}

export function keyAfterLast(lastMax: number | null): number {
  return lastMax == null ? ORDER_GAP : lastMax + ORDER_GAP;
}
