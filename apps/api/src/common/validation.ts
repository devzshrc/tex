import type { Request } from "express";
import { z } from "zod";
import { HttpError, badRequest } from "./errors";

/** Parse request input with zod; failures become 400 VALIDATION_ERROR. */
export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const first = err.issues[0];
      throw badRequest("VALIDATION_ERROR", first ? `${first.path.join(".") || "body"}: ${first.message}` : "Invalid body");
    }
    throw err;
  }
}

export const uuidParam = z.string().uuid();

/**
 * Better Auth user ids are opaque text (cuid-like), NOT uuids — so member
 * / assignee params validate as non-empty text rather than uuidParam.
 */
export const userIdParam = z.string().trim().min(1, "must not be blank").max(255);

/** requireSession guarantees this; the check keeps handlers total. */
export function requireUserId(req: Request): string {
  const id = req.authUser?.id;
  if (!id) throw new HttpError(401, "UNAUTHENTICATED", "Sign in required");
  return id;
}

export const titleField = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "must not be blank")
    .max(max, `must be at most ${max} characters`);
