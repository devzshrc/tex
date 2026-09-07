import { useState } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { navigate } from "@/lib/router";
import { useCreateBoard, useDeleteBoard, useOrg, useOrgBoards, useUpdateBoard } from "@/lib/trello-queries";
import { DangerZone, InvitesPanel, MembersPanel } from "../components/trello/OrgPanels";
import { ConfirmButton } from "../components/shared/ConfirmButton";
import { EmptyState, NotFoundCard } from "../components/shared/primitives";
import { AppShell } from "../components/trello/AppShell";

/** Organization home: boards grid + members + invites. Route `/o/:orgId`. */
export function OrgBoards({ orgId }: { orgId: string }) {
  const { data: org, isPending, error } = useOrg(orgId);
  const [showArchived, setShowArchived] = useState(false);
  const { data: boards = [] } = useOrgBoards(orgId, showArchived);
  const createBoard = useCreateBoard(orgId);
  const updateBoard = useUpdateBoard(orgId);
  const deleteBoard = useDeleteBoard(orgId);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const isAdmin = org?.myRole === "ADMIN";

  if (isPending) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-4xl p-6">
          <Skeleton className="h-8 w-48" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </main>
      </AppShell>
    );
  }

  if (error || !org) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-4xl p-6">
          <NotFoundCard
            title="Workspace not found"
            hint="It may have been deleted or you were removed."
            actionLabel="Back to workspaces"
            onAction={() => navigate("/o")}
          />
        </main>
      </AppShell>
    );
  }

  const submitBoard = () => {
    const value = title.trim();
    if (!value) return;
    setCreateError(null);
    createBoard.mutate(
      { title: value },
      {
        onSuccess: (board) => { setCreateOpen(false); setTitle(""); navigate(`/b/${board.id}`); },
        onError: (e) => setCreateError(e instanceof ApiError ? e.message : "Something went wrong"),
      },
    );
  };

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-4 md:p-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Back to workspaces" onClick={() => navigate("/o")}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="truncate text-sm font-semibold tracking-tight">{org.name}</span>
          <Badge variant={isAdmin ? "default" : "secondary"}>{org.myRole.toLowerCase()}</Badge>
        </div>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">boards</p>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Hide archived" : "Show archived"}
              </Button>
              <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); setCreateError(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="size-4" />
                    New board
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create board</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="board-title">Title</Label>
                    <Input
                      id="board-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submitBoard(); }}
                      placeholder="Product roadmap"
                    />
                  </div>
                  {createError ? <p className="text-xs text-destructive">{createError}</p> : null}
                  <DialogFooter>
                    <Button size="sm" onClick={submitBoard} disabled={!title.trim() || createBoard.isPending}>
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {boards.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((board) => (
                <div key={board.id} className="group relative">
                  <button onClick={() => navigate(`/b/${board.id}`)} className="w-full text-left">
                    <Card className="shadow-none transition-colors hover:border-ring">
                      <CardContent className="p-4">
                        <p className="truncate text-sm font-medium">{board.title}</p>
                        <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          updated {new Date(board.updatedAt).toLocaleDateString()}
                          {board.archivedAt ? <Badge variant="outline">archived</Badge> : null}
                        </p>
                      </CardContent>
                    </Card>
                  </button>
                  {board.archivedAt ? (
                    <span className="absolute top-2 right-2 hidden gap-1 group-hover:flex">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7"
                        onClick={() =>
                          updateBoard.mutate(
                            { boardId: board.id, archived: false },
                            { onError: (e) => setOpError(e instanceof ApiError ? e.message : "Something went wrong") },
                          )
                        }
                      >
                        Restore
                      </Button>
                      <ConfirmButton
                        size="icon"
                        icon={<X className="size-4" />}
                        label="Delete board"
                        confirmLabel="Confirm delete?"
                        onConfirm={() =>
                          deleteBoard.mutate({ boardId: board.id }, { onError: (e) => setOpError(e instanceof ApiError ? e.message : "Something went wrong") })
                        }
                      />
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={showArchived ? "Nothing archived" : "No boards yet"}
              hint={showArchived ? "Archived boards will appear here." : "Create your first board to get going."}
            />
          )}
          {opError ? <p className="mt-1.5 text-xs text-destructive">{opError}</p> : null}
        </section>

        <MembersPanel orgId={orgId} isAdmin={!!isAdmin} />
        {isAdmin ? (
          <>
            <InvitesPanel orgId={orgId} />
            <DangerZone org={org} />
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
