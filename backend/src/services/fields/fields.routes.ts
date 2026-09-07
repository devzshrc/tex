import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId, titleField, uuidParam } from "../../common/validation";
import { fieldsService } from "./fields.service";
import type { CustomFieldType } from "../../db/schema/trello";

const fieldType = z.enum(["TEXT", "NUMBER", "DATE", "SELECT"]);
const createFieldBody = z.object({
  boardId: uuidParam,
  name: titleField(60),
  type: fieldType,
  options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});
const updateFieldBody = z.object({
  name: titleField(60).optional(),
  options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

/** Board custom-field definitions. Mounted at `/api/v1/fields`. */
export const fieldsRouter = Router();
fieldsRouter.use(requireSession);

fieldsRouter.post("/", async (req, res) => {
  const body = parseBody(createFieldBody, req.body);
  res.status(201).json({
    field: await fieldsService.create(requireUserId(req), body.boardId, {
      name: body.name,
      type: body.type as CustomFieldType,
      options: body.options,
    }),
  });
});

fieldsRouter.patch("/:fieldId", async (req, res) => {
  const fieldId = parseBody(uuidParam, req.params.fieldId);
  const body = parseBody(updateFieldBody, req.body);
  res.json({ field: await fieldsService.update(requireUserId(req), fieldId, body) });
});

fieldsRouter.delete("/:fieldId", async (req, res) => {
  await fieldsService.remove(requireUserId(req), parseBody(uuidParam, req.params.fieldId));
  res.status(204).end();
});
