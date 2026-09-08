import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

/** morgan-style request log (kept dependency-free on purpose). */
export function httpLogger(req: Request, res: Response, next: NextFunction): void {
  const started = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
}
