import { useState } from "react";
import { ChevronLeft, Plus, X } from "@/components/ui/icons";
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
import { WorkspaceSettingsDialog } from "../components/trello/OrgPanels";
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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 md:p-8">
        <div className="flex min-w-0 items-center gap-3 border-b border-border pb-5">
          <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label="Back to workspaces" onClick={() => navigate("/o")}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-3xl font-semibold tracking-[-0.045em]">{org.name}</span>
          <Badge variant={isAdmin ? "default" : "secondary"}>{org.myRole.toLowerCase()}</Badge>
          <WorkspaceSettingsDialog org={org} isAdmin={!!isAdmin} />
        </div>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="section-kicker">boards</p>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {boards.map((board) => (
                <div key={board.id} className="group relative">
                  <button onClick={() => navigate(`/b/${board.id}`)} className="w-full text-left">
                    <Card className="gap-0 border-border bg-card/80 py-0 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card">
                      <CardContent className="p-5">
                        <span className="mb-8 block h-px w-10 bg-primary/80" />
                        <p className="truncate text-lg font-semibold tracking-[-0.03em]">{board.title}</p>
                        <p className="mt-2 flex items-center gap-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
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
                            { boardId: board.id, archived: false, expectedVersion: board.version },
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

      </main>
    </AppShell>
  );
}
