import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { uploadSingle } from "../../common/upload";
import { parseBody, requireUserId, titleField, userIdParam, uuidParam } from "../../common/validation";
import { cardsService } from "./cards.service";
import { attachmentsService } from "../attachments/attachments.service";

const orderField = z.number().finite();
const createCardBody = z.object({
  listId: uuidParam,
  title: titleField(255),
  description: z.string().trim().max(20000).optional(),
  beforeOrder: orderField.nullish(),
  afterOrder: orderField.nullish(),
});
const updateCardBody = z.object({
  title: titleField(255).optional(),
  description: z.string().trim().max(20000).nullable().optional(),
  archived: z.boolean().optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  dueComplete: z.boolean().optional(),
  coverColor: z.string().nullable().optional(),
  coverAttachmentId: z.string().uuid().nullable().optional(),
  storyPoints: z.number().int().min(0).max(9999).nullable().optional(),
  isTemplate: z.boolean().optional(),
});
const copyCardBody = z.object({
  toListId: uuidParam.optional(),
  title: titleField(255).optional(),
});
const customValueBody = z.object({ fieldId: uuidParam, value: z.unknown() });
const moveCardBody = z.object({
  toListId: uuidParam,
  beforeOrder: orderField.nullable(),
  afterOrder: orderField.nullable(),
});
const assigneeBody = z.object({ userId: z.string().min(1) });
const commentBody = z.object({ text: z.string().trim().min(1, "must not be blank").max(5000) });
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

/** Cards + assignees + comments + activity. Mounted at `/api/v1/cards`. */
export const cardsRouter = Router();
cardsRouter.use(requireSession);

cardsRouter.post("/", async (req, res) => {
  const body = parseBody(createCardBody, req.body);
  res.status(201).json({
    card: await cardsService.create(requireUserId(req), body.listId, {
      title: body.title,
      description: body.description,
      beforeOrder: body.beforeOrder,
      afterOrder: body.afterOrder,
    }),
  });
});

cardsRouter.get("/:cardId", async (req, res) => {
  res.json({ card: await cardsService.getDetail(requireUserId(req), parseBody(uuidParam, req.params.cardId)) });
});

cardsRouter.patch("/:cardId", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const body = parseBody(updateCardBody, req.body);
  res.json({ card: await cardsService.update(requireUserId(req), cardId, body) });
});

cardsRouter.post("/:cardId/labels", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const body = parseBody(z.object({ labelId: uuidParam }), req.body);
  res.status(201).json(await cardsService.attachLabel(requireUserId(req), cardId, body.labelId));
});

cardsRouter.delete("/:cardId/labels/:labelId", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const labelId = parseBody(uuidParam, req.params.labelId);
  res.json(await cardsService.detachLabel(requireUserId(req), cardId, labelId));
});

cardsRouter.post("/:cardId/move", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const body = parseBody(moveCardBody, req.body);
  res.json({ card: await cardsService.move(requireUserId(req), cardId, body) });
});

cardsRouter.delete("/:cardId", async (req, res) => {
  await cardsService.remove(requireUserId(req), parseBody(uuidParam, req.params.cardId));
  res.status(204).end();
});

cardsRouter.post("/:cardId/copy", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const body = parseBody(copyCardBody, req.body);
  res.status(201).json({ card: await cardsService.copy(requireUserId(req), cardId, body) });
});

cardsRouter.post("/:cardId/vote", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  res.json(await cardsService.toggleVote(requireUserId(req), cardId));
});

cardsRouter.put("/:cardId/fields", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const body = parseBody(customValueBody, req.body);
  res.json({ value: await cardsService.setCustomValue(requireUserId(req), cardId, body) });
});

cardsRouter.delete("/:cardId/fields/:fieldId", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const fieldId = parseBody(uuidParam, req.params.fieldId);
  await cardsService.clearCustomValue(requireUserId(req), cardId, fieldId);
  res.status(204).end();
});

// Multipart upload (field name "file"). Multer errors flow to errorHandler.
cardsRouter.post("/:cardId/attachments", (req: Request, res: Response, next: NextFunction) => {
  uploadSingle(req, res, (uploadErr: unknown) => {
    if (uploadErr) {
      next(uploadErr);
      return;
    }
    const cardId = parseBody(uuidParam, req.params.cardId);
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: { code: "FILE_REQUIRED", message: "Attach a file as multipart field \"file\"" } });
      return;
    }
    attachmentsService
      .upload(requireUserId(req), cardId, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        buffer: file.buffer,
      })
      .then((attachment) => res.status(201).json({ attachment }))
      .catch(next);
  });
});

cardsRouter.post("/:cardId/assignees", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const body = parseBody(assigneeBody, req.body);
  res.status(201).json(await cardsService.assign(requireUserId(req), cardId, body.userId));
});

cardsRouter.delete("/:cardId/assignees/:assigneeUserId", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const assigneeUserId = parseBody(userIdParam, req.params.assigneeUserId);
  res.json(await cardsService.unassign(requireUserId(req), cardId, assigneeUserId));
});

cardsRouter.get("/:cardId/comments", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const query = parseBody(pageQuery, req.query);
  res.json(await cardsService.listComments(requireUserId(req), cardId, query));
});

cardsRouter.post("/:cardId/comments", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const body = parseBody(commentBody, req.body);
  res.status(201).json({ comment: await cardsService.addComment(requireUserId(req), cardId, body.text) });
});

cardsRouter.get("/:cardId/activities", async (req, res) => {
  const cardId = parseBody(uuidParam, req.params.cardId);
  const query = parseBody(pageQuery, req.query);
  res.json(await cardsService.listActivities(requireUserId(req), cardId, query));
});

cardsRouter.patch("/comments/:commentId", async (req, res) => {
  const commentId = parseBody(uuidParam, req.params.commentId);
  const body = parseBody(commentBody, req.body);
  res.json({ comment: await cardsService.updateComment(requireUserId(req), commentId, body.text) });
});

cardsRouter.delete("/comments/:commentId", async (req, res) => {
  await cardsService.deleteComment(requireUserId(req), parseBody(uuidParam, req.params.commentId));
  res.status(204).end();
});
