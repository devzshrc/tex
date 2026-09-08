import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, or } from "drizzle-orm";
import { db } from "../../config/database";
import { env } from "../../config/env";
import { isCloudflareRuntime, scheduleRuntime } from "../../config/runtime";
import { board, card, cardComment, checklist, checklistItem, label, list, attachment, customFieldDef } from "../../db/schema/trello";
import { outbox } from "../../db/schema/trello";

export interface BoardEvent {
  id: string;
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
  if (isCloudflareRuntime()) {
    scheduleRuntime(persistBoardEvent(boardId, actorId));
    return;
  }
  const set = channels.get(boardId);
  if (!set || set.size === 0) return;
  counter += 1;
  const event: BoardEvent = { id: String(counter), boardId, type: "board:updated", actorId, at: new Date().toISOString() };
  for (const send of [...set]) {
    try {
      send(event);
    } catch {
      // A broken subscriber unsubscribes on socket close; never fail a mutation.
    }
  }
}

export async function boardEventsAfter(boardId: string, after: { at: Date; id: string }): Promise<BoardEvent[]> {
  const rows = await db
    .select({ id: outbox.id, actorId: outbox.actorId, at: outbox.createdAt })
    .from(outbox)
    .where(and(
      eq(outbox.boardId, boardId),
      or(
        gt(outbox.createdAt, after.at),
        and(eq(outbox.createdAt, after.at), gt(outbox.id, after.id)),
      ),
    ))
    .orderBy(asc(outbox.createdAt), asc(outbox.id))
    .limit(100);
  return rows.map((row) => ({ id: row.id, boardId, type: "board:updated", actorId: row.actorId, at: row.at.toISOString() }));
}

/* Short-lived signed tickets remain available for older clients. Signing,
   rather than storing tickets in memory, keeps this path isolate-safe. */

export function mintTicket(userId: string): { ticket: string; expiresIn: number } {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 60_000 })).toString("base64url");
  const signature = createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest("base64url");
  const ticket = `${payload}.${signature}`;
  return { ticket, expiresIn: 60 };
}

export function consumeTicket(ticket: string): string | null {
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", env.BETTER_AUTH_SECRET).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId?: unknown; expiresAt?: unknown };
    return typeof parsed.userId === "string" && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now()
      ? parsed.userId
      : null;
  } catch {
    return null;
  }
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

function persistBoardEvent(boardId: string, actorId: string | null): Promise<void> {
  return db.insert(outbox).values({
    aggregate: "board",
    aggregateId: boardId,
    boardId,
    type: "REALTIME_BOARD_UPDATED",
    actorId,
  }).then(() => undefined);
}

function resolveAndPublish(promise: Promise<string | null>, actorId: string | null): void {
  if (isCloudflareRuntime()) {
    scheduleRuntime(promise.then((boardId) => boardId ? persistBoardEvent(boardId, actorId) : undefined));
    return;
  }
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
