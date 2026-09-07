import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId, uuidParam } from "../../common/validation";
import { LABEL_COLORS, labelsService } from "./labels.service";

const colorField = z.enum(LABEL_COLORS);
const createLabelBody = z.object({
  boardId: uuidParam,
  name: z.string().trim().max(60).default(""),
  color: colorField,
});
const updateLabelBody = z.object({
  name: z.string().trim().max(60).optional(),
  color: colorField.optional(),
});

/** Labels (board-scoped color tags). Mounted at `/api/v1/labels`. */
export const labelsRouter = Router();
labelsRouter.use(requireSession);

labelsRouter.post("/", async (req, res) => {
  const body = parseBody(createLabelBody, req.body);
  res.status(201).json({
    label: await labelsService.create(requireUserId(req), body.boardId, { name: body.name, color: body.color }),
  });
});

labelsRouter.patch("/:labelId", async (req, res) => {
  const labelId = parseBody(uuidParam, req.params.labelId);
  const body = parseBody(updateLabelBody, req.body);
  res.json({ label: await labelsService.update(requireUserId(req), labelId, body) });
});

labelsRouter.delete("/:labelId", async (req, res) => {
  await labelsService.remove(requireUserId(req), parseBody(uuidParam, req.params.labelId));
  res.status(204).end();
});
