import { Router } from "express";
import { requireSession } from "./auth.service";

/**
 * Auth-service-owned REST surface, mounted at `/api/auth` BEFORE the
 * Better Auth protocol handler (see `src/app.ts`): matched routes are
 * served here, everything else falls through to Better Auth
 * (`/sign-in/*`, `/callback/*`, `/get-session`, …).
 */
export const authRouter = Router();

/** Current caller — example of a protected service route. */
authRouter.get("/me", requireSession, (req, res) => {
  res.json({ session: req.authSession, user: req.authUser });
});
