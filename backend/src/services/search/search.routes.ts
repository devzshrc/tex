import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId } from "../../common/validation";
import { searchService } from "./search.service";

const searchQuery = z.object({
  q: z.string().default(""),
  limit: z.coerce.number().int().min(1).max(25).default(8),
});

/** Global search (membership-scoped). Mounted at `/api/v1/search`. */
export const searchRouter = Router();
searchRouter.use(requireSession);

searchRouter.get("/", async (req, res) => {
  const { q, limit } = parseBody(searchQuery, req.query);
  res.json(await searchService.search(requireUserId(req), q, limit));
});
