import { and, eq, sql } from "drizzle-orm";
import { db } from "../../config/database";
import {
  attachment,
  board,
  card,
  cardComment,
  checklist,
  checklistItem,
  customFieldDef,
  label,
  list,
  orgMember,
  type OrgRole,
} from "../../db/schema/trello";
import { forbidden, notFound } from "../../common/errors";

/**
 * Multi-tenancy boundary. Every Trello read/write resolves the owning
 * organization through the id chain and asserts membership here, so route
 * handlers can't forget the check (IDOR-safe by construction).
 * Non-members always see 404 — never leak that an id exists.
 */
export async function getMembership(userId: string, organizationId: string) {
  const [row] = await db
    .select({ role: orgMember.role })
    .from(orgMember)
    .where(and(eq(orgMember.userId, userId), eq(orgMember.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

export async function assertOrgMember(userId: string, organizationId: string) {
  const membership = await getMembership(userId, organizationId);
  if (!membership) throw notFound("Organization not found");
  return membership;
}

export async function assertOrgAdmin(userId: string, organizationId: string) {
  const membership = await assertOrgMember(userId, organizationId);
  if (membership.role !== "ADMIN") throw forbidden("Organization admin required");
  return membership;
}

export async function countAdmins(organizationId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orgMember)
    .where(and(eq(orgMember.organizationId, organizationId), eq(orgMember.role, "ADMIN")));
  return row?.n ?? 0;
}

/* ------------------------------------------------------------------ */
/* Single-resolve contexts: row identity + membership in ONE query.    */
/* Services must prefer these over check-then-fetch pairs so a row     */
/* cannot change scope between the authorization check and the write.  */
/* ------------------------------------------------------------------ */

/** Tenancy resolved once per operation — pass down, never re-derive. */
export interface Scope {
  userId: string;
  organizationId: string;
  role: OrgRole;
}

/** Role gate without another round-trip (scope already resolved). */
export function requireAdmin(scope: Scope): void {
  if (scope.role !== "ADMIN") throw forbidden("Organization admin required");
}

function toScope(userId: string, organizationId: string, role: OrgRole | null, label: string): Scope {
  // Missing membership masks existence: same 404 as a missing row.
  if (!role) throw notFound(`${label} not found`);
  return { userId, organizationId, role };
}

export interface BoardContext {
  scope: Scope;
  board: typeof board.$inferSelect;
}

export async function loadBoardContext(userId: string, boardId: string): Promise<BoardContext> {
  const [row] = await db
    .select({ board, role: orgMember.role })
    .from(board)
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(board.id, boardId))
    .limit(1);
  if (!row) throw notFound("Board not found");
  return { board: row.board, scope: toScope(userId, row.board.organizationId, row.role, "Board") };
}

export interface ListContext {
  scope: Scope;
  list: typeof list.$inferSelect;
}

export async function loadListContext(userId: string, listId: string): Promise<ListContext> {
  const [row] = await db
    .select({ list, organizationId: board.organizationId, role: orgMember.role })
    .from(list)
    .innerJoin(board, eq(list.boardId, board.id))
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(list.id, listId))
    .limit(1);
  if (!row) throw notFound("List not found");
  return { list: row.list, scope: toScope(userId, row.organizationId, row.role, "List") };
}

export interface CardContext {
  scope: Scope;
  card: typeof card.$inferSelect;
  /** Board owning the card (for board-scoped checks: labels, fields). */
  boardId: string;
}

export async function loadCardContext(userId: string, cardId: string): Promise<CardContext> {
  const [row] = await db
    .select({ card, boardId: board.id, organizationId: board.organizationId, role: orgMember.role })
    .from(card)
    .innerJoin(list, eq(card.listId, list.id))
    .innerJoin(board, eq(list.boardId, board.id))
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(card.id, cardId))
    .limit(1);
  if (!row) throw notFound("Card not found");
  return { card: row.card, boardId: row.boardId, scope: toScope(userId, row.organizationId, row.role, "Card") };
}

export interface CommentContext {
  scope: Scope;
  comment: typeof cardComment.$inferSelect;
}

export async function loadCommentContext(userId: string, commentId: string): Promise<CommentContext> {
  const [row] = await db
    .select({ comment: cardComment, organizationId: board.organizationId, role: orgMember.role })
    .from(cardComment)
    .innerJoin(card, eq(cardComment.cardId, card.id))
    .innerJoin(list, eq(card.listId, list.id))
    .innerJoin(board, eq(list.boardId, board.id))
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(cardComment.id, commentId))
    .limit(1);
  if (!row) throw notFound("Comment not found");
  return { comment: row.comment, scope: toScope(userId, row.organizationId, row.role, "Comment") };
}

export interface LabelContext {
  scope: Scope;
  label: typeof label.$inferSelect;
}

export async function loadLabelContext(userId: string, labelId: string): Promise<LabelContext> {
  const [row] = await db
    .select({ label, organizationId: board.organizationId, role: orgMember.role })
    .from(label)
    .innerJoin(board, eq(label.boardId, board.id))
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(label.id, labelId))
    .limit(1);
  if (!row) throw notFound("Label not found");
  return { label: row.label, scope: toScope(userId, row.organizationId, row.role, "Label") };
}

export interface ChecklistContext {
  scope: Scope;
  checklist: typeof checklist.$inferSelect;
}

export async function loadChecklistContext(userId: string, checklistId: string): Promise<ChecklistContext> {
  const [row] = await db
    .select({ checklist, organizationId: board.organizationId, role: orgMember.role })
    .from(checklist)
    .innerJoin(card, eq(checklist.cardId, card.id))
    .innerJoin(list, eq(card.listId, list.id))
    .innerJoin(board, eq(list.boardId, board.id))
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(checklist.id, checklistId))
    .limit(1);
  if (!row) throw notFound("Checklist not found");
  return { checklist: row.checklist, scope: toScope(userId, row.organizationId, row.role, "Checklist") };
}

export interface ChecklistItemContext {
  scope: Scope;
  item: typeof checklistItem.$inferSelect;
  card: typeof card.$inferSelect;
}

export async function loadChecklistItemContext(userId: string, itemId: string): Promise<ChecklistItemContext> {
  const [row] = await db
    .select({ item: checklistItem, card, organizationId: board.organizationId, role: orgMember.role })
    .from(checklistItem)
    .innerJoin(checklist, eq(checklistItem.checklistId, checklist.id))
    .innerJoin(card, eq(checklist.cardId, card.id))
    .innerJoin(list, eq(card.listId, list.id))
    .innerJoin(board, eq(list.boardId, board.id))
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(checklistItem.id, itemId))
    .limit(1);
  if (!row) throw notFound("Checklist item not found");
  return { item: row.item, card: row.card, scope: toScope(userId, row.organizationId, row.role, "Checklist item") };
}

export interface AttachmentContext {
  scope: Scope;
  attachment: typeof attachment.$inferSelect;
}

export async function loadAttachmentContext(userId: string, attachmentId: string): Promise<AttachmentContext> {
  const [row] = await db
    .select({ attachment, organizationId: board.organizationId, role: orgMember.role })
    .from(attachment)
    .innerJoin(card, eq(attachment.cardId, card.id))
    .innerJoin(list, eq(card.listId, list.id))
    .innerJoin(board, eq(list.boardId, board.id))
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(attachment.id, attachmentId))
    .limit(1);
  if (!row) throw notFound("Attachment not found");
  return { attachment: row.attachment, scope: toScope(userId, row.organizationId, row.role, "Attachment") };
}

export interface FieldContext {
  scope: Scope;
  field: typeof customFieldDef.$inferSelect;
}

export async function loadFieldContext(userId: string, fieldId: string): Promise<FieldContext> {
  const [row] = await db
    .select({ field: customFieldDef, organizationId: board.organizationId, role: orgMember.role })
    .from(customFieldDef)
    .innerJoin(board, eq(customFieldDef.boardId, board.id))
    .leftJoin(
      orgMember,
      and(eq(orgMember.organizationId, board.organizationId), eq(orgMember.userId, userId)),
    )
    .where(eq(customFieldDef.id, fieldId))
    .limit(1);
  if (!row) throw notFound("Custom field not found");
  return { field: row.field, scope: toScope(userId, row.organizationId, row.role, "Custom field") };
}
