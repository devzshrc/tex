import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const orgRole = pgEnum("org_role", ["ADMIN", "MEMBER"]);
export type OrgRole = (typeof orgRole.enumValues)[number];

/**
 * Trello domain tables. Identity lives in Better Auth's `user` table —
 * every `userId` here is a Better Auth user id (text), never a separate
 * app-level user row.
 */
export const organization = pgTable("organization", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Immutable after create; always stored lowercase (see slug utils).
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const orgMember = pgTable(
  "org_member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    role: orgRole("role").default("MEMBER").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("org_member_user_org_unique").on(t.userId, t.organizationId),
    index("org_member_org_idx").on(t.organizationId),
  ],
);

export const orgInvite = pgTable(
  "organization_invite",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    role: orgRole("role").default("MEMBER").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("org_invite_org_idx").on(t.organizationId), index("org_invite_email_idx").on(t.email)],
);

export const board = pgTable(
  "board",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Soft-delete first; hard delete only from archived state.
    archivedAt: timestamp("archived_at"),
    // Optimistic concurrency: every mutation bumps version; writers send
    // the version they read and get 409 VERSION_CONFLICT on mismatch.
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("board_org_idx").on(t.organizationId),
    // Trigram GIN: speeds up ILIKE '%q%' substring search (see search.service).
    index("board_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
  ],
);

export const list = pgTable(
  "list",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    // Fractional rank; see src/common/lexorank.ts. Default is rankAt(0);
    // a backfill assigns true positions (scripts/backfill-ranks.ts).
    rank: text("rank").notNull().default("05000001.5"),
    // DEPRECATED (expand phase): float positions, kept only for the
    // rank backfill. Code must use `rank`. Dropped in a later migration.
    order: doublePrecision("order"),
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    archivedAt: timestamp("archived_at"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("list_board_rank_idx").on(t.boardId, t.rank)],
);

export const card = pgTable(
  "card",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    // Fractional rank; see src/common/lexorank.ts. Default is rankAt(0);
    // a backfill assigns true positions (scripts/backfill-ranks.ts).
    rank: text("rank").notNull().default("05000001.5"),
    // DEPRECATED (expand phase): float positions, kept only for the
    // rank backfill. Code must use `rank`. Dropped in a later migration.
    order: doublePrecision("order"),
    listId: uuid("list_id")
      .notNull()
      .references(() => list.id, { onDelete: "cascade" }),
    // Due tracking: null = no due date. Reminders read these (see /me/reminders).
    dueAt: timestamp("due_at"),
    dueComplete: boolean("due_complete").default(false).notNull(),
    // Cover: palette key and/or an image attachment on this card.
    // No FK to attachment (that would cycle card↔attachment and break
    // inference): attachmentsService.remove nulls it in the same tx.
    coverColor: text("cover_color"),
    coverAttachmentId: uuid("cover_attachment_id"),
    storyPoints: integer("story_points"),
    isTemplate: boolean("is_template").default(false).notNull(),
    archivedAt: timestamp("archived_at"),
    version: integer("version").default(1).notNull(),
    lastReminderAt: timestamp("last_reminder_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("card_list_rank_idx").on(t.listId, t.rank),
    index("card_due_idx").on(t.dueAt),
    // Trigram GIN: speeds up ILIKE '%q%' substring search (see search.service).
    index("card_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
    index("card_description_trgm_idx").using("gin", t.description.op("gin_trgm_ops")),
  ],
);

/** Board-scoped color tags. Color is a palette key validated app-side. */
export const label = pgTable(
  "label",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().default(""),
    color: text("color").notNull(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("label_board_idx").on(t.boardId)],
);

export const cardLabel = pgTable(
  "card_label",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => label.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("card_label_unique").on(t.cardId, t.labelId), index("card_label_card_idx").on(t.cardId)],
);

export const checklist = pgTable(
  "checklist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    // Fractional rank; see src/common/lexorank.ts. Default is rankAt(0);
    // a backfill assigns true positions (scripts/backfill-ranks.ts).
    rank: text("rank").notNull().default("05000001.5"),
    // DEPRECATED (expand phase): float positions, kept only for the
    // rank backfill. Code must use `rank`. Dropped in a later migration.
    order: doublePrecision("order"),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("checklist_card_rank_idx").on(t.cardId, t.rank)],
);

export const checklistItem = pgTable(
  "checklist_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    text: text("text").notNull(),
    complete: boolean("complete").default(false).notNull(),
    // Fractional rank; see src/common/lexorank.ts. Default is rankAt(0);
    // a backfill assigns true positions (scripts/backfill-ranks.ts).
    rank: text("rank").notNull().default("05000001.5"),
    // DEPRECATED (expand phase): float positions, kept only for the
    // rank backfill. Code must use `rank`. Dropped in a later migration.
    order: doublePrecision("order"),
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => checklist.id, { onDelete: "cascade" }),
    // Per-item assignee; tombstoned on user delete.
    assigneeUserId: text("assignee_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("checklist_item_rank_idx").on(t.checklistId, t.rank)],
);

export const attachment = pgTable(
  "attachment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    // Opaque key into the local or R2 storage backend.
    storageKey: text("storage_key").notNull().unique(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("attachment_card_idx").on(t.cardId)],
);

export const cardVote = pgTable(
  "card_vote",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("card_vote_unique").on(t.cardId, t.userId)],
);

export const customFieldType = pgEnum("custom_field_type", ["TEXT", "NUMBER", "DATE", "SELECT"]);
export type CustomFieldType = (typeof customFieldType.enumValues)[number];

/** Per-board field definitions (e.g. Priority: select, Budget: number). */
export const customFieldDef = pgTable(
  "custom_field_def",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    type: customFieldType("type").notNull(),
    // SELECT only: ordered choice list.
    options: jsonb("options").$type<string[] | null>(),
    // Fractional rank; see src/common/lexorank.ts. Default is rankAt(0);
    // a backfill assigns true positions (scripts/backfill-ranks.ts).
    rank: text("rank").notNull().default("05000001.5"),
    // DEPRECATED (expand phase): float positions, kept only for the
    // rank backfill. Code must use `rank`. Dropped in a later migration.
    order: doublePrecision("order"),
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("custom_field_def_board_idx").on(t.boardId)],
);

export const customFieldValue = pgTable(
  "custom_field_value",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => customFieldDef.id, { onDelete: "cascade" }),
    valueText: text("value_text"),
    valueNumber: doublePrecision("value_number"),
    valueDate: timestamp("value_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex("custom_field_value_unique").on(t.cardId, t.fieldId)],
);

/**
 * Transactional outbox: durable side-effect intents written atomically
 * with the domain change, then relayed by a worker (see src/workers/).
 * boardId/organizationId ride along so the relay fans out without joins.
 * Emitting is fire-and-forget for request latency; delivery is the
 * relay's job (realtime broadcast, notifications, audit, email).
 */
export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    aggregate: text("aggregate").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    boardId: uuid("board_id"),
    organizationId: uuid("organization_id"),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    actorId: text("actor_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    claimedAt: timestamp("claimed_at"),
    attempts: integer("attempts").default(0).notNull(),
    nextRunAt: timestamp("next_run_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (t) => [
    index("outbox_pending_idx").on(t.processedAt, t.nextRunAt),
    index("outbox_board_created_idx").on(t.boardId, t.createdAt, t.id),
  ],
);

/**
 * Audit spine projection: who did what to which org entity, with request
 * context. Written by the relay (never inline), append-only, no API
 * deletes. Retention is a scheduled sweep, not user action.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown> | null>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    // Exactly-once relay: one audit row per outbox row, retries conflict away.
    outboxId: uuid("outbox_id").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("audit_log_org_created_idx").on(t.organizationId, t.createdAt)],
);

export const notificationType = pgEnum("notification_type", [
  "ASSIGNED",
  "MENTIONED",
  "COMMENTED",
  "VOTED",
  "DUE_SOON",
  "INVITED",
]);
export type NotificationType = (typeof notificationType.enumValues)[number];

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    cardId: uuid("card_id").references(() => card.id, { onDelete: "cascade" }),
    boardId: uuid("board_id").references(() => board.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at"),
    // Exactly-once relay, same pattern as audit_log.
    outboxId: uuid("outbox_id").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("notification_user_created_idx").on(t.userId, t.createdAt), index("notification_user_read_idx").on(t.userId, t.readAt)],
);

export const cardAssignee = pgTable(
  "card_assignee",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    // Live state, not history: gone when the auth user is deleted.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("card_assignee_unique").on(t.cardId, t.userId)],
);

export const cardComment = pgTable(
  "card_comment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    text: text("text").notNull(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    // History: tombstoned (set null → "Deleted user"), never cascaded.
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("card_comment_card_created_idx").on(t.cardId, t.createdAt)],
);

export const cardActivity = pgTable(
  "card_activity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Open vocabulary validated app-side (see activity actions const).
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown> | null>(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("card_activity_card_created_idx").on(t.cardId, t.createdAt)],
);

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(orgMember),
  invites: many(orgInvite),
  boards: many(board),
}));

export const orgMemberRelations = relations(orgMember, ({ one }) => ({
  organization: one(organization, {
    fields: [orgMember.organizationId],
    references: [organization.id],
  }),
  user: one(user, { fields: [orgMember.userId], references: [user.id] }),
}));

export const boardRelations = relations(board, ({ one, many }) => ({
  organization: one(organization, {
    fields: [board.organizationId],
    references: [organization.id],
  }),
  lists: many(list),
  labels: many(label),
  customFieldDefs: many(customFieldDef),
}));

export const listRelations = relations(list, ({ one, many }) => ({
  board: one(board, { fields: [list.boardId], references: [board.id] }),
  cards: many(card),
}));

export const cardRelations = relations(card, ({ one, many }) => ({
  list: one(list, { fields: [card.listId], references: [list.id] }),
  assignees: many(cardAssignee),
  cardLabels: many(cardLabel),
  checklists: many(checklist),
  attachments: many(attachment),
  votes: many(cardVote),
  customFieldValues: many(customFieldValue),
  comments: many(cardComment),
  activities: many(cardActivity),
}));

export const labelRelations = relations(label, ({ one, many }) => ({
  board: one(board, { fields: [label.boardId], references: [board.id] }),
  cardLabels: many(cardLabel),
}));

export const cardLabelRelations = relations(cardLabel, ({ one }) => ({
  card: one(card, { fields: [cardLabel.cardId], references: [card.id] }),
  label: one(label, { fields: [cardLabel.labelId], references: [label.id] }),
}));

export const cardAssigneeRelations = relations(cardAssignee, ({ one }) => ({
  card: one(card, { fields: [cardAssignee.cardId], references: [card.id] }),
  user: one(user, { fields: [cardAssignee.userId], references: [user.id] }),
}));

export const cardCommentRelations = relations(cardComment, ({ one }) => ({
  card: one(card, { fields: [cardComment.cardId], references: [card.id] }),
  user: one(user, { fields: [cardComment.userId], references: [user.id] }),
}));

export const cardActivityRelations = relations(cardActivity, ({ one }) => ({
  card: one(card, { fields: [cardActivity.cardId], references: [card.id] }),
  user: one(user, { fields: [cardActivity.userId], references: [user.id] }),
}));

export const checklistRelations = relations(checklist, ({ one, many }) => ({
  card: one(card, { fields: [checklist.cardId], references: [card.id] }),
  items: many(checklistItem),
}));

export const checklistItemRelations = relations(checklistItem, ({ one }) => ({
  checklist: one(checklist, { fields: [checklistItem.checklistId], references: [checklist.id] }),
  assignee: one(user, { fields: [checklistItem.assigneeUserId], references: [user.id] }),
}));

export const attachmentRelations = relations(attachment, ({ one }) => ({
  card: one(card, { fields: [attachment.cardId], references: [card.id] }),
  uploader: one(user, { fields: [attachment.uploadedBy], references: [user.id] }),
}));

export const cardVoteRelations = relations(cardVote, ({ one }) => ({
  card: one(card, { fields: [cardVote.cardId], references: [card.id] }),
  user: one(user, { fields: [cardVote.userId], references: [user.id] }),
}));

export const customFieldDefRelations = relations(customFieldDef, ({ one, many }) => ({
  board: one(board, { fields: [customFieldDef.boardId], references: [board.id] }),
  values: many(customFieldValue),
}));

export const customFieldValueRelations = relations(customFieldValue, ({ one }) => ({
  card: one(card, { fields: [customFieldValue.cardId], references: [card.id] }),
  field: one(customFieldDef, { fields: [customFieldValue.fieldId], references: [customFieldDef.id] }),
}));
