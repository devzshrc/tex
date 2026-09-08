import multer from "multer";
import { MAX_UPLOAD_BYTES } from "./storage";

/** Memory storage: files stay small (capped) and services persist them. */
export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
}).single("file");
