import { and, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { db } from "../../config/database";
import { board, card, list, orgMember, organization } from "../../db/schema/trello";
import { user } from "../../db/schema/auth";
import { badRequest } from "../../common/errors";

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export const searchService = {
  /**
   * Cross-workspace search over everything the caller can see.
   * Membership joins are the visibility boundary (same 404-masking rule).
   */
  async search(userId: string, rawQuery: string, limit: number) {
    const q = rawQuery.trim();
    if (q.length < 2) throw badRequest("QUERY_TOO_SHORT", "Search needs at least 2 characters");
    const pattern = likePattern(q);
    const membership = and(eq(orgMember.organizationId, organization.id), eq(orgMember.userId, userId));

    const boards = await db
      .select({ id: board.id, title: board.title, organizationId: board.organizationId, organizationName: organization.name })
      .from(board)
      .innerJoin(organization, eq(board.organizationId, organization.id))
      .innerJoin(orgMember, membership)
      .where(and(ilike(board.title, pattern), isNull(board.archivedAt)))
      .limit(limit);

    const cards = await db
      .select({
        id: card.id,
        title: card.title,
        listId: card.listId,
        listTitle: list.title,
        boardId: board.id,
        boardTitle: board.title,
        organizationName: organization.name,
      })
      .from(card)
      .innerJoin(list, eq(card.listId, list.id))
      .innerJoin(board, eq(list.boardId, board.id))
      .innerJoin(organization, eq(board.organizationId, organization.id))
      .innerJoin(orgMember, membership)
      .where(and(or(ilike(card.title, pattern), ilike(card.description, pattern)), isNull(card.archivedAt)))
      .limit(limit);

    // People I share at least one workspace with.
    const myOrgIds = db
      .select({ organizationId: orgMember.organizationId })
      .from(orgMember)
      .where(eq(orgMember.userId, userId));
    const people = await db
      .selectDistinct({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user)
      .innerJoin(orgMember, eq(orgMember.userId, user.id))
      .where(and(inArray(orgMember.organizationId, myOrgIds), or(ilike(user.name, pattern), ilike(user.email, pattern))))
      .limit(limit);

    return { boards, cards, people };
  },
};
