import { Router } from "express";
import { checkDatabase } from "../../config/database";

/**
 * Platform probes (liveness/readiness) — every orchestrator and the
 * gateway health-checks depend on these. Mounted at `/health`.
 */
export const healthRouter = Router();

healthRouter.get("/live", (_req, res) => {
  res.json({ status: "ok", service: "backend" });
});

healthRouter.get("/ready", async (_req, res) => {
  try {
    await checkDatabase();
    res.json({ status: "ready", checks: { database: "up" } });
  } catch {
    res.status(503).json({ status: "not-ready", checks: { database: "down" } });
  }
});
