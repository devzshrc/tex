export type DueState = "overdue" | "soon" | "upcoming" | "complete" | "none";

const SOON_MS = 48 * 60 * 60 * 1000;

export function dueState(dueAt: string | null, complete: boolean, now: number = Date.now()): DueState {
  if (!dueAt) return "none";
  if (complete) return "complete";
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return "none";
  if (t < now) return "overdue";
  if (t - now < SOON_MS) return "soon";
  return "upcoming";
}

export function dueLabel(dueAt: string): string {
  return new Date(dueAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** For <input type="datetime-local"> values. */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString();
}
