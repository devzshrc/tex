import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import { attachmentsBucket } from "../config/runtime";
import { HttpError, badRequest, notFound } from "./errors";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Previewable inline in the browser. Everything else downloads.
// SVG can carry scripts — always downloaded, never inlined.
const INLINE_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const BLOCKED_MIME = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "text/javascript",
  "application/x-sh",
  "application/x-msdos-program",
  "application/x-msdownload",
  "application/x-executable",
]);

function uploadDir(): string {
  return path.resolve(process.cwd(), env.UPLOAD_DIR);
}

function sanitizeFileName(raw: string): string {
  const base = path.basename(raw).replace(/[^\w.\-() \[\]]/g, "_").trim();
  const clean = base.replace(/^\.+/, "").slice(0, 180);
  return clean || "file";
}

/**
 * Local-disk storage backend. The rest of the app only knows opaque
 * `storageKey`s, so local disk and R2 share the same service-facing API.
 */
export async function storeUpload(
  originalName: string,
  mime: string,
  bytes: Buffer,
): Promise<{ storageKey: string; size: number }> {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, "FILE_TOO_LARGE", "Files are limited to 10 MB");
  }
  if (BLOCKED_MIME.has(mime.toLowerCase())) {
    throw badRequest("FILE_TYPE_BLOCKED", "That file type is not allowed");
  }
  const storageKey = `${randomUUID()}-${sanitizeFileName(originalName)}`;
  const bucket = attachmentsBucket();
  if (bucket) {
    await bucket.put(storageKey, bytes, {
      httpMetadata: {
        contentType: mime,
        contentDisposition: `attachment; filename="${sanitizeFileName(originalName)}"`,
      },
    });
    return { storageKey, size: bytes.length };
  }
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), storageKey), bytes);
  return { storageKey, size: bytes.length };
}

export async function readUpload(storageKey: string): Promise<Buffer> {
  if (storageKey.includes("/") || storageKey.includes("..")) {
    throw badRequest("INVALID_STORAGE_KEY", "Invalid storage key");
  }
  const bucket = attachmentsBucket();
  if (bucket) {
    const object = await bucket.get(storageKey);
    if (!object) throw notFound("File not found");
    return Buffer.from(await object.arrayBuffer());
  }
  try {
    return await readFile(path.join(uploadDir(), storageKey));
  } catch {
    throw notFound("File not found");
  }
}

export async function deleteUpload(storageKey: string): Promise<void> {
  const bucket = attachmentsBucket();
  if (bucket) {
    await bucket.delete(storageKey);
    return;
  }
  try {
    await unlink(path.join(uploadDir(), storageKey));
  } catch {
    // Already gone — row delete still proceeds.
  }
}

export function inlinePreview(mime: string): boolean {
  return INLINE_MIME.has(mime.toLowerCase());
}
