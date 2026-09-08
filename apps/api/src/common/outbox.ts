import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { outbox } from "../db/schema/trello";
import type * as schema from "../db/schema/trello";

type Db = NodePgDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface OutboxEvent {
  aggregate: "card" | "board" | "list" | "member" | "invite" | "comment" | "label" | "checklist";
  aggregateId: string;
  boardId?: string | null;
  organizationId?: string | null;
  /** Domain event, e.g. CARD_MOVED. The relay maps these to handlers. */
  type: string;
  payload?: Record<string, unknown> | null;
  actorId?: string | null;
}

/**
 * Durable side-effect intent, written in the SAME transaction as the
 * domain change. Cheap (one insert), always ordered (createdAt), and
 * the relay owns delivery — requests never wait for fan-out.
 */
export async function emitOutbox(client: Db | Tx, event: OutboxEvent): Promise<void> {
  await client.insert(outbox).values({
    aggregate: event.aggregate,
    aggregateId: event.aggregateId,
    boardId: event.boardId ?? null,
    organizationId: event.organizationId ?? null,
    type: event.type,
    payload: event.payload ?? null,
    actorId: event.actorId ?? null,
  });
}
