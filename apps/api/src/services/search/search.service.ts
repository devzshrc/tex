import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
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
   * Match semantics are substring (ILIKE, trigram-GIN indexed); relevance
   * is exact > prefix > substring, then shortest title first.
   */
  async search(userId: string, rawQuery: string, limit: number) {
    const q = rawQuery.trim();
    if (q.length < 2) throw badRequest("QUERY_TOO_SHORT", "Search needs at least 2 characters");
    const pattern = likePattern(q);
    const membership = and(eq(orgMember.organizationId, organization.id), eq(orgMember.userId, userId));

    const boardRank = sql`CASE WHEN lower(${board.title}) = lower(${q}) THEN 0 WHEN starts_with(lower(${board.title}), lower(${q})) THEN 1 ELSE 2 END`;
    const boards = await db
      .select({ id: board.id, title: board.title, organizationId: board.organizationId, organizationName: organization.name })
      .from(board)
      .innerJoin(organization, eq(board.organizationId, organization.id))
      .innerJoin(orgMember, membership)
      .where(and(ilike(board.title, pattern), isNull(board.archivedAt)))
      .orderBy(boardRank, sql`length(${board.title})`, desc(board.updatedAt))
      .limit(limit);

    // Title hits outrank description-only hits.
    const cardRank = sql`CASE WHEN lower(${card.title}) = lower(${q}) THEN 0 WHEN starts_with(lower(${card.title}), lower(${q})) THEN 1 WHEN position(lower(${q}) in lower(${card.title})) > 0 THEN 2 ELSE 3 END`;
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
      .orderBy(cardRank, sql`length(${card.title})`, desc(card.updatedAt))
      .limit(limit);

    // People I share at least one workspace with.
    const myOrgIds = db
      .select({ organizationId: orgMember.organizationId })
      .from(orgMember)
      .where(eq(orgMember.userId, userId));
    // ponytail: DISTINCT can't ORDER BY rank exprs (PG 42P10), so rank ≤25 rows in JS.
    const peopleRows = await db
      .selectDistinct({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user)
      .innerJoin(orgMember, eq(orgMember.userId, user.id))
      .where(and(inArray(orgMember.organizationId, myOrgIds), or(ilike(user.name, pattern), ilike(user.email, pattern))))
      .limit(limit);
    const ql = q.toLowerCase();
    const people = [...peopleRows].sort((a, b) => rankPerson(a) - rankPerson(b) || a.name.length - b.name.length);
    function rankPerson(p: { name: string; email: string }): number {
      const n = p.name.toLowerCase();
      const e = p.email.toLowerCase();
      if (n === ql || e === ql) return 0;
      if (n.startsWith(ql) || e.startsWith(ql)) return 1;
      return 2;
    }

    return { boards, cards, people };
  },
};
