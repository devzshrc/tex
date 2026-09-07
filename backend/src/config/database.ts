import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema/auth";
import { env } from "./env";

// NOTE: this static import is safe because `src/db/schema/auth.ts` is
// committed. It is (re)generated with `bun run auth:schema` whenever the
// Better Auth options change — generation itself doesn't need the schema,
// so there is no chicken-and-egg on fresh clones.

/**
 * Singleton Postgres pool + Drizzle client shared by every service.
 * `schema` is the Better Auth table set (generated via `bun run auth:schema`
 * into `src/db/schema/auth.ts`) so relational queries (`db.query.*`) and
 * the Better Auth adapter use the same source of truth.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

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
