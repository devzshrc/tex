import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as authSchema from "../db/schema/auth";
import * as trelloSchema from "../db/schema/trello";
import { env } from "./env";
import { isCloudflareRuntime } from "./runtime";

// NOTE: `src/db/schema/auth.ts` is committed (regenerated with
// `bun run auth:schema` when Better Auth options change); the Trello
// tables live in `src/db/schema/trello.ts`. The Better Auth adapter
// deliberately receives the auth tables only, while `db` serves both.

/**
 * Singleton Postgres pool + Drizzle client shared by every service.
 * Relational queries (`db.query.*`) span auth + Trello tables from this
 * single source of truth.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Workers allow six simultaneous outbound connections per request; leave
  // one slot for auth or another provider call in Cloudflare mode.
  max: isCloudflareRuntime() ? 5 : 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export { authSchema };
const schema = { ...authSchema, ...trelloSchema };
export { schema };
export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

/** Readiness probe target — throws when Postgres is unreachable. */
export async function checkDatabase(): Promise<void> {
  await pool.query("SELECT 1");
}

/** Call on shutdown so the process exits cleanly. */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}

/** Host/db portion of the connection string for logs (no credentials). */
export function describeDatabase(): string {
  try {
    const url = new URL(env.DATABASE_URL);
    return `${url.host}${url.pathname}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}
