import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId } from "../../common/validation";
import { meService } from "./me.service";

const remindersQuery = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

/** Current-user conveniences. Mounted at `/api/v1/me`. */
export const meRouter = Router();
meRouter.use(requireSession);

meRouter.get("/reminders", async (req, res) => {
  const { days } = parseBody(remindersQuery, req.query);
  res.json({ reminders: await meService.reminders(requireUserId(req), days) });
});

meRouter.get("/tasks", async (_req, res) => {
  res.json({ tasks: await meService.tasks(requireUserId(_req)) });
});
