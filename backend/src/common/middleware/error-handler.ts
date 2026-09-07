import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../common/errors";
import { logger } from "../utils/logger";

/** Final 404 — reached only when no service router handled the request. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

function statusOf(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === "number" && Number.isInteger(status)) return status;
  }
  return 500;
}

/** Central error boundary — services throw, this formats. Must keep 4 args. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Domain errors carry their own machine-readable code — preserve it so
  // clients can branch (SLUG_TAKEN, LAST_ADMIN, ARCHIVE_FIRST, ...).
  // HttpError messages are curated, so they're safe to expose at any status.
  if (err instanceof HttpError) {
    if (err.status >= 500) logger.error("Request failed", err);
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }
  // Multer (multipart uploads) reports outside HttpError — normalize it.
  // Duck-typed to keep multer out of the common layer's imports.
  if (typeof err === "object" && err !== null && (err as { name?: unknown }).name === "MulterError") {
    const code = (err as { code?: unknown }).code;
    if (code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: { code: "FILE_TOO_LARGE", message: "Files are limited to 10 MB" } });
    } else {
      res.status(400).json({ error: { code: "UPLOAD_ERROR", message: "File upload failed" } });
    }
    return;
  }
  const status = statusOf(err);
  if (status >= 500) logger.error("Unhandled request error", err);
  res.status(status).json({
    error: {
      code: status === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
      message: status === 500 ? "Something went wrong" : (err as Error)?.message ?? "Request failed",
    },
  });
}
