import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authService, requireSession } from "../auth/auth.service";
import { HttpError } from "../../common/errors";
import { parseBody, requireUserId, uuidParam } from "../../common/validation";
import { assertOrgMember } from "../organizations/org-access";
import { db } from "../../config/database";
import { board } from "../../db/schema/trello";
import { eq } from "drizzle-orm";
import {
  consumeTicket,
  mintTicket,
  notifyAttachment,
  notifyBoard,
  notifyCard,
  notifyChecklist,
  notifyChecklistItem,
  notifyComment,
  notifyField,
  notifyLabel,
  notifyList,
  subscribeBoard,
  boardEventsAfter,
} from "./realtime";
import { isCloudflareRuntime } from "../../config/runtime";

/** Realtime board events (SSE). Mounted at `/api/v1/realtime`. */
export const realtimeRouter = Router();

realtimeRouter.post("/ticket", requireSession, async (req, res) => {
  res.json(mintTicket(requireUserId(req)));
});

realtimeRouter.get("/stream", async (req, res) => {
  const { ticket, boardId } = parseBody(
    z.object({ ticket: z.string().min(1).max(2048).optional(), boardId: uuidParam }),
    req.query,
  );
  // Credentialed EventSource is reliable across Worker isolates. Keep the
  // ticket path for older clients that cannot send credentials.
  const userId = ticket
    ? consumeTicket(ticket)
    : (await authService.getSession(req))?.user.id ?? null;
  if (!userId) throw new HttpError(401, "UNAUTHENTICATED", "Sign in required");
  const [row] = await db
    .select({ organizationId: board.organizationId })
    .from(board)
    .where(eq(board.id, boardId))
    .limit(1);
  if (!row) {
    res.status(404).end();
    return;
  }
  // Same masking rule as REST: outsiders learn nothing (stream just 404s).
  await assertOrgMember(userId, row.organizationId);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  const send = (event: { id: string; type: string; boardId?: string; actorId?: string | null; at?: string }) => {
    try {
      res.write(`id: ${event.id}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // Client gone; 'close' cleans up.
    }
  };
  send({ id: "hello", type: "hello" });
  if (isCloudflareRuntime()) {
    let closed = false;
    let after = { at: new Date(), id: "" };
    const heartbeat = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { /* close handler cleans up */ }
    }, 25_000);
    const poll = async () => {
      while (!closed) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        if (closed) return;
        for (const event of await boardEventsAfter(boardId, after)) {
          after = { at: new Date(event.at), id: event.id };
          send(event);
        }
      }
    };
    void poll().catch(() => {
      clearInterval(heartbeat);
      if (!closed) res.end();
    });
    req.on("close", () => { closed = true; clearInterval(heartbeat); });
    return;
  }
  const unsubscribe = subscribeBoard(boardId, (event) => send(event));
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      // Client gone; 'close' cleans up.
    }
  }, 25_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Post-response publish hook: after any successful Trello mutation,
 * resolve the affected board and fan out a `board:updated` event.
 * Mounted once for `/api/v1/*` — services stay unaware of realtime,
 * and future endpoints are covered automatically.
 *
 * Only wraps `res.end` (which `res.json`/`send` all funnel through),
 * fires once, and never fails the request.
 */
export function mutationNotifier() {
  return (req: Request, res: Response, next: NextFunction): void => {
    let fired = false;
    const inner = res.end.bind(res) as (...args: unknown[]) => Response;
    (res as unknown as { end: (...args: unknown[]) => Response }).end = (...args: unknown[]) => {
      if (!fired) {
        fired = true;
        if (MUTATING.has(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
          publishFor(req);
        }
      }
      return inner(...args);
    };
    next();
  };
}

function param(req: Request, name: string): string | null {
  const value: unknown = (req.params as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function publishFor(req: Request): void {
  const actorId: string | null = req.authUser?.id ?? null;
  const cardId = param(req, "cardId");
  if (cardId) {
    notifyCard(cardId, actorId);
    return;
  }
  const commentId = param(req, "commentId");
  if (commentId) {
    notifyComment(commentId, actorId);
    return;
  }
  const listId = param(req, "listId");
  if (listId) {
    notifyList(listId, actorId);
    return;
  }
  const boardId = param(req, "boardId");
  if (boardId) {
    notifyBoard(boardId, actorId);
    return;
  }
  const labelId = param(req, "labelId");
  if (labelId) {
    notifyLabel(labelId, actorId);
    return;
  }
  const checklistId = param(req, "checklistId");
  if (checklistId) {
    notifyChecklist(checklistId, actorId);
    return;
  }
  const itemId = param(req, "itemId");
  if (itemId) {
    notifyChecklistItem(itemId, actorId);
    return;
  }
  const attachmentId = param(req, "attachmentId");
  if (attachmentId) {
    notifyAttachment(attachmentId, actorId);
    return;
  }
  const fieldId = param(req, "fieldId");
  if (fieldId) {
    notifyField(fieldId, actorId);
    return;
  }
  // Creates carry the parent in the body (POST /boards, /labels, /fields,
  // /checklists, /cards with listId).
  const body = req.body as { boardId?: unknown; listId?: unknown; cardId?: unknown } | undefined;
  if (body) {
    if (typeof body.boardId === "string") notifyBoard(body.boardId, actorId);
    else if (typeof body.listId === "string") notifyList(body.listId, actorId);
    else if (typeof body.cardId === "string") notifyCard(body.cardId, actorId);
  }
}
