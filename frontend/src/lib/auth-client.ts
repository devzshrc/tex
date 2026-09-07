import { createAuthClient } from "better-auth/react";

/**
 * Shared Better Auth client for the React app.
 * `BUN_PUBLIC_AUTH_URL` must be set in `frontend/.env` (Bun only inlines
 * `BUN_PUBLIC_*` vars into the browser bundle). Falls back to the local
 * backend default so `bun run dev` works with zero config.
 */
export const authClient = createAuthClient({
  baseURL: process.env.BUN_PUBLIC_AUTH_URL ?? "http://localhost:8000",
});

export const { signIn, signOut, useSession } = authClient;
