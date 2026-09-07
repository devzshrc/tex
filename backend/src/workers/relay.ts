import { and, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../config/database";
import { auditLog, card, cardAssignee, cardComment, notification, organization, outbox } from "../db/schema/trello";
import { user } from "../db/schema/auth";
import { env } from "../config/env";
import { logger } from "../common/utils/logger";

const BATCH = 50;
const MAX_ATTEMPTS = 10;
const STALE_CLAIM_MS = 5 * 60 * 1000;
const RETENTION_DAYS = 7;

interface OutboxRow {
  id: string;
  aggregate: string;
  aggregateId: string;
  boardId: string | null;
  organizationId: string | null;
  type: string;
  payload: Record<string, unknown> | null;
  actorId: string | null;
  attempts: number;
}

async function actorName(actorId: string | null): Promise<string> {
  if (!actorId) return "Someone";
  const [row] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, actorId))
    .limit(1);
  return row?.name ?? row?.email ?? "Someone";
}

async function notifyUser(input: {
  userId: string;
  type: "ASSIGNED" | "MENTIONED" | "COMMENTED" | "VOTED" | "DUE_SOON" | "INVITED";
  title: string;
  body?: string;
  cardId?: string;
  boardId?: string | null;
  outboxId: string;
}): Promise<void> {
  if (!input.userId) return;
  await db
    .insert(notification)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      cardId: input.cardId ?? null,
      boardId: input.boardId ?? null,
      outboxId: input.outboxId,
    })
    .onConflictDoNothing({ target: notification.outboxId });
}

async function audit(input: {
  organizationId: string | null;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  meta?: Record<string, unknown> | null;
  outboxId: string;
}): Promise<void> {
  if (!input.organizationId) return;
  await db
    .insert(auditLog)
    .values({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      meta: input.meta ?? null,
      outboxId: input.outboxId,
    })
    .onConflictDoNothing({ target: auditLog.outboxId });
}

async function cardTitle(cardId: string): Promise<string> {
  const [row] = await db.select({ title: card.title }).from(card).where(eq(card.id, cardId)).limit(1);
  return row?.title ?? "a card";
}

async function orgName(organizationId: string | null): Promise<string> {
  if (!organizationId) return "a workspace";
  const [row] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, organizationId)).limit(1);
  return row?.name ?? "a workspace";
}

/** People following a card: assignees + past commenters, minus the actor. */
async function cardFollowers(cardId: string, actorId: string | null): Promise<string[]> {
  const assignees = await db.select({ userId: cardAssignee.userId }).from(cardAssignee).where(eq(cardAssignee.cardId, cardId));
  const commenters = await db
    .selectDistinct({ userId: cardComment.userId })
    .from(cardComment)
    .where(eq(cardComment.cardId, cardId));
  const ids = new Set<string>();
  for (const r of [...assignees, ...commenters]) {
    if (r.userId && r.userId !== actorId) ids.add(r.userId);
  }
  return [...ids];
}

async function dispatch(row: OutboxRow): Promise<void> {
  const payload = row.payload ?? {};
  const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
  switch (row.type) {
    case "CARD_ASSIGNED": {
      const assignee = str(payload["assigneeUserId"]);
      if (assignee && assignee !== row.actorId) {
        await notifyUser({
          userId: assignee,
          type: "ASSIGNED",
          title: `${await actorName(row.actorId)} assigned you`,
          body: await cardTitle(row.aggregateId),
          cardId: row.aggregateId,
          boardId: row.boardId,
          outboxId: row.id,
        });
      }
      break;
    }
    case "COMMENT_ADDED": {
      const title = await cardTitle(row.aggregateId);
      const by = await actorName(row.actorId);
      for (const userId of await cardFollowers(row.aggregateId, row.actorId)) {
        await notifyUser({ userId, type: "COMMENTED", title: `${by} commented on ${title}`, cardId: row.aggregateId, boardId: row.boardId, outboxId: `${row.id}:${userId}` });
      }
      break;
    }
    case "CARD_VOTED": {
      const title = await cardTitle(row.aggregateId);
      const by = await actorName(row.actorId);
      for (const userId of await cardFollowers(row.aggregateId, row.actorId)) {
        await notifyUser({ userId, type: "VOTED", title: `${by} voted for ${title}`, cardId: row.aggregateId, boardId: row.boardId, outboxId: `${row.id}:${userId}` });
      }
      break;
    }
    case "INVITE_CREATED": {
      // Log driver: a real mailer (Resend etc.) plugs in here with the
      // invite link. The raw token is never persisted, so links can only
      // be mailed at creation time — by design.
      logger.info(`[email:invite] to=${str(payload["email"]) ?? "?"} org=${await orgName(row.organizationId)} role=${str(payload["role"]) ?? "MEMBER"}`);
      await audit({ organizationId: row.organizationId, actorId: row.actorId, action: "INVITE_CREATED", entity: "invite", entityId: row.aggregateId, meta: { email: payload["email"] }, outboxId: row.id });
      break;
    }
    case "MEMBER_ADDED":
      await audit({ organizationId: row.organizationId, actorId: row.actorId, action: "MEMBER_ADDED", entity: "member", entityId: row.aggregateId, meta: { role: payload["role"] }, outboxId: row.id });
      break;
    case "MEMBER_REMOVED":
      await audit({ organizationId: row.organizationId, actorId: row.actorId, action: "MEMBER_REMOVED", entity: "member", entityId: row.aggregateId, meta: null, outboxId: row.id });
      break;
    case "MEMBER_ROLE_CHANGED":
      await audit({ organizationId: row.organizationId, actorId: row.actorId, action: "MEMBER_ROLE_CHANGED", entity: "member", entityId: row.aggregateId, meta: { from: payload["from"], to: payload["to"] }, outboxId: row.id });
      break;
    case "ORG_CREATED":
      await audit({ organizationId: row.organizationId, actorId: row.actorId, action: "ORG_CREATED", entity: "organization", entityId: row.aggregateId, meta: { name: payload["name"] }, outboxId: row.id });
      break;
    case "BOARD_DELETED":
      await audit({ organizationId: row.organizationId, actorId: row.actorId, action: "BOARD_DELETED", entity: "board", entityId: row.aggregateId, meta: { title: payload["title"] }, outboxId: row.id });
      break;
    case "CARD_DELETED":
      await audit({ organizationId: row.organizationId, actorId: row.actorId, action: "CARD_DELETED", entity: "card", entityId: row.aggregateId, meta: { title: payload["title"] }, outboxId: row.id });
      break;
    default:
      logger.warn(`relay: no handler for outbox type ${row.type} (${row.id})`);
  }
}

async function claimBatch(now: Date): Promise<OutboxRow[]> {
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  // Single-flight claim: rows nobody owns, or owned-but-stalled.
  const claimed = await db
    .update(outbox)
    .set({ claimedAt: now, attempts: sql`${outbox.attempts} + 1` })
    .where(
      and(
        isNull(outbox.processedAt),
        lte(outbox.nextRunAt, now),
        lt(outbox.attempts, MAX_ATTEMPTS),
        or(isNull(outbox.claimedAt), lt(outbox.claimedAt, staleBefore)),
      ),
    )
    .returning();
  // Bound the batch in code (UPDATE has no LIMIT): oldest first.
  claimed.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return claimed.slice(0, BATCH).map((r) => ({
    id: r.id,
    aggregate: r.aggregate,
    aggregateId: r.aggregateId,
    boardId: r.boardId,
    organizationId: r.organizationId,
    type: r.type,
    payload: r.payload,
    actorId: r.actorId,
    attempts: r.attempts,
  }));
}

async function processBatch(): Promise<void> {
  const rows = await claimBatch(new Date());
  for (const row of rows) {
    try {
      await dispatch(row);
      await db.update(outbox).set({ processedAt: new Date() }).where(eq(outbox.id, row.id));
    } catch (err) {
      const backoffMs = Math.min(60_000 * 2 ** row.attempts, 15 * 60_1000);
      logger.error(`relay: dispatch failed for ${row.id} (${row.type}), attempt ${row.attempts}`, err);
      await db
        .update(outbox)
        .set({ claimedAt: null, nextRunAt: new Date(Date.now() + backoffMs) })
        .where(eq(outbox.id, row.id));
    }
  }
  // Poison rows: attempts exhausted — park as processed so the queue
  // moves; the error above is the trail. (A dead-letter table is the
  // next step if these ever appear in practice.)
  await db
    .update(outbox)
    .set({ processedAt: new Date() })
    .where(and(isNull(outbox.processedAt), gte(outbox.attempts, MAX_ATTEMPTS)));
}

async function sweepRetention(): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.execute(sql`DELETE FROM outbox WHERE processed_at IS NOT NULL AND processed_at < ${cutoff} LIMIT 500`);
}

/**
 * Background relay. Polls (pg LISTEN/NOTIFY upgrades delivery latency
 * later without changing dispatch); safe to run in every replica —
 * claims are atomic, though a leader election would reduce chatter.
 */
export function startRelay(signal: AbortSignal): void {
  const intervalMs = Number.parseInt(process.env.RELAY_INTERVAL_MS ?? "2000", 10);
  logger.info(`Outbox relay started (every ${intervalMs}ms)`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  const tick = async () => {
    if (signal.aborted || running) return;
    running = true;
    try {
      await processBatch();
      await sweepRetention();
    } catch (err) {
      logger.error("relay tick failed", err);
    } finally {
      running = false;
    }
    if (!signal.aborted) timer = setTimeout(tick, intervalMs);
  };
  void tick();
  signal.addEventListener("abort", () => {
    if (timer) clearTimeout(timer);
  }, { once: true });
}

export async function drainRelayOnce(): Promise<void> {
  await processBatch();
}
