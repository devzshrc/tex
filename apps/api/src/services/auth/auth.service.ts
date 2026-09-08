import type { NextFunction, Request, Response } from "express";
import { auth, type AuthSession } from "../../lib/auth";

// Augment Express so downstream services read the session in a typed way.
declare global {
  namespace Express {
    interface Request {
      authSession?: AuthSession["session"];
      authUser?: AuthSession["user"];
    }
  }
}

function toWebHeaders(req: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

/**
 * Auth domain service — the microservice boundary for identity.
 * Route handlers depend on this (not on Better Auth directly), so the
 * service can be extracted into a standalone process without touching
 * callers. Currently Google OAuth only.
 */
export const authService = {
  getSession: (req: Request) => auth.api.getSession({ headers: toWebHeaders(req) }),
};

/**
 * Guard for protected service routes. Attaches `req.authSession` /
 * `req.authUser` and rejects unauthenticated callers with 401.
 */
export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await authService.getSession(req);
  if (!session) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in required" } });
    return;
  }
  req.authSession = session.session;
  req.authUser = session.user;
  next();
}
