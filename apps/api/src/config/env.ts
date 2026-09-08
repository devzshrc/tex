import dotenv from "dotenv";
import { runtimeValue } from "./runtime";

// Bun loads `.env` automatically; this keeps the file working when it is
// executed under plain Node (e.g. the Better Auth CLI via npx).
dotenv.config();

function read(name: string, fallback = ""): string {
  const raw = process.env[name] ?? runtimeValue(name);
  return raw !== undefined && raw !== "" ? raw : fallback;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name] ?? runtimeValue(name);
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for env var ${name}: ${JSON.stringify(raw)}`);
  }
  return parsed;
}

const PORT = readInt("PORT", 8000);
const NODE_ENV = read("NODE_ENV", "development");

/**
 * Single source of truth for runtime configuration.
 * All modules import from here instead of touching `process.env` directly,
 * so missing/invalid config fails fast in one place with a clear message.
 */
export const env = {
  NODE_ENV,
  isProd: NODE_ENV === "production",
  PORT,
  BETTER_AUTH_URL: read("BETTER_AUTH_URL", `http://localhost:${PORT}`),
  BETTER_AUTH_SECRET: read("BETTER_AUTH_SECRET", ""),
  FRONTEND_URL: read("FRONTEND_URL", "http://localhost:3000"),
  DATABASE_URL: read("DATABASE_URL", "postgresql://auth:auth@localhost:5433/authdb"),
  UPLOAD_DIR: read("UPLOAD_DIR", "./uploads"),
  RELAY_ENABLED: read("RELAY_ENABLED", "true") === "true",
  REDIS_URL: read("REDIS_URL", ""),
  GOOGLE_CLIENT_ID: read("GOOGLE_CLIENT_ID", ""),
  GOOGLE_CLIENT_SECRET: read("GOOGLE_CLIENT_SECRET", ""),
};

/** Fail fast on config that would otherwise break at runtime. */
export function assertEnv(): void {
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error(
      "BETTER_AUTH_SECRET must be set to a 32+ character secret. " +
        "Generate one with `openssl rand -base64 32` and add it to apps/api/.env.",
    );
  }
  if (!env.BETTER_AUTH_URL || !env.FRONTEND_URL || !env.DATABASE_URL) {
    throw new Error("BETTER_AUTH_URL, FRONTEND_URL, and DATABASE_URL must be configured");
  }
  if (env.isProd && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in production");
  }
}
