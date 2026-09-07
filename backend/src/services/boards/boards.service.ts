import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../../config/database";
import { board } from "../../db/schema/trello";
import { conflict, notFound, versionConflict } from "../../common/errors";
import { emitOutbox } from "../../common/outbox";
import { assertOrgMember, loadBoardContext, requireAdmin } from "../organizations/org-access";

function liveOnly(includeArchived: boolean) {
  return includeArchived ? undefined : isNull(board.archivedAt);
}

export const boardsService = {
  async create(userId: string, organizationId: string, title: string) {
    await assertOrgMember(userId, organizationId);
    const [created] = await db.insert(board).values({ title, organizationId }).returning();
    if (!created) throw new Error("Board insert failed");
    return created;
  },

  async list(userId: string, organizationId: string, includeArchived: boolean) {
    await assertOrgMember(userId, organizationId);
    const where = liveOnly(includeArchived);
    return db
      .select()
      .from(board)
      .where(where ? and(eq(board.organizationId, organizationId), where) : eq(board.organizationId, organizationId))
      .orderBy(asc(board.createdAt));
  },

  /** Full board tree: lists → cards → assignees + labels, all ordered. */
  async getDetail(userId: string, boardId: string, includeArchived: boolean) {
    await loadBoardContext(userId, boardId);
    const found = await db.query.board.findFirst({
      where: eq(board.id, boardId),
      with: {
        labels: true,
        customFieldDefs: { orderBy: (t, { asc }) => asc(t.rank) },
        lists: {
          where: includeArchived ? undefined : (t, { isNull }) => isNull(t.archivedAt),
          orderBy: (t, { asc }) => asc(t.rank),
          with: {
            cards: {
              where: includeArchived ? undefined : (t, { isNull }) => isNull(t.archivedAt),
              orderBy: (t, { asc }) => asc(t.rank),
              with: {
                assignees: {
                  with: { user: { columns: { id: true, name: true, email: true, image: true } } },
                },
                cardLabels: { with: { label: true } },
                // Progress bars only need id+complete per item.
                checklists: {
                  columns: { id: true },
                  with: { items: { columns: { id: true, complete: true } } },
                },
                votes: { columns: { userId: true } },
              },
            },
          },
        },
      },
    });
    if (!found) throw notFound("Board not found");
    return found;
  },

  async update(
    userId: string,
    boardId: string,
    input: { title?: string; archived?: boolean; expectedVersion: number },
  ) {
    const { board: current } = await loadBoardContext(userId, boardId);
    const patch: Partial<typeof board.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.archived !== undefined) patch.archivedAt = input.archived ? new Date() : null;
    const [updated] = await db
      .update(board)
      .set({ ...patch, version: current.version + 1 })
      .where(and(eq(board.id, boardId), eq(board.version, input.expectedVersion)))
      .returning();
    if (!updated) throw await versionConflict("Board", () => loadBoardContext(userId, boardId).then((c) => c.board));
    return updated;
  },

  /** Hard delete: admin only, and only from archived state (archive-first). */
  async remove(userId: string, boardId: string) {
    const { scope, board: row } = await loadBoardContext(userId, boardId);
    requireAdmin(scope);
    if (!row.archivedAt) throw conflict("ARCHIVE_FIRST", "Archive the board before deleting it");
    await db.transaction(async (tx) => {
      await tx.delete(board).where(eq(board.id, boardId));
      await emitOutbox(tx, { aggregate: "board", aggregateId: boardId, boardId, organizationId: scope.organizationId, type: "BOARD_DELETED", payload: { title: row.title }, actorId: userId });
    });
  },
};
