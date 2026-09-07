import { desc, eq } from "drizzle-orm";
import { db } from "../../config/database";
import { card, cardActivity, cardAssignee, checklist, checklistItem } from "../../db/schema/trello";
import { badRequest, notFound } from "../../common/errors";
import { keyAfterLast, keyBetween } from "../../common/order";
import {
  getMembership,
  loadCardContext,
  loadChecklistContext,
  loadChecklistItemContext,
  loadListContext,
} from "../organizations/org-access";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function logChecklistActivity(
  client: typeof db | Tx,
  input: { cardId: string; userId: string; action: "CHECKLIST_ADDED" | "CHECKLIST_REMOVED" | "ITEM_CONVERTED";   details?: Record<string, unknown> | null },
) {
  await client.insert(cardActivity).values({
    cardId: input.cardId,
    userId: input.userId,
    action: input.action,
    details: input.details ?? null,
  });
}

async function maxChecklistOrder(cardId: string): Promise<number | null> {
  const [row] = await db
    .select({ order: checklist.order })
    .from(checklist)
    .where(eq(checklist.cardId, cardId))
    .orderBy(desc(checklist.order))
    .limit(1);
  return row?.order ?? null;
}

async function maxItemOrder(checklistId: string): Promise<number | null> {
  const [row] = await db
    .select({ order: checklistItem.order })
    .from(checklistItem)
    .where(eq(checklistItem.checklistId, checklistId))
    .orderBy(desc(checklistItem.order))
    .limit(1);
  return row?.order ?? null;
}

async function assertAssignee(scopeOrgId: string, assigneeUserId: string): Promise<void> {
  const member = await getMembership(assigneeUserId, scopeOrgId);
  if (!member) throw badRequest("NOT_ORG_MEMBER", "Checklist assignees must belong to the organization");
}

export const checklistsService = {
  async create(
    userId: string,
    cardId: string,
    input: { title: string; beforeOrder?: number | null; afterOrder?: number | null },
  ) {
    await loadCardContext(userId, cardId);
    const order =
      input.beforeOrder != null || input.afterOrder != null
        ? keyBetween(input.beforeOrder ?? null, input.afterOrder ?? null)
        : keyAfterLast(await maxChecklistOrder(cardId));
    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(checklist).values({ title: input.title, cardId, order }).returning();
      if (!row) throw new Error("Checklist insert failed");
      await logChecklistActivity(tx, { cardId, userId, action: "CHECKLIST_ADDED", details: { checklistId: row.id, title: input.title } });
      return [row];
    });
    return created;
  },

  async update(userId: string, checklistId: string, input: { title: string }) {
    await loadChecklistContext(userId, checklistId);
    const [updated] = await db.update(checklist).set({ title: input.title }).where(eq(checklist.id, checklistId)).returning();
    if (!updated) throw notFound("Checklist not found");
    return updated;
  },

  async reposition(userId: string, checklistId: string, input: { beforeOrder: number | null; afterOrder: number | null }) {
    await loadChecklistContext(userId, checklistId);
    const order = keyBetween(input.beforeOrder, input.afterOrder);
    const [updated] = await db.update(checklist).set({ order }).where(eq(checklist.id, checklistId)).returning();
    if (!updated) throw notFound("Checklist not found");
    return updated;
  },

  async remove(userId: string, checklistId: string) {
    const { checklist: row } = await loadChecklistContext(userId, checklistId);
    await db.transaction(async (tx) => {
      await logChecklistActivity(tx, { cardId: row.cardId, userId, action: "CHECKLIST_REMOVED", details: { checklistId } });
      await tx.delete(checklist).where(eq(checklist.id, checklistId));
    });
  },

  async addItem(
    userId: string,
    checklistId: string,
    input: { text: string; assigneeUserId?: string; beforeOrder?: number | null; afterOrder?: number | null },
  ) {
    const { scope } = await loadChecklistContext(userId, checklistId);
    if (input.assigneeUserId) await assertAssignee(scope.organizationId, input.assigneeUserId);
    const order =
      input.beforeOrder != null || input.afterOrder != null
        ? keyBetween(input.beforeOrder ?? null, input.afterOrder ?? null)
        : keyAfterLast(await maxItemOrder(checklistId));
    const [created] = await db
      .insert(checklistItem)
      .values({ text: input.text, checklistId, order, assigneeUserId: input.assigneeUserId ?? null })
      .returning();
    if (!created) throw new Error("Checklist item insert failed");
    return created;
  },

  async updateItem(
    userId: string,
    itemId: string,
    input: { text?: string; complete?: boolean; assigneeUserId?: string | null },
  ) {
    const { scope, item } = await loadChecklistItemContext(userId, itemId);
    if (input.assigneeUserId) await assertAssignee(scope.organizationId, input.assigneeUserId);
    const patch: Partial<typeof checklistItem.$inferInsert> = { updatedAt: new Date() };
    if (input.text !== undefined) patch.text = input.text;
    if (input.complete !== undefined) patch.complete = input.complete;
    if (input.assigneeUserId !== undefined) patch.assigneeUserId = input.assigneeUserId;
    const [updated] = await db.update(checklistItem).set(patch).where(eq(checklistItem.id, item.id)).returning();
    if (!updated) throw notFound("Checklist item not found");
    return updated;
  },

  async repositionItem(userId: string, itemId: string, input: { beforeOrder: number | null; afterOrder: number | null }) {
    await loadChecklistItemContext(userId, itemId);
    const order = keyBetween(input.beforeOrder, input.afterOrder);
    const [updated] = await db
      .update(checklistItem)
      .set({ order, updatedAt: new Date() })
      .where(eq(checklistItem.id, itemId))
      .returning();
    if (!updated) throw notFound("Checklist item not found");
    return updated;
  },

  async removeItem(userId: string, itemId: string) {
    await loadChecklistItemContext(userId, itemId);
    await db.delete(checklistItem).where(eq(checklistItem.id, itemId));
  },

  /**
   * Turn an item into a real card in the same (or a given) list, carrying
   * the text + assignee over. The item is marked complete; source card
   * gets an ITEM_CONVERTED activity pointing at the new card.
   */
  async convertItem(userId: string, itemId: string, input: { toListId?: string }) {
    const { scope, item, card: source } = await loadChecklistItemContext(userId, itemId);
    const toListId = input.toListId ?? source.listId;
    if (input.toListId) {
      const target = await loadListContext(userId, input.toListId);
      if (target.scope.organizationId !== scope.organizationId) {
        throw badRequest("CROSS_ORG_MOVE", "Items can only convert within the same organization");
      }
    }
    const order = keyAfterLast(
      (
        await db
          .select({ order: card.order })
          .from(card)
          .where(eq(card.listId, toListId))
          .orderBy(desc(card.order))
          .limit(1)
      )[0]?.order ?? null,
    );
    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(card)
        .values({ title: item.text, listId: toListId, order, description: null })
        .returning();
      if (!row) throw new Error("Card insert failed");
      if (item.assigneeUserId) {
        await tx.insert(cardAssignee).values({ cardId: row.id, userId: item.assigneeUserId }).onConflictDoNothing();
      }
      await tx.update(checklistItem).set({ complete: true, updatedAt: new Date() }).where(eq(checklistItem.id, item.id));
      await logChecklistActivity(tx, {
        cardId: source.id,
        userId,
        action: "ITEM_CONVERTED",
        details: { itemId: item.id, newCardId: row.id },
      });
      return [row];
    });
    return created;
  },
};
