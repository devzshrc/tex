import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId, titleField, uuidParam } from "../../common/validation";
import { listsService } from "./lists.service";

const rankField = z.string().min(1).max(64);
const createListBody = z.object({
  boardId: uuidParam,
  title: titleField(120),
  beforeRank: rankField.nullish(),
  afterRank: rankField.nullish(),
});
const updateListBody = z.object({
  title: titleField(120).optional(),
  archived: z.boolean().optional(),
  boardId: uuidParam.optional(),
  expectedVersion: z.number().int().min(1),
});
const positionBody = z.object({ beforeRank: rankField.nullable(), afterRank: rankField.nullable(), expectedVersion: z.number().int().min(1) });

/** Lists. Mounted at `/api/v1/lists` (auth required). */
export const listsRouter = Router();
listsRouter.use(requireSession);

listsRouter.post("/", async (req, res) => {
  const body = parseBody(createListBody, req.body);
  res.status(201).json({
    list: await listsService.create(requireUserId(req), body.boardId, {
      title: body.title,
      beforeRank: body.beforeRank,
      afterRank: body.afterRank,
    }),
  });
});

listsRouter.patch("/:listId", async (req, res) => {
  const listId = parseBody(uuidParam, req.params.listId);
  const body = parseBody(updateListBody, req.body);
  res.json({ list: await listsService.update(requireUserId(req), listId, body) });
});

listsRouter.post("/:listId/position", async (req, res) => {
  const listId = parseBody(uuidParam, req.params.listId);
  const body = parseBody(positionBody, req.body);
  res.json({ list: await listsService.reposition(requireUserId(req), listId, body) });
});

listsRouter.delete("/:listId", async (req, res) => {
  await listsService.remove(requireUserId(req), parseBody(uuidParam, req.params.listId));
  res.status(204).end();
});
