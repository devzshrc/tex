import type { BoardCard, BoardDetail } from "@/lib/trello";

export interface CardFilters {
  q: string;
  labelId: string | null;
  assigneeId: string | null;
  overdueOnly: boolean;
}

export const EMPTY_FILTERS: CardFilters = { q: "", labelId: null, assigneeId: null, overdueOnly: false };

export function isFiltering(f: CardFilters): boolean {
  return f.q.trim() !== "" || f.labelId !== null || f.assigneeId !== null || f.overdueOnly;
}

function cardMatches(card: BoardCard, f: CardFilters, now: number): boolean {
  if (f.overdueOnly) {
    if (!card.dueAt || card.dueComplete || new Date(card.dueAt).getTime() >= now) return false;
  }
  if (f.labelId && !card.cardLabels.some((cl) => cl.labelId === f.labelId)) return false;
  if (f.assigneeId && !card.assignees.some((a) => a.userId === f.assigneeId)) return false;
  const q = f.q.trim().toLowerCase();
  if (q && !`${card.title}\n${card.description ?? ""}`.toLowerCase().includes(q)) return false;
  return true;
}

/**
 * Client-side filter over the loaded board tree. Note for DnD: indexes are
 * computed on the visible set, so a drop between two visible cards can tie
 * with a hidden card in between — ties break by id and the server refetch
 * reconciles. Acceptable for a filter view.
 */
export function filterBoard(board: BoardDetail, f: CardFilters): BoardDetail {
  if (!isFiltering(f)) return board;
  const now = Date.now();
  return {
    ...board,
    lists: board.lists
      .map((l) => ({ ...l, cards: l.cards.filter((c) => cardMatches(c, f, now)) }))
      .filter((l) => l.cards.length > 0),
  };
}
