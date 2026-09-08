import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "../config/env";
import { db, authSchema } from "../config/database";

/**
 * Canonical Better Auth instance (Google OAuth only — no password auth).
 *
 * Notes:
 * - `database` uses the Drizzle Postgres adapter over the shared pool.
 *   Tables come from `src/db/schema/auth.ts` (regenerate after changing
 *   auth options with `bun run auth:schema`, then `bun run db:generate`
 *   + `bun run db:migrate`).
 * - `baseURL` MUST be the public backend URL: Google rejects the login when
 *   the callback doesn't match the registered redirect URI
 *   (`<baseURL>/api/auth/callback/google`).
 * - `trustedOrigins` must list the frontend origin or cookie-based
 *   cross-origin sessions are rejected.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  trustedOrigins: [env.FRONTEND_URL],
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
      accessType: "offline",
    },
  },
});

export type Auth = typeof auth;
export type AuthSession = typeof auth.$Infer.Session;
