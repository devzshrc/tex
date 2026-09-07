import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../config/database";
import { board, list } from "../../db/schema/trello";
import { badRequest, conflict, notFound, orNotFound } from "../../common/errors";
import { keyAfterLast, keyBetween } from "../../common/order";
import { loadBoardContext, loadListContext, requireAdmin } from "../organizations/org-access";

async function maxListOrder(boardId: string): Promise<number | null> {
  const [row] = await db
    .select({ order: list.order })
    .from(list)
    .where(and(eq(list.boardId, boardId), isNull(list.archivedAt)))
    .orderBy(desc(list.order))
    .limit(1);
  return row?.order ?? null;
}

export const listsService = {
  async create(
    userId: string,
    boardId: string,
    input: { title: string; beforeOrder?: number | null; afterOrder?: number | null },
  ) {
    // Scope + board existence resolved together; FK maps a concurrent delete.
    await loadBoardContext(userId, boardId);
    const order =
      input.beforeOrder != null || input.afterOrder != null
        ? keyBetween(input.beforeOrder ?? null, input.afterOrder ?? null)
        : keyAfterLast(await maxListOrder(boardId));
    const [created] = await orNotFound(
      () => db.insert(list).values({ title: input.title, boardId, order }).returning(),
      "Board not found",
    );
    if (!created) throw new Error("List insert failed");
    return created;
  },

  async update(
    userId: string,
    listId: string,
    input: { title?: string; archived?: boolean; boardId?: string },
  ) {
    const { scope, list: current } = await loadListContext(userId, listId);
    const patch: Partial<typeof list.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.archived !== undefined) patch.archivedAt = input.archived ? new Date() : null;
    if (input.boardId !== undefined && input.boardId !== current.boardId) {
      // Cross-board move stays inside the org; the list lands at the end.
      const [target] = await db
        .select({ organizationId: board.organizationId })
        .from(board)
        .where(eq(board.id, input.boardId))
        .limit(1);
      if (!target) throw notFound("Board not found");
      if (target.organizationId !== scope.organizationId) {
        throw badRequest("CROSS_ORG_MOVE", "Lists can only move between boards of the same organization");
      }
      patch.boardId = input.boardId;
      patch.order = keyAfterLast(await maxListOrder(input.boardId));
    }
    const [updated] = await orNotFound(
      () => db.update(list).set(patch).where(eq(list.id, listId)).returning(),
      "Board not found",
    );
    // The row existed at scope resolution; a missing update means a
    // concurrent delete won the race.
    if (!updated) throw notFound("List not found");
    return updated;
  },

  async reposition(userId: string, listId: string, input: { beforeOrder: number | null; afterOrder: number | null }) {
    await loadListContext(userId, listId);
    const order = keyBetween(input.beforeOrder, input.afterOrder);
    const [updated] = await db
      .update(list)
      .set({ order, updatedAt: new Date() })
      .where(eq(list.id, listId))
      .returning();
    if (!updated) throw notFound("List not found");
    return updated;
  },

  /** Hard delete: admin only, and only from archived state (archive-first). */
  async remove(userId: string, listId: string) {
    const { scope, list: row } = await loadListContext(userId, listId);
    requireAdmin(scope);
    if (!row.archivedAt) throw conflict("ARCHIVE_FIRST", "Archive the list before deleting it");
    await db.delete(list).where(eq(list.id, listId));
  },
};
