import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { board, card, cardComment, checklist, checklistItem, label, list, attachment, customFieldDef } from "../../db/schema/trello";

export interface BoardEvent {
  id: number;
  boardId: string;
  type: "board:updated";
  actorId: string | null;
  at: string;
}

type Sender = (event: BoardEvent) => void;

const channels = new Map<string, Set<Sender>>();
let counter = 0;

/**
 * Single-process pub/sub for board events. Correct for one instance
 * (local dev / single replica); a Redis channel replaces this Map when
 * horizontally scaling — the publish/subscribe surface stays identical.
 */
export function subscribeBoard(boardId: string, send: Sender): () => void {
  let set = channels.get(boardId);
  if (!set) {
    set = new Set();
    channels.set(boardId, set);
  }
  set.add(send);
  return () => {
    set.delete(send);
    if (set.size === 0) channels.delete(boardId);
  };
}

export function publishBoard(boardId: string, actorId: string | null): void {
  const set = channels.get(boardId);
  if (!set || set.size === 0) return;
  counter += 1;
  const event: BoardEvent = { id: counter, boardId, type: "board:updated", actorId, at: new Date().toISOString() };
  for (const send of [...set]) {
    try {
      send(event);
    } catch {
      // A broken subscriber unsubscribes on socket close; never fail a mutation.
    }
  }
}

/* One-shot stream tickets: EventSource can't send headers/cookies
   cross-origin, so an authed POST mints a 60s single-use ticket. */

interface Ticket {
  userId: string;
  expiresAt: number;
}

const tickets = new Map<string, Ticket>();

export function mintTicket(userId: string): { ticket: string; expiresIn: number } {
  if (tickets.size > 500) {
    const now = Date.now();
    for (const [t, v] of tickets) if (v.expiresAt <= now) tickets.delete(t);
  }
  const ticket = randomBytes(32).toString("hex");
  tickets.set(ticket, { userId, expiresAt: Date.now() + 60_000 });
  return { ticket, expiresIn: 60 };
}

export function consumeTicket(ticket: string): string | null {
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.userId;
}

/* Entity → board resolution for the publish middleware (fire-and-forget). */

async function lookupBoardId(query: () => Promise<{ boardId: string }[]>): Promise<string | null> {
  try {
    const [row] = await query();
    return row?.boardId ?? null;
  } catch {
    return null;
  }
}

function resolveAndPublish(promise: Promise<string | null>, actorId: string | null): void {
  promise.then((boardId) => {
    if (boardId) publishBoard(boardId, actorId);
  }).catch(() => {});
}

export function notifyBoard(boardId: string, actorId: string | null): void {
  publishBoard(boardId, actorId);
}

export function notifyCard(cardId: string, actorId: string | null): void {
  resolveAndPublish(
    lookupBoardId(() =>
      db.select({ boardId: board.id }).from(card).innerJoin(list, eq(card.listId, list.id)).innerJoin(board, eq(list.boardId, board.id)).where(eq(card.id, cardId)).limit(1),
    ),
    actorId,
  );
}

export function notifyList(listId: string, actorId: string | null): void {
  resolveAndPublish(
    lookupBoardId(() =>
      db.select({ boardId: board.id }).from(list).innerJoin(board, eq(list.boardId, board.id)).where(eq(list.id, listId)).limit(1),
    ),
    actorId,
  );
}

export function notifyComment(commentId: string, actorId: string | null): void {
  resolveAndPublish(
    lookupBoardId(() =>
      db.select({ boardId: board.id }).from(cardComment).innerJoin(card, eq(cardComment.cardId, card.id)).innerJoin(list, eq(card.listId, list.id)).innerJoin(board, eq(list.boardId, board.id)).where(eq(cardComment.id, commentId)).limit(1),
    ),
    actorId,
  );
}

export function notifyLabel(labelId: string, actorId: string | null): void {
  resolveAndPublish(
    lookupBoardId(() =>
      db.select({ boardId: board.id }).from(label).innerJoin(board, eq(label.boardId, board.id)).where(eq(label.id, labelId)).limit(1),
    ),
    actorId,
  );
}

export function notifyChecklist(checklistId: string, actorId: string | null): void {
  resolveAndPublish(
    lookupBoardId(() =>
      db.select({ boardId: board.id }).from(checklist).innerJoin(card, eq(checklist.cardId, card.id)).innerJoin(list, eq(card.listId, list.id)).innerJoin(board, eq(list.boardId, board.id)).where(eq(checklist.id, checklistId)).limit(1),
    ),
    actorId,
  );
}

export function notifyChecklistItem(itemId: string, actorId: string | null): void {
  resolveAndPublish(
    lookupBoardId(() =>
      db.select({ boardId: board.id }).from(checklistItem).innerJoin(checklist, eq(checklistItem.checklistId, checklist.id)).innerJoin(card, eq(checklist.cardId, card.id)).innerJoin(list, eq(card.listId, list.id)).innerJoin(board, eq(list.boardId, board.id)).where(eq(checklistItem.id, itemId)).limit(1),
    ),
    actorId,
  );
}

export function notifyAttachment(attachmentId: string, actorId: string | null): void {
  resolveAndPublish(
    lookupBoardId(() =>
      db.select({ boardId: board.id }).from(attachment).innerJoin(card, eq(attachment.cardId, card.id)).innerJoin(list, eq(card.listId, list.id)).innerJoin(board, eq(list.boardId, board.id)).where(eq(attachment.id, attachmentId)).limit(1),
    ),
    actorId,
  );
}

export function notifyField(fieldId: string, actorId: string | null): void {
  resolveAndPublish(
    lookupBoardId(() =>
      db.select({ boardId: board.id }).from(customFieldDef).innerJoin(board, eq(customFieldDef.boardId, board.id)).where(eq(customFieldDef.id, fieldId)).limit(1),
    ),
    actorId,
  );
}
