/** Typed request error. `errorHandler` maps these to JSON responses. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  /** Optional machine-readable payload (e.g. the fresh row on 409). */
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string) => new HttpError(400, code, message);
/** 404 (not 403) for org-scoped ids — never leak existence to outsiders. */
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);
export const forbidden = (message = "Forbidden") => new HttpError(403, "FORBIDDEN", message);
export const conflict = (code: string, message: string) => new HttpError(409, code, message);

/** Postgres code, unwrapping driver wrappers (DrizzleQueryError.cause). */
export function pgCode(err: unknown): string | null {
  let current: unknown = err;
  for (let i = 0; i < 3 && typeof current === "object" && current !== null; i += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export function isUniqueViolation(err: unknown): boolean {
  return pgCode(err) === "23505";
}

function isForeignKeyViolation(err: unknown): boolean {
  return pgCode(err) === "23503";
}

/**
 * A referenced row (target board/list) can vanish between the existence
 * check and the write. The FK constraint is the backstop — map its
 * violation to the same 404 the check would have produced.
 */
export async function orNotFound<T>(fn: () => Promise<T>, message: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isForeignKeyViolation(err)) throw notFound(message);
    throw err;
  }
}

/**
 * Optimistic-concurrency rejection: the row moved on since the caller
 * read it. Carries the fresh row so clients can reconcile (auto-refetch
 * for moves, keep-mine/use-latest dialog for text).
 */
export async function versionConflict<T>(label: string, reload: () => Promise<T>): Promise<never> {
  const current = await reload().catch(() => null);
  throw new HttpError(409, "VERSION_CONFLICT", `${label} changed elsewhere — reload and retry`, { current });
}
