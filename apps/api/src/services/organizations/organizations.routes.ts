import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../auth/auth.service";
import { parseBody, requireUserId, titleField, userIdParam, uuidParam } from "../../common/validation";
import { organizationsService } from "./organizations.service";

const createOrgBody = z.object({ name: titleField(80), slug: z.string().trim().min(1) });
const renameOrgBody = z.object({ name: titleField(80) });
const roleBody = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });
const inviteBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});
const acceptBody = z.object({ token: z.string().min(1) });
const pageQueryLike = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

/** Org workspace service. Mounted at `/api/v1/organizations` (auth required). */
export const organizationsRouter = Router();
organizationsRouter.use(requireSession);

organizationsRouter.get("/", async (req, res) => {
  res.json({ organizations: await organizationsService.listMine(requireUserId(req)) });
});

organizationsRouter.post("/", async (req, res) => {
  const body = parseBody(createOrgBody, req.body);
  res.status(201).json({ organization: await organizationsService.create(requireUserId(req), body) });
});

// Static sub-path first so it can't collide with `/:orgId`.
organizationsRouter.post("/invites/accept", async (req, res) => {
  const userId = requireUserId(req);
  const email = req.authUser?.email;
  if (!email) throw new Error("Session has no email");
  const { token } = parseBody(acceptBody, req.body);
  res.json({ organization: await organizationsService.acceptInvite(userId, email, token) });
});

organizationsRouter.get("/:orgId", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  res.json({ organization: await organizationsService.getDetail(requireUserId(req), orgId) });
});

organizationsRouter.patch("/:orgId", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  const body = parseBody(renameOrgBody, req.body);
  res.json({ organization: await organizationsService.rename(requireUserId(req), orgId, body.name) });
});

organizationsRouter.delete("/:orgId", async (req, res) => {
  await organizationsService.remove(requireUserId(req), parseBody(uuidParam, req.params.orgId));
  res.status(204).end();
});

organizationsRouter.get("/:orgId/members", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  res.json({ members: await organizationsService.listMembers(requireUserId(req), orgId) });
});

organizationsRouter.patch("/:orgId/members/:userId", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  const targetUserId = parseBody(userIdParam, req.params.userId);
  const { role } = parseBody(roleBody, req.body);
  res.json({
    member: await organizationsService.changeRole(requireUserId(req), orgId, targetUserId, role),
  });
});

organizationsRouter.delete("/:orgId/members/:userId", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  const targetUserId = parseBody(userIdParam, req.params.userId);
  await organizationsService.removeMember(requireUserId(req), orgId, targetUserId);
  res.status(204).end();
});

organizationsRouter.post("/:orgId/invites", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  const body = parseBody(inviteBody, req.body);
  // Returns the raw token transiently (create/refresh only) for the
  // copy-link flow. The list endpoint omits tokens; only hashes are stored.
  // Once a mailer exists, stop returning it here.
  res.status(201).json({ invite: await organizationsService.invite(requireUserId(req), orgId, body) });
});

organizationsRouter.get("/:orgId/invites", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  res.json({ invites: await organizationsService.listInvites(requireUserId(req), orgId) });
});

organizationsRouter.get("/:orgId/audit", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  const query = parseBody(pageQueryLike, req.query);
  res.json(await organizationsService.listAudit(requireUserId(req), orgId, query));
});

organizationsRouter.delete("/:orgId/invites/:inviteId", async (req, res) => {
  const orgId = parseBody(uuidParam, req.params.orgId);
  const inviteId = parseBody(uuidParam, req.params.inviteId);
  await organizationsService.revokeInvite(requireUserId(req), orgId, inviteId);
  res.status(204).end();
});
