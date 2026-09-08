import { createApp } from "./app";
import { assertEnv, env } from "./config/env";
import { closeDatabase, describeDatabase } from "./config/database";
import { logger } from "./common/utils/logger";
import { startRelay } from "./workers/relay";

assertEnv();

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  logger.warn(
    "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — Google sign-in will fail until they are. " +
      "Create an OAuth client (Web application) in Google Cloud Console → APIs & Services → Credentials, " +
      `register ${env.BETTER_AUTH_URL}/api/auth/callback/google as an authorized redirect URI, ` +
      "and add both values to apps/api/.env.",
  );
}

/** Process entrypoint: bootstrap only — all wiring lives in `createApp()`. */
function bootstrap(): void {
  const app = createApp();
  const relayControl = new AbortController();
  if (env.RELAY_ENABLED) startRelay(relayControl.signal);
  else logger.warn("Outbox relay disabled (RELAY_ENABLED=false) — notifications/audit will queue undelivered.");
  const server = app.listen(env.PORT, () => {
    logger.info(`Backend listening on http://localhost:${env.PORT} (env=${env.NODE_ENV})`);
    logger.info(`Auth handler → ${env.BETTER_AUTH_URL}/api/auth/*`);
    logger.info(`Google redirect URI → ${env.BETTER_AUTH_URL}/api/auth/callback/google`);
    logger.info(`Postgres → ${describeDatabase()}`);
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down…`);
    relayControl.abort();
    server.close(() => {
      void closeDatabase().finally(() => {
        logger.info("Shutdown complete.");
        process.exit(0);
      });
    });
    // Force-exit if connections linger (e.g. in-flight OAuth callbacks).
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => shutdown(signal));
  }
}

bootstrap();
