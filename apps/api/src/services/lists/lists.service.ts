import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../config/database";
import { board, list } from "../../db/schema/trello";
import { badRequest, conflict, notFound, orNotFound, versionConflict } from "../../common/errors";
import { rankAppend, rankBetween } from "../../common/lexorank";
import { loadBoardContext, loadListContext, requireAdmin } from "../organizations/org-access";

async function maxListRank(boardId: string): Promise<string | null> {
  const [row] = await db
    .select({ rank: list.rank })
    .from(list)
    .where(and(eq(list.boardId, boardId), isNull(list.archivedAt)))
    .orderBy(desc(list.rank))
    .limit(1);
  return row?.rank ?? null;
}

export const listsService = {
  async create(
    userId: string,
    boardId: string,
    input: { title: string; beforeRank?: string | null; afterRank?: string | null },
  ) {
    // Scope + board existence resolved together; FK maps a concurrent delete.
    await loadBoardContext(userId, boardId);
    const rank =
      input.beforeRank != null || input.afterRank != null
        ? rankBetween(input.beforeRank ?? null, input.afterRank ?? null)
        : rankAppend(await maxListRank(boardId));
    const [created] = await orNotFound(
      () => db.insert(list).values({ title: input.title, boardId, rank }).returning(),
      "Board not found",
    );
    if (!created) throw new Error("List insert failed");
    return created;
  },

  async update(
    userId: string,
    listId: string,
    input: { title?: string; archived?: boolean; boardId?: string; expectedVersion: number },
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
      patch.rank = rankAppend(await maxListRank(input.boardId));
    }
    const [updated] = await orNotFound(
      () =>
        db
          .update(list)
          .set({ ...patch, version: current.version + 1 })
          .where(and(eq(list.id, listId), eq(list.version, input.expectedVersion)))
          .returning(),
      "Board not found",
    );
    // Empty update with a live row means the version guard tripped.
    if (!updated) throw await versionConflict("List", () => loadListContext(userId, listId).then((c) => c.list));
    return updated;
  },

  async reposition(
    userId: string,
    listId: string,
    input: { beforeRank: string | null; afterRank: string | null; expectedVersion: number },
  ) {
    const { list: current } = await loadListContext(userId, listId);
    const rank = rankBetween(input.beforeRank, input.afterRank);
    const [updated] = await db
      .update(list)
      .set({ rank, updatedAt: new Date(), version: current.version + 1 })
      .where(and(eq(list.id, listId), eq(list.version, input.expectedVersion)))
      .returning();
    if (!updated) throw await versionConflict("List", () => loadListContext(userId, listId).then((c) => c.list));
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
