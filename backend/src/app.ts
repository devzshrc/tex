import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import { env } from "./config/env";
import { httpLogger } from "./common/middleware/request-logger";
import { errorHandler, notFoundHandler } from "./common/middleware/error-handler";
import { authRouter } from "./services/auth/auth.routes";
import { healthRouter } from "./services/health/health.routes";
import { organizationsRouter } from "./services/organizations/organizations.routes";
import { boardsRouter } from "./services/boards/boards.routes";
import { listsRouter } from "./services/lists/lists.routes";
import { cardsRouter } from "./services/cards/cards.routes";
import { labelsRouter } from "./services/labels/labels.routes";
import { checklistsRouter } from "./services/checklists/checklists.routes";
import { attachmentsRouter } from "./services/attachments/attachments.routes";
import { fieldsRouter } from "./services/fields/fields.routes";
import { searchRouter } from "./services/search/search.routes";
import { mutationNotifier, realtimeRouter } from "./services/realtime/realtime.routes";
import { meRouter } from "./services/me/me.routes";

/**
 * Composition root (API gateway): global middleware + service routers.
 * Each service owns its router and URL prefix, so a service can later be
 * split into its own deployable behind this same gateway without
 * changing its routes:
 *   - auth service  → /api/auth  (service routes + Better Auth handler)
 *   - trello domain → /api/v1/organizations, /boards, /lists, /cards
 *   - platform       → /health
 *
 * Ordering matters: the Better Auth handler parses its own body, so it
 * must be mounted BEFORE `express.json()` (per Better Auth docs).
 */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  app.use(cors({ origin: [env.FRONTEND_URL], credentials: true }));
  app.use(httpLogger);

  // Auth service: own REST surface first (falls through on miss)…
  app.use("/api/auth", authRouter);
  // …then the Better Auth protocol handler (terminal for its routes).
  // `app.use` prefix-mounting is used deliberately: it works on both
  // Express 4 (`/api/auth/*`) and Express 5 (`/api/auth/{*any}`) syntax.
  app.use("/api/auth", toNodeHandler(auth));

  // Body parsing for all other (future) services.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Platform probes.
  app.use("/health", healthRouter);

  // Trello domain services (need JSON bodies — mounted after the parser).
  // mutationNotifier fans out realtime board events for every successful
  // Trello mutation; it only observes (never alters) responses.
  app.use("/api/v1", mutationNotifier());
  app.use("/api/v1/organizations", organizationsRouter);
  app.use("/api/v1/boards", boardsRouter);
  app.use("/api/v1/lists", listsRouter);
  app.use("/api/v1/cards", cardsRouter);
  app.use("/api/v1/labels", labelsRouter);
  app.use("/api/v1/checklists", checklistsRouter);
  app.use("/api/v1/attachments", attachmentsRouter);
  app.use("/api/v1/fields", fieldsRouter);
  app.use("/api/v1/search", searchRouter);
  app.use("/api/v1/realtime", realtimeRouter);
  app.use("/api/v1/me", meRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export type App = ReturnType<typeof createApp>;
