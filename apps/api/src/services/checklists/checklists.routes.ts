import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId, titleField, userIdParam, uuidParam } from "../../common/validation";
import { checklistsService } from "./checklists.service";

const rankField = z.string().min(1).max(64);
const createChecklistBody = z.object({
  cardId: uuidParam,
  title: titleField(120),
  beforeRank: rankField.nullish(),
  afterRank: rankField.nullish(),
});
const positionBody = z.object({ beforeRank: rankField.nullable(), afterRank: rankField.nullable() });
const addItemBody = z.object({
  text: titleField(500),
  assigneeUserId: userIdParam.optional(),
  beforeRank: rankField.nullish(),
  afterRank: rankField.nullish(),
});
const updateItemBody = z.object({
  text: titleField(500).optional(),
  complete: z.boolean().optional(),
  assigneeUserId: userIdParam.nullable().optional(),
});
const convertBody = z.object({ toListId: uuidParam.optional() });

/** Checklists + items. Mounted at `/api/v1/checklists`. */
export const checklistsRouter = Router();
checklistsRouter.use(requireSession);

checklistsRouter.post("/", async (req, res) => {
  const body = parseBody(createChecklistBody, req.body);
  res.status(201).json({
    checklist: await checklistsService.create(requireUserId(req), body.cardId, {
      title: body.title,
      beforeRank: body.beforeRank,
      afterRank: body.afterRank,
    }),
  });
});

checklistsRouter.patch("/:checklistId", async (req, res) => {
  const checklistId = parseBody(uuidParam, req.params.checklistId);
  const body = parseBody(z.object({ title: titleField(120) }), req.body);
  res.json({ checklist: await checklistsService.update(requireUserId(req), checklistId, body) });
});

checklistsRouter.post("/:checklistId/position", async (req, res) => {
  const checklistId = parseBody(uuidParam, req.params.checklistId);
  const body = parseBody(positionBody, req.body);
  res.json({ checklist: await checklistsService.reposition(requireUserId(req), checklistId, body) });
});

checklistsRouter.delete("/:checklistId", async (req, res) => {
  await checklistsService.remove(requireUserId(req), parseBody(uuidParam, req.params.checklistId));
  res.status(204).end();
});

checklistsRouter.post("/:checklistId/items", async (req, res) => {
  const checklistId = parseBody(uuidParam, req.params.checklistId);
  const body = parseBody(addItemBody, req.body);
  res.status(201).json({
    item: await checklistsService.addItem(requireUserId(req), checklistId, {
      text: body.text,
      assigneeUserId: body.assigneeUserId,
      beforeRank: body.beforeRank,
      afterRank: body.afterRank,
    }),
  });
});

checklistsRouter.patch("/items/:itemId", async (req, res) => {
  const itemId = parseBody(uuidParam, req.params.itemId);
  const body = parseBody(updateItemBody, req.body);
  res.json({ item: await checklistsService.updateItem(requireUserId(req), itemId, body) });
});

checklistsRouter.post("/items/:itemId/position", async (req, res) => {
  const itemId = parseBody(uuidParam, req.params.itemId);
  const body = parseBody(positionBody, req.body);
  res.json({ item: await checklistsService.repositionItem(requireUserId(req), itemId, body) });
});

checklistsRouter.post("/items/:itemId/convert", async (req, res) => {
  const itemId = parseBody(uuidParam, req.params.itemId);
  const body = parseBody(convertBody, req.body);
  res.status(201).json({
    card: await checklistsService.convertItem(requireUserId(req), itemId, { toListId: body.toListId }),
  });
});

checklistsRouter.delete("/items/:itemId", async (req, res) => {
  await checklistsService.removeItem(requireUserId(req), parseBody(uuidParam, req.params.itemId));
  res.status(204).end();
});
