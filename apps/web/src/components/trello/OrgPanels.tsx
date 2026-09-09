import { useState } from "react";
import { Check, Copy, MailPlus, SlidersHorizontal } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { navigate } from "@/lib/router";
import {
  useChangeRole,
  useDeleteOrg,
  useInvite,
  useInvites,
  useMembers,
  useRemoveMember,
  useRenameOrg,
  useRevokeInvite,
} from "@/lib/trello-queries";
import type { OrgDetail, OrgRole } from "@/lib/trello";
import { UserAvatar } from "./UserAvatar";

function err(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

function inviteStatus(inv: { acceptedAt: string | null; expiresAt: string }): { label: string; variant: "secondary" | "default" | "outline" } {
  if (inv.acceptedAt) return { label: "accepted", variant: "default" };
  if (new Date(inv.expiresAt).getTime() <= Date.now()) return { label: "expired", variant: "outline" };
  return { label: "pending", variant: "secondary" };
}

export function MembersPanel({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const { data: session } = useSession();
  const myId = session?.user ? (session.user as { id?: string }).id : undefined;
  const { data: members = [] } = useMembers(orgId);
  const changeRole = useChangeRole(orgId);
  const removeMember = useRemoveMember(orgId);
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        members · {members.length}
      </p>
      <div className="flex flex-col rounded-lg border border-border">
        {members.map((m, i) => (
          <div key={m.userId}>
            {i > 0 ? <Separator /> : null}
            <div className="flex items-center gap-2.5 p-3">
              <UserAvatar name={m.name} email={m.email} image={m.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {isAdmin && m.userId !== myId ? (
                <Select
                  value={m.role}
                  onValueChange={(role) =>
                    changeRole.mutate({ userId: m.userId, role: role as OrgRole }, { onError: (e) => setError(err(e)) })
                  }
                >
                  <SelectTrigger size="sm" className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">admin</SelectItem>
                    <SelectItem value="MEMBER">member</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={m.role === "ADMIN" ? "default" : "secondary"}>{m.role.toLowerCase()}</Badge>
              )}
              {(isAdmin || m.userId === myId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    removeMember.mutate(
                      { userId: m.userId },
                      {
                        onError: (e) => setError(err(e)),
                        onSuccess: () => { if (m.userId === myId) navigate("/o"); },
                      },
                    )
                  }
                >
                  {m.userId === myId ? "Leave" : "Remove"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}

export function InvitesPanel({ orgId }: { orgId: string }) {
  const invite = useInvite(orgId);
  const revoke = useRevokeInvite(orgId);
  const { data: invites = [] } = useInvites(orgId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const send = () => {
    const value = email.trim();
    if (!value) return;
    setError(null);
    invite.mutate(
      { email: value, role },
      {
        onSuccess: () => {
          setEmail("");
          toast.success("Invite sent");
        },
        onError: (e) => setError(err(e)),
      },
    );
  };

  // Listed invites carry no token (only hashes are stored) — copying
  // re-sends, which rotates to a fresh link. Side effect is intentional:
  // previously shared links stop working when a new one is issued.
  const copyLink = (inviteId: string, inviteEmail: string, inviteRole: OrgRole) => {
    setError(null);
    invite.mutate(
      { email: inviteEmail, role: inviteRole },
      {
        onSuccess: async (fresh) => {
          await navigator.clipboard.writeText(`${window.location.origin}/invite/${fresh.token}`).catch(() => {});
          setCopied(inviteId);
          setTimeout(() => setCopied((c) => (c === inviteId ? null : c)), 2000);
          toast.success("Invite link copied");
        },
        onError: (e) => setError(err(e)),
      },
    );
  };

  return (
    <section>
      <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">invites</p>
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-email" className="sr-only">Email</Label>
          <Input id="invite-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        </div>
        <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MEMBER">member</SelectItem>
            <SelectItem value="ADMIN">admin</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9" onClick={send} disabled={!email.trim() || invite.isPending}>
          <MailPlus className="size-4" />
          Invite
        </Button>
      </div>
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
      {invites.length > 0 ? (
        <div className="mt-2 flex flex-col rounded-lg border border-border">
          {invites.map((inv, i) => {
            const status = inviteStatus(inv);
            return (
              <div key={inv.id}>
                {i > 0 ? <Separator /> : null}
                <div className="flex items-center gap-2.5 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{inv.email}</p>
                    <p className="text-[11px] text-muted-foreground">expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {!inv.acceptedAt ? (
                    <>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Copy fresh invite link" title="Rotates a fresh link" onClick={() => copyLink(inv.id, inv.email, inv.role)}>
                        {copied === inv.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => revoke.mutate({ inviteId: inv.id }, { onError: (e) => setError(err(e)) })}
                      >
                        Revoke
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function DangerZone({ org }: { org: OrgDetail }) {
  const renameOrg = useRenameOrg(org.id);
  const deleteOrg = useDeleteOrg(org.id);
  const [name, setName] = useState(org.name);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-destructive uppercase">danger zone</p>
      <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="org-rename">Workspace name</Label>
            <Input id="org-rename" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            disabled={!name.trim() || name.trim() === org.name || renameOrg.isPending}
            onClick={() => renameOrg.mutate({ name: name.trim() }, { onError: (e) => setError(err(e)) })}
          >
            Rename
          </Button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">Delete this workspace, its boards and all cards.</p>
          <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); setConfirmName(""); setError(null); }}>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              Delete…
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete “{org.name}”?</DialogTitle>
                <DialogDescription>
                  This permanently deletes every board, list, card and comment. Type the workspace name to confirm.
                </DialogDescription>
              </DialogHeader>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={org.name} />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <DialogFooter>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={confirmName !== org.name || deleteOrg.isPending}
                  onClick={() =>
                    deleteOrg.mutate(undefined, {
                      onSuccess: () => navigate("/o"),
                      onError: (e) => setError(err(e)),
                    })
                  }
                >
                  Delete workspace
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {error && !confirmOpen ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}

/** Secondary workspace administration, kept out of the board-selection flow. */
export function WorkspaceSettingsDialog({ org, isAdmin }: { org: OrgDetail; isAdmin: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" />
          {isAdmin ? "Manage Workspace" : "Members"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isAdmin ? "Manage Workspace" : "Workspace Members"}</DialogTitle>
          <DialogDescription>
            {isAdmin ? "Members, invitations, and workspace settings." : "See who has access to this workspace."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-7 py-1">
          <MembersPanel orgId={org.id} isAdmin={isAdmin} />
          {isAdmin ? <InvitesPanel orgId={org.id} /> : null}
          {isAdmin ? <DangerZone org={org} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
