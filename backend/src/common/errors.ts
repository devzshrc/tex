/** Typed request error. `errorHandler` maps these to JSON responses. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code: string, message: string) => new HttpError(400, code, message);
/** 404 (not 403) for org-scoped ids — never leak existence to outsiders. */
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message);
export const forbidden = (message = "Forbidden") => new HttpError(403, "FORBIDDEN", message);
export const conflict = (code: string, message: string) => new HttpError(409, code, message);

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}

function isForeignKeyViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23503";
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
