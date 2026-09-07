import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../config/database";
import {
  attachment,
  board,
  card,
  cardActivity,
  cardAssignee,
  cardComment,
  cardLabel,
  cardVote,
  checklist,
  checklistItem,
  customFieldValue,
  list,
} from "../../db/schema/trello";
import { badRequest, conflict, forbidden, notFound, orNotFound } from "../../common/errors";
import { keyAfterLast, keyBetween } from "../../common/order";
import {
  getMembership,
  loadCardContext,
  loadCommentContext,
  loadFieldContext,
  loadLabelContext,
  loadListContext,
  requireAdmin,
} from "../organizations/org-access";
import { LABEL_COLORS } from "../labels/labels.service";

export const ACTIVITY_ACTIONS = [
  "CREATED_CARD",
  "MOVED_CARD",
  "RENAMED_CARD",
  "DESCRIPTION_UPDATED",
  "ASSIGNED",
  "UNASSIGNED",
  "LABEL_ADDED",
  "LABEL_REMOVED",
  "DUE_CHANGED",
  "CHECKLIST_ADDED",
  "CHECKLIST_REMOVED",
  "ITEM_CONVERTED",
  "ATTACHMENT_ADDED",
  "CARD_COPIED",
  "VOTED",
  "UNVOTED",
  "COMMENT_ADDED",
] as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Coerce + validate a custom-field write by definition type. */
function coerceCustomValue(
  field: { type: "TEXT" | "NUMBER" | "DATE" | "SELECT"; options: string[] | null },
  value: unknown,
): { valueText: string | null; valueNumber: number | null; valueDate: Date | null } {
  const blank = { valueText: null, valueNumber: null, valueDate: null };
  switch (field.type) {
    case "TEXT": {
      if (typeof value !== "string") throw badRequest("INVALID_FIELD_VALUE", "Text fields need a string value");
      const text = value.trim().slice(0, 2000);
      return { ...blank, valueText: text || null };
    }
    case "NUMBER": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw badRequest("INVALID_FIELD_VALUE", "Number fields need a finite number");
      }
      return { ...blank, valueNumber: value };
    }
    case "DATE": {
      if (typeof value !== "string") throw badRequest("INVALID_FIELD_VALUE", "Date fields need an ISO string");
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) throw badRequest("INVALID_FIELD_VALUE", "Date fields need an ISO string");
      return { ...blank, valueDate: date };
    }
    case "SELECT": {
      if (typeof value !== "string" || !field.options?.includes(value)) {
        throw badRequest("INVALID_OPTION", "Value must be one of the field's options");
      }
      return { ...blank, valueText: value };
    }
  }
}

async function logActivity(
  client: typeof db | Tx,
  input: { cardId: string; userId: string; action: (typeof ACTIVITY_ACTIONS)[number]; details?: Record<string, unknown> | null },
) {
  await client.insert(cardActivity).values({
    cardId: input.cardId,
    userId: input.userId,
    action: input.action,
    details: input.details ?? null,
  });
}

async function maxCardOrder(listId: string): Promise<number | null> {
  const [row] = await db
    .select({ order: card.order })
    .from(card)
    .where(and(eq(card.listId, listId), isNull(card.archivedAt)))
    .orderBy(desc(card.order))
    .limit(1);
  return row?.order ?? null;
}

/** Keyset page over (createdAt desc, id desc). Cursor is the last seen row id. */
async function keysetCursor(
  table: typeof cardComment | typeof cardActivity,
  cursor: string | undefined,
): Promise<{ createdAt: Date; id: string } | null> {
  if (!cursor) return null;
  const [row] = await db.select({ createdAt: table.createdAt, id: table.id }).from(table).where(eq(table.id, cursor)).limit(1);
  return row ?? null;
}

function keysetWhere(
  table: typeof cardComment | typeof cardActivity,
  anchor: { createdAt: Date; id: string } | null,
  cardId: string,
) {
  const base = eq(table.cardId, cardId);
  if (!anchor) return base;
  return and(
    base,
    or(lt(table.createdAt, anchor.createdAt), and(eq(table.createdAt, anchor.createdAt), lt(table.id, anchor.id))),
  );
}

export const cardsService = {
  async create(
    userId: string,
    listId: string,
    input: { title: string; description?: string; beforeOrder?: number | null; afterOrder?: number | null },
  ) {
    await loadListContext(userId, listId);
    const order =
      input.beforeOrder != null || input.afterOrder != null
        ? keyBetween(input.beforeOrder ?? null, input.afterOrder ?? null)
        : keyAfterLast(await maxCardOrder(listId));
    const [created] = await orNotFound(
      () =>
        db.transaction(async (tx) => {
          const [row] = await tx
            .insert(card)
            .values({ title: input.title, description: input.description ?? null, listId, order })
            .returning();
          if (!row) throw new Error("Card insert failed");
          await logActivity(tx, { cardId: row.id, userId, action: "CREATED_CARD", details: { listId } });
          return [row];
        }),
      "List not found",
    );
    return created;
  },

  async getDetail(userId: string, cardId: string) {
    await loadCardContext(userId, cardId);
    const found = await db.query.card.findFirst({
      where: eq(card.id, cardId),
      with: {
        list: { with: { board: { columns: { id: true, title: true, organizationId: true } } } },
        assignees: {
          with: { user: { columns: { id: true, name: true, email: true, image: true } } },
        },
        cardLabels: { with: { label: true } },
        checklists: {
          orderBy: (t, { asc }) => asc(t.order),
          with: {
            items: {
              orderBy: (t, { asc }) => asc(t.order),
              with: { assignee: { columns: { id: true, name: true, email: true, image: true } } },
            },
          },
        },
        attachments: { orderBy: (t, { asc }) => asc(t.createdAt) },
        votes: { with: { user: { columns: { id: true, name: true, email: true, image: true } } } },
        customFieldValues: { with: { field: true } },
        comments: {
          orderBy: (t, { asc }) => asc(t.createdAt),
          with: { user: { columns: { id: true, name: true, email: true, image: true } } },
        },
        activities: {
          orderBy: (t, { desc }) => desc(t.createdAt),
          limit: 100,
          with: { user: { columns: { id: true, name: true, email: true, image: true } } },
        },
      },
    });
    if (!found) throw notFound("Card not found");
    return found;
  },

  async update(
    userId: string,
    cardId: string,
    input: {
      title?: string;
      description?: string | null;
      archived?: boolean;
      dueAt?: string | null;
      dueComplete?: boolean;
      coverColor?: string | null;
      coverAttachmentId?: string | null;
      storyPoints?: number | null;
      isTemplate?: boolean;
    },
  ) {
    const { card: current } = await loadCardContext(userId, cardId);
    const patch: Partial<typeof card.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.archived !== undefined) patch.archivedAt = input.archived ? new Date() : null;
    const dueAt = input.dueAt === undefined ? undefined : input.dueAt === null ? null : new Date(input.dueAt);
    if (dueAt !== undefined) patch.dueAt = dueAt;
    if (input.dueComplete !== undefined) patch.dueComplete = input.dueComplete;
    if (input.coverColor !== undefined) {
      if (input.coverColor !== null && !(LABEL_COLORS as readonly string[]).includes(input.coverColor)) {
        throw badRequest("INVALID_COLOR", "Cover color must be a palette color or null");
      }
      patch.coverColor = input.coverColor;
    }
    if (input.coverAttachmentId !== undefined) {
      if (input.coverAttachmentId !== null) {
        const [att] = await db
          .select({ cardId: attachment.cardId })
          .from(attachment)
          .where(eq(attachment.id, input.coverAttachmentId))
          .limit(1);
        if (!att || att.cardId !== cardId) {
          throw badRequest("COVER_ATTACHMENT_MISMATCH", "Cover image must be an attachment of this card");
        }
      }
      patch.coverAttachmentId = input.coverAttachmentId;
    }
    if (input.storyPoints !== undefined) patch.storyPoints = input.storyPoints;
    if (input.isTemplate !== undefined) patch.isTemplate = input.isTemplate;
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(card).set(patch).where(eq(card.id, cardId)).returning();
      if (!row) throw notFound("Card not found");
      if (input.title !== undefined && input.title !== current.title) {
        await logActivity(tx, { cardId, userId, action: "RENAMED_CARD", details: { from: current.title, to: input.title } });
      }
      if (input.description !== undefined && input.description !== current.description) {
        await logActivity(tx, { cardId, userId, action: "DESCRIPTION_UPDATED" });
      }
      const dueChanged =
        (dueAt !== undefined && (dueAt?.getTime() ?? null) !== (current.dueAt?.getTime() ?? null)) ||
        (input.dueComplete !== undefined && input.dueComplete !== current.dueComplete);
      if (dueChanged) {
        await logActivity(tx, {
          cardId,
          userId,
          action: "DUE_CHANGED",
          details: {
            from: current.dueAt?.toISOString() ?? null,
            to: (dueAt ?? row.dueAt)?.toISOString() ?? null,
            completed: input.dueComplete ?? row.dueComplete,
          },
        });
      }
      return [row];
    });
    return updated;
  },

  async move(
    userId: string,
    cardId: string,
    input: { toListId: string; beforeOrder: number | null; afterOrder: number | null },
  ) {
    const { card: current, scope: source } = await loadCardContext(userId, cardId);
    const { scope: target } = await loadListContext(userId, input.toListId);
    if (source.organizationId !== target.organizationId) {
      throw badRequest("CROSS_ORG_MOVE", "Cards can only move between lists of the same organization");
    }
    const order = keyBetween(input.beforeOrder, input.afterOrder);
    const [moved] = await orNotFound(
      () =>
        db.transaction(async (tx) => {
          const [row] = await tx
            .update(card)
            .set({ listId: input.toListId, order, updatedAt: new Date() })
            .where(eq(card.id, cardId))
            .returning();
          if (!row) throw notFound("Card not found");
          await logActivity(tx, {
            cardId,
            userId,
            action: "MOVED_CARD",
            details: { fromListId: current.listId, toListId: input.toListId, fromOrder: current.order, toOrder: order },
          });
          return [row];
        }),
      "List not found",
    );
    return moved;
  },

  /** Hard delete: admin only, and only from archived state (archive-first). */
  async remove(userId: string, cardId: string) {
    const { scope, card: row } = await loadCardContext(userId, cardId);
    requireAdmin(scope);
    if (!row.archivedAt) throw conflict("ARCHIVE_FIRST", "Archive the card before deleting it");
    await db.delete(card).where(eq(card.id, cardId));
  },

  /**
   * Deep copy: content, due, cover, points, labels, assignees, checklists
   * (+item state/assignees), custom values, comments, attachments (new
   * rows pointing at the same stored files — no byte duplication).
   * The copy is never a template, even when the source is.
   */
  async copy(userId: string, cardId: string, input: { toListId?: string; title?: string }) {
    const { scope: sourceScope } = await loadCardContext(userId, cardId);
    const toListId = input.toListId;
    if (toListId) {
      const target = await loadListContext(userId, toListId);
      if (target.scope.organizationId !== sourceScope.organizationId) {
        throw badRequest("CROSS_ORG_MOVE", "Cards can only be copied within the same organization");
      }
    }
    const source = await db.query.card.findFirst({
      where: eq(card.id, cardId),
      with: {
        assignees: true,
        cardLabels: true,
        checklists: { with: { items: true } },
        attachments: true,
        comments: true,
        customFieldValues: true,
      },
    });
    if (!source) throw notFound("Card not found");
    const destListId = toListId ?? source.listId;
    const order = keyAfterLast(await maxCardOrder(destListId));
    const [created] = await orNotFound(
      () =>
        db.transaction(async (tx) => {
          const [row] = await tx
            .insert(card)
            .values({
              title: input.title?.trim() || `Copy of ${source.title}`,
              description: source.description,
              listId: destListId,
              order,
              dueAt: source.dueAt,
              dueComplete: false,
              coverColor: source.coverColor,
              storyPoints: source.storyPoints,
              isTemplate: false,
            })
            .returning();
          if (!row) throw new Error("Card copy failed");
          if (source.assignees.length > 0) {
            await tx.insert(cardAssignee).values(source.assignees.map((a) => ({ cardId: row.id, userId: a.userId }))).onConflictDoNothing();
          }
          if (source.cardLabels.length > 0) {
            await tx.insert(cardLabel).values(source.cardLabels.map((cl) => ({ cardId: row.id, labelId: cl.labelId }))).onConflictDoNothing();
          }
          for (const cl of source.checklists) {
            const [list] = await tx
              .insert(checklist)
              .values({ title: cl.title, cardId: row.id, order: cl.order })
              .returning({ id: checklist.id });
            if (!list) throw new Error("Checklist copy failed");
            if (cl.items.length > 0) {
              await tx.insert(checklistItem).values(
                cl.items.map((it) => ({
                  text: it.text,
                  complete: it.complete,
                  order: it.order,
                  checklistId: list.id,
                  assigneeUserId: it.assigneeUserId,
                })),
              );
            }
          }
          if (source.customFieldValues.length > 0) {
            await tx.insert(customFieldValue).values(
              source.customFieldValues.map((v) => ({
                cardId: row.id,
                fieldId: v.fieldId,
                valueText: v.valueText,
                valueNumber: v.valueNumber,
                valueDate: v.valueDate,
              })),
            );
          }
          if (source.comments.length > 0) {
            await tx.insert(cardComment).values(
              source.comments.map((c) => ({ text: c.text, cardId: row.id, userId: c.userId })),
            );
          }
          const attachmentIdMap = new Map<string, string>();
          for (const att of source.attachments) {
            const [copy] = await tx
              .insert(attachment)
              .values({
                fileName: att.fileName,
                mime: att.mime,
                size: att.size,
                storageKey: att.storageKey,
                cardId: row.id,
                uploadedBy: att.uploadedBy,
              })
              .returning({ id: attachment.id });
            if (copy) attachmentIdMap.set(att.id, copy.id);
          }
          if (source.coverAttachmentId) {
            const mapped = attachmentIdMap.get(source.coverAttachmentId);
            if (mapped) await tx.update(card).set({ coverAttachmentId: mapped }).where(eq(card.id, row.id));
          }
          await logActivity(tx, { cardId: row.id, userId, action: "CARD_COPIED", details: { fromCardId: source.id } });
          return [row];
        }),
      "List not found",
    );
    return created;
  },

  /** Toggle vote; returns the new state + count. */
  async toggleVote(userId: string, cardId: string) {
    await loadCardContext(userId, cardId);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: cardVote.id })
        .from(cardVote)
        .where(and(eq(cardVote.cardId, cardId), eq(cardVote.userId, userId)))
        .limit(1);
      if (existing) {
        await tx.delete(cardVote).where(eq(cardVote.id, existing.id));
        await logActivity(tx, { cardId, userId, action: "UNVOTED" });
        return false;
      }
      await tx.insert(cardVote).values({ cardId, userId }).onConflictDoNothing();
      await logActivity(tx, { cardId, userId, action: "VOTED" });
      return true;
    });
    const [countRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(cardVote)
      .where(eq(cardVote.cardId, cardId));
    return { voted: result, votes: countRow?.n ?? 0 };
  },

  async setCustomValue(userId: string, cardId: string, input: { fieldId: string; value: unknown }) {
    const { boardId } = await loadCardContext(userId, cardId);
    const { field } = await loadFieldContext(userId, input.fieldId);
    if (field.boardId !== boardId) {
      throw badRequest("FIELD_BOARD_MISMATCH", "Custom fields belong to their own board");
    }
    const coerced = coerceCustomValue(field, input.value);
    const [row] = await db
      .insert(customFieldValue)
      .values({ cardId, fieldId: field.id, ...coerced })
      .onConflictDoUpdate({
        target: [customFieldValue.cardId, customFieldValue.fieldId],
        set: { ...coerced, updatedAt: new Date() },
      })
      .returning();
    return row;
  },

  async clearCustomValue(userId: string, cardId: string, fieldId: string) {
    await loadCardContext(userId, cardId);
    await loadFieldContext(userId, fieldId);
    await db
      .delete(customFieldValue)
      .where(and(eq(customFieldValue.cardId, cardId), eq(customFieldValue.fieldId, fieldId)));
  },

  async assign(userId: string, cardId: string, assigneeUserId: string) {
    const { scope } = await loadCardContext(userId, cardId);
    const member = await getMembership(assigneeUserId, scope.organizationId);
    if (!member) throw badRequest("NOT_ORG_MEMBER", "Assignees must belong to the organization");
    const inserted = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(cardAssignee)
        .values({ cardId, userId: assigneeUserId })
        .onConflictDoNothing({ target: [cardAssignee.cardId, cardAssignee.userId] })
        .returning({ id: cardAssignee.id });
      if (rows.length > 0) {
        await logActivity(tx, { cardId, userId, action: "ASSIGNED", details: { userId: assigneeUserId } });
        return true;
      }
      return false;
    });
    return { assigned: inserted };
  },

  async unassign(userId: string, cardId: string, assigneeUserId: string) {
    await loadCardContext(userId, cardId);
    const removed = await db.transaction(async (tx) => {
      const rows = await tx
        .delete(cardAssignee)
        .where(and(eq(cardAssignee.cardId, cardId), eq(cardAssignee.userId, assigneeUserId)))
        .returning({ id: cardAssignee.id });
      if (rows.length > 0) {
        await logActivity(tx, { cardId, userId, action: "UNASSIGNED", details: { userId: assigneeUserId } });
        return true;
      }
      return false;
    });
    return { removed };
  },

  async attachLabel(userId: string, cardId: string, labelId: string) {
    const { card: current } = await loadCardContext(userId, cardId);
    const { label: tag } = await loadLabelContext(userId, labelId);
    // Labels live on one board: resolve the card's board and compare.
    const [loc] = await db
      .select({ boardId: board.id })
      .from(card)
      .innerJoin(list, eq(card.listId, list.id))
      .innerJoin(board, eq(list.boardId, board.id))
      .where(eq(card.id, current.id))
      .limit(1);
    if (!loc || loc.boardId !== tag.boardId) {
      throw badRequest("LABEL_BOARD_MISMATCH", "Labels can only be attached to cards on their own board");
    }
    const attached = await db.transaction(async (tx) => {
      const rows = await tx
        .insert(cardLabel)
        .values({ cardId, labelId })
        .onConflictDoNothing({ target: [cardLabel.cardId, cardLabel.labelId] })
        .returning({ id: cardLabel.id });
      if (rows.length > 0) {
        await logActivity(tx, { cardId, userId, action: "LABEL_ADDED", details: { labelId } });
        return true;
      }
      return false;
    });
    return { attached };
  },

  async detachLabel(userId: string, cardId: string, labelId: string) {
    await loadCardContext(userId, cardId);
    const detached = await db.transaction(async (tx) => {
      const rows = await tx
        .delete(cardLabel)
        .where(and(eq(cardLabel.cardId, cardId), eq(cardLabel.labelId, labelId)))
        .returning({ id: cardLabel.id });
      if (rows.length > 0) {
        await logActivity(tx, { cardId, userId, action: "LABEL_REMOVED", details: { labelId } });
        return true;
      }
      return false;
    });
    return { detached };
  },

  async addComment(userId: string, cardId: string, text: string) {
    await loadCardContext(userId, cardId);
    const [comment] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(cardComment).values({ cardId, userId, text }).returning();
      if (!row) throw new Error("Comment insert failed");
      await logActivity(tx, { cardId, userId, action: "COMMENT_ADDED", details: { commentId: row.id } });
      return [row];
    });
    return comment;
  },

  async listComments(userId: string, cardId: string, input: { limit: number; cursor?: string }) {
    await loadCardContext(userId, cardId);
    const anchor = await keysetCursor(cardComment, input.cursor);
    const rows = await db.query.cardComment.findMany({
      where: keysetWhere(cardComment, anchor, cardId),
      orderBy: [desc(cardComment.createdAt), desc(cardComment.id)],
      limit: input.limit + 1,
      with: { user: { columns: { id: true, name: true, email: true, image: true } } },
    });
    // Chronological for display; null user = tombstoned "Deleted user".
    const page = rows.slice(0, input.limit).reverse();
    return { comments: page, nextCursor: rows.length > input.limit ? rows[input.limit - 1]?.id ?? null : null };
  },

  /** Authors edit their own comments; admins may not rewrite others' words. */
  async updateComment(userId: string, commentId: string, text: string) {
    const { comment } = await loadCommentContext(userId, commentId);
    if (comment.userId !== userId) throw forbidden("Only the author can edit this comment");
    const [updated] = await db
      .update(cardComment)
      .set({ text, updatedAt: new Date() })
      .where(eq(cardComment.id, commentId))
      .returning();
    return updated;
  },

  /** Authors delete their own; admins may delete anyone's. */
  async deleteComment(userId: string, commentId: string) {
    const { scope, comment } = await loadCommentContext(userId, commentId);
    if (comment.userId !== userId) requireAdmin(scope);
    await db.delete(cardComment).where(eq(cardComment.id, commentId));
  },

  async listActivities(userId: string, cardId: string, input: { limit: number; cursor?: string }) {
    await loadCardContext(userId, cardId);
    const anchor = await keysetCursor(cardActivity, input.cursor);
    const rows = await db.query.cardActivity.findMany({
      where: keysetWhere(cardActivity, anchor, cardId),
      orderBy: [desc(cardActivity.createdAt), desc(cardActivity.id)],
      limit: input.limit + 1,
      with: { user: { columns: { id: true, name: true, email: true, image: true } } },
    });
    return { activities: rows.slice(0, input.limit), nextCursor: rows.length > input.limit ? rows[input.limit - 1]?.id ?? null : null };
  },
};
