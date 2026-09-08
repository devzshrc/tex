import { Router } from "express";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId, uuidParam } from "../../common/validation";
import { attachmentsService } from "./attachments.service";

/** Attachment download + delete. Mounted at `/api/v1/attachments`. */
export const attachmentsRouter = Router();
attachmentsRouter.use(requireSession);

attachmentsRouter.get("/:attachmentId/file", async (req, res) => {
  const attachmentId = parseBody(uuidParam, req.params.attachmentId);
  const file = await attachmentsService.read(requireUserId(req), attachmentId);
  res.setHeader("Content-Type", file.mime);
  // Images preview inline; everything else (incl. SVG) downloads — stored
  // files are user content and must never execute in our origin.
  const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, "_");
  res.setHeader("Content-Disposition", `${file.inline ? "inline" : "attachment"}; filename="${asciiName}"`);
  res.setHeader("Content-Length", file.buffer.length);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.end(file.buffer);
});

attachmentsRouter.delete("/:attachmentId", async (req, res) => {
  await attachmentsService.remove(requireUserId(req), parseBody(uuidParam, req.params.attachmentId));
  res.status(204).end();
});
