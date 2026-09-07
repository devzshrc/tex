import { and, asc, desc, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "../../config/database";
import { board, card, cardAssignee, list, orgMember, organization } from "../../db/schema/trello";

export const meService = {
  /**
   * My actionable reminders: cards assigned to me, not complete, not
   * archived, due within the window. Membership join keeps it to orgs
   * I can still see (removed members lose their reminders).
   */
  async reminders(userId: string, days: number) {
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        id: card.id,
        title: card.title,
        dueAt: card.dueAt,
        dueComplete: card.dueComplete,
        listId: card.listId,
        listTitle: list.title,
        boardId: board.id,
        boardTitle: board.title,
        organizationId: organization.id,
        organizationName: organization.name,
      })
      .from(cardAssignee)
      .innerJoin(card, eq(cardAssignee.cardId, card.id))
      .innerJoin(list, eq(card.listId, list.id))
      .innerJoin(board, eq(list.boardId, board.id))
      .innerJoin(organization, eq(board.organizationId, organization.id))
      .innerJoin(
        orgMember,
        and(eq(orgMember.organizationId, organization.id), eq(orgMember.userId, userId)),
      )
      .where(
        and(
          eq(cardAssignee.userId, userId),
          isNotNull(card.dueAt),
          eq(card.dueComplete, false),
          isNull(card.archivedAt),
          lte(card.dueAt, until),
        ),
      )
      .orderBy(asc(card.dueAt))
      .limit(100);
    return rows;
  },

  /**
   * My Tasks: every card assigned to me in orgs I can still see.
   * Client groups by due state (today / upcoming / no date / completed).
   */
  async tasks(userId: string) {
    return db
      .select({
        id: card.id,
        title: card.title,
        dueAt: card.dueAt,
        dueComplete: card.dueComplete,
        listId: card.listId,
        listTitle: list.title,
        boardId: board.id,
        boardTitle: board.title,
        organizationId: organization.id,
        organizationName: organization.name,
        version: card.version,
        updatedAt: card.updatedAt,
      })
      .from(cardAssignee)
      .innerJoin(card, eq(cardAssignee.cardId, card.id))
      .innerJoin(list, eq(card.listId, list.id))
      .innerJoin(board, eq(list.boardId, board.id))
      .innerJoin(organization, eq(board.organizationId, organization.id))
      .innerJoin(
        orgMember,
        and(eq(orgMember.organizationId, organization.id), eq(orgMember.userId, userId)),
      )
      .where(and(eq(cardAssignee.userId, userId), isNull(card.archivedAt)))
      .orderBy(asc(card.dueAt), desc(card.updatedAt))
      .limit(200);
  },
};
