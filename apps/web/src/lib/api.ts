const baseURL = process.env.BUN_PUBLIC_AUTH_URL ?? "http://localhost:8000";

/** Backend origin (EventSource uses credentialed cookies for realtime). */
export const apiBase = baseURL;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseURL}/api/v1${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; details?: unknown } };
  if (!res.ok) {
    throw new ApiError(res.status, body.error?.code ?? "REQUEST_ERROR", body.error?.message ?? `Request failed (${res.status})`, body.error?.details);
  }
  return body as T;
}

/** Typed client for the backend Trello API (session cookie attached). */
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Multipart upload (no JSON content-type; browser sets the boundary). */
  upload: async <T>(path: string, form: FormData): Promise<T> => {
    const res = await fetch(`${baseURL}/api/v1${path}`, { method: "POST", credentials: "include", body: form });
    if (res.status === 204) return undefined as T;
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    if (!res.ok) {
      throw new ApiError(res.status, body.error?.code ?? "REQUEST_ERROR", body.error?.message ?? `Upload failed (${res.status})`);
    }
    return body as T;
  },
  /** Authed binary fetch (cookies don't ride <img> cross-origin) → blob URL. */
  blobUrl: async (path: string): Promise<string> => {
    const res = await fetch(`${baseURL}/api/v1${path}`, { credentials: "include" });
    if (!res.ok) throw new ApiError(res.status, "REQUEST_ERROR", `Fetch failed (${res.status})`);
    return URL.createObjectURL(await res.blob());
  },
};
