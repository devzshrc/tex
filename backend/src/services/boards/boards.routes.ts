import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId, titleField, uuidParam } from "../../common/validation";
import { boardsService } from "./boards.service";

const createBoardBody = z.object({ organizationId: uuidParam, title: titleField(120) });
const updateBoardBody = z.object({ title: titleField(120).optional(), archived: z.boolean().optional(), expectedVersion: z.number().int().min(1) });

function includeArchived(req: { query: unknown }): boolean {
  const parsed = z.object({ includeArchived: z.enum(["true", "false"]).default("false") }).parse(req.query);
  return parsed.includeArchived === "true";
}

/** Boards. Mounted at `/api/v1/boards` (auth required). */
export const boardsRouter = Router();
boardsRouter.use(requireSession);

boardsRouter.post("/", async (req, res) => {
  const body = parseBody(createBoardBody, req.body);
  res.status(201).json({ board: await boardsService.create(requireUserId(req), body.organizationId, body.title) });
});

boardsRouter.get("/", async (req, res) => {
  const { organizationId } = parseBody(z.object({ organizationId: uuidParam }), req.query);
  res.json({
    boards: await boardsService.list(requireUserId(req), organizationId, includeArchived(req)),
  });
});

boardsRouter.get("/:boardId", async (req, res) => {
  const boardId = parseBody(uuidParam, req.params.boardId);
  res.json({ board: await boardsService.getDetail(requireUserId(req), boardId, includeArchived(req)) });
});

boardsRouter.patch("/:boardId", async (req, res) => {
  const boardId = parseBody(uuidParam, req.params.boardId);
  const body = parseBody(updateBoardBody, req.body);
  res.json({ board: await boardsService.update(requireUserId(req), boardId, body) });
});

boardsRouter.delete("/:boardId", async (req, res) => {
  await boardsService.remove(requireUserId(req), parseBody(uuidParam, req.params.boardId));
  res.status(204).end();
});
