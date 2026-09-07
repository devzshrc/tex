import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../config/database";
import { orgInvite, orgMember, organization } from "../../db/schema/trello";
import { user } from "../../db/schema/auth";
import { badRequest, conflict, isUniqueViolation, notFound } from "../../common/errors";
import { assertOrgAdmin, assertOrgMember, countAdmins } from "./org-access";

const SLUG_RE = /^[a-z0-9-]{3,48}$/;
const RESERVED_SLUGS = new Set([
  "api",
  "auth",
  "admin",
  "settings",
  "dashboard",
  "boards",
  "new",
  "join",
  "invite",
  "invites",
  "billing",
  "support",
  "help",
  "about",
]);
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Invite tokens are bearer credentials: only the sha256 hash is stored.
 * The raw token is returned transiently at create/refresh time (for the
 * copy-link flow) and never persisted or listed.
 */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assertSlugUsable(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw badRequest(
      "INVALID_SLUG",
      "Slug must be 3–48 chars of lowercase letters, numbers and hyphens",
    );
  }
  if (RESERVED_SLUGS.has(slug)) throw badRequest("RESERVED_SLUG", `Slug "${slug}" is reserved`);
}

async function slugTaken(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  return !!row;
}

/** Find a free slug; 409 with a suggestion when the requested one is taken. */
async function ensureFreeSlug(wanted: string): Promise<string> {
  if (!(await slugTaken(wanted))) return wanted;
  const suggestion = await suggestSlug(wanted);
  if (suggestion) {
    throw conflict("SLUG_TAKEN", `Slug "${wanted}" is taken — "${suggestion}" is available`);
  }
  throw conflict("SLUG_TAKEN", `Slug "${wanted}" is taken`);
}

/** First free `${wanted}-${n}` (n ≥ 2), or null when exhausted. */
async function suggestSlug(wanted: string): Promise<string | null> {
  for (let n = 2; n <= 99; n += 1) {
    const candidate = `${wanted}-${n}`;
    if (candidate.length > 48) return null;
    if (!(await slugTaken(candidate))) return candidate;
  }
  return null;
}

export const organizationsService = {
  async listMine(userId: string) {
    return db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
        role: orgMember.role,
      })
      .from(orgMember)
      .innerJoin(organization, eq(orgMember.organizationId, organization.id))
      .where(eq(orgMember.userId, userId))
      .orderBy(asc(organization.createdAt));
  },

  async create(userId: string, input: { name: string; slug: string }) {
    const slug = normalizeSlug(input.slug);
    assertSlugUsable(slug);
    // Best-effort pre-check for a friendly 409. The unique constraint is
    // the real arbiter: concurrent creators racing the same slug are
    // caught below and converted to the same 409 (never a 500).
    const free = await ensureFreeSlug(slug);
    try {
      const [org] = await db.transaction(async (tx) => {
        const [created] = await tx.insert(organization).values({ name: input.name, slug: free }).returning();
        if (!created) throw new Error("Organization insert failed");
        await tx.insert(orgMember).values({ userId, organizationId: created.id, role: "ADMIN" });
        return [created];
      });
      if (!org) throw new Error("Organization insert failed");
      return org;
    } catch (err) {
      if (isUniqueViolation(err)) {
        const suggestion = await suggestSlug(slug);
        throw conflict(
          "SLUG_TAKEN",
          suggestion ? `Slug "${slug}" is taken — "${suggestion}" is available` : `Slug "${slug}" is taken`,
        );
      }
      throw err;
    }
  },

  async getDetail(userId: string, organizationId: string) {
    const membership = await assertOrgMember(userId, organizationId);
    const [org] = await db.select().from(organization).where(eq(organization.id, organizationId)).limit(1);
    if (!org) throw notFound("Organization not found");
    return { ...org, myRole: membership.role };
  },

  async rename(userId: string, organizationId: string, name: string) {
    await assertOrgAdmin(userId, organizationId);
    const [org] = await db
      .update(organization)
      .set({ name, updatedAt: new Date() })
      .where(eq(organization.id, organizationId))
      .returning();
    if (!org) throw notFound("Organization not found");
    return org;
  },

  async remove(userId: string, organizationId: string) {
    await assertOrgAdmin(userId, organizationId);
    // Cascades boards → lists → cards → comments/activities/assignees + members + invites.
    await db.delete(organization).where(eq(organization.id, organizationId));
  },

  async listMembers(userId: string, organizationId: string) {
    await assertOrgMember(userId, organizationId);
    return db
      .select({
        userId: orgMember.userId,
        role: orgMember.role,
        joinedAt: orgMember.createdAt,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(orgMember)
      .innerJoin(user, eq(orgMember.userId, user.id))
      .where(eq(orgMember.organizationId, organizationId))
      .orderBy(asc(user.name));
  },

  async changeRole(adminId: string, organizationId: string, targetUserId: string, role: "ADMIN" | "MEMBER") {
    await assertOrgAdmin(adminId, organizationId);
    const [target] = await db
      .select()
      .from(orgMember)
      .where(and(eq(orgMember.organizationId, organizationId), eq(orgMember.userId, targetUserId)))
      .limit(1);
    if (!target) throw notFound("Member not found");
    if (target.role === "ADMIN" && role === "MEMBER" && (await countAdmins(organizationId)) <= 1) {
      throw conflict("LAST_ADMIN", "Cannot demote the last admin");
    }
    const [updated] = await db
      .update(orgMember)
      .set({ role })
      .where(eq(orgMember.id, target.id))
      .returning();
    return updated;
  },

  /** Admin removes anyone; members may remove (leave as) themselves. */
  async removeMember(actorId: string, organizationId: string, targetUserId: string) {
    const actor = await assertOrgMember(actorId, organizationId);
    if (actorId !== targetUserId && actor.role !== "ADMIN") {
      throw conflict("ADMIN_REQUIRED", "Only admins can remove other members");
    }
    const [target] = await db
      .select()
      .from(orgMember)
      .where(and(eq(orgMember.organizationId, organizationId), eq(orgMember.userId, targetUserId)))
      .limit(1);
    if (!target) throw notFound("Member not found");
    if (target.role === "ADMIN" && (await countAdmins(organizationId)) <= 1) {
      throw conflict("LAST_ADMIN", "Cannot remove the last admin");
    }
    // Assignment rows survive removal (assignee display falls back to the
    // auth profile with a "former member" badge client-side).
    await db.delete(orgMember).where(eq(orgMember.id, target.id));
  },

  async invite(adminId: string, organizationId: string, input: { email: string; role: "ADMIN" | "MEMBER" }) {
    await assertOrgAdmin(adminId, organizationId);
    const email = input.email.trim().toLowerCase();
    const [existingMember] = await db
      .select({ userId: user.id })
      .from(user)
      .innerJoin(orgMember, and(eq(orgMember.userId, user.id), eq(orgMember.organizationId, organizationId)))
      .where(eq(user.email, email))
      .limit(1);
    if (existingMember) throw conflict("ALREADY_MEMBER", "That email already belongs to this organization");
    const token = randomBytes(32).toString("hex");
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const [pending] = await db
      .select()
      .from(orgInvite)
      .where(
        and(
          eq(orgInvite.organizationId, organizationId),
          eq(orgInvite.email, email),
          isNull(orgInvite.acceptedAt),
          gt(orgInvite.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (pending) {
      // Resend semantics: rotate token + extend expiry instead of duplicates.
      const [refreshed] = await db
        .update(orgInvite)
        .set({ token: tokenHash, expiresAt, role: input.role })
        .where(eq(orgInvite.id, pending.id))
        .returning();
      if (!refreshed) throw new Error("Invite refresh failed");
      return { ...refreshed, token };
    }
    const [created] = await db
      .insert(orgInvite)
      .values({ email, role: input.role, token: tokenHash, expiresAt, organizationId, invitedBy: adminId })
      .returning();
    if (!created) throw new Error("Invite insert failed");
    return { ...created, token };
  },

  /** Lists invites WITHOUT token hashes — raw tokens only exist transiently at create/refresh. */
  async listInvites(userId: string, organizationId: string) {
    await assertOrgAdmin(userId, organizationId);
    return db
      .select({
        id: orgInvite.id,
        email: orgInvite.email,
        role: orgInvite.role,
        expiresAt: orgInvite.expiresAt,
        acceptedAt: orgInvite.acceptedAt,
        organizationId: orgInvite.organizationId,
        invitedBy: orgInvite.invitedBy,
        createdAt: orgInvite.createdAt,
      })
      .from(orgInvite)
      .where(eq(orgInvite.organizationId, organizationId))
      .orderBy(asc(orgInvite.createdAt));
  },

  async revokeInvite(userId: string, organizationId: string, inviteId: string) {
    await assertOrgAdmin(userId, organizationId);
    const [invite] = await db
      .select()
      .from(orgInvite)
      .where(and(eq(orgInvite.id, inviteId), eq(orgInvite.organizationId, organizationId)))
      .limit(1);
    if (!invite) throw notFound("Invite not found");
    await db.delete(orgInvite).where(eq(orgInvite.id, invite.id));
  },

  async acceptInvite(userId: string, userEmail: string, token: string) {
    const [invite] = await db
      .select()
      .from(orgInvite)
      .where(eq(orgInvite.token, hashInviteToken(token)))
      .limit(1);
    if (!invite || invite.acceptedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw notFound("Invite is invalid or expired");
    }
    if (invite.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
      throw conflict("WRONG_ACCOUNT", "This invite was sent to a different email address");
    }
    const org = await db.transaction(async (tx) => {
      await tx
        .insert(orgMember)
        .values({ userId, organizationId: invite.organizationId, role: invite.role })
        .onConflictDoNothing({ target: [orgMember.userId, orgMember.organizationId] });
      await tx.update(orgInvite).set({ acceptedAt: new Date() }).where(eq(orgInvite.id, invite.id));
      const [row] = await tx.select().from(organization).where(eq(organization.id, invite.organizationId)).limit(1);
      return row;
    });
    if (!org) throw notFound("Organization not found");
    return org;
  },
};
