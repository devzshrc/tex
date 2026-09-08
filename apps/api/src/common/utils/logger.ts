type Level = "info" | "warn" | "error";

function log(level: Level, message: string, details?: unknown): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  if (details === undefined) {
    // eslint-disable-next-line no-console
    console[level](line);
    return;
  }
  // eslint-disable-next-line no-console
  console[level](line, details);
}

/** Minimal structured logger shared by every service (no dependencies). */
export const logger = {
  info: (message: string, details?: unknown) => log("info", message, details),
  warn: (message: string, details?: unknown) => log("warn", message, details),
  error: (message: string, details?: unknown) => log("error", message, details),
};
