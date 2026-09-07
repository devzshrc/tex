import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronLeft, Pencil, Search, SquareKanban, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { EMPTY_FILTERS, filterBoard, isFiltering, type CardFilters } from "@/lib/card-filter";
import { labelStyle } from "@/lib/labels";
import { useBoardRealtime } from "@/lib/realtime";
import { navigate, useSearchParam } from "@/lib/router";
import { pushRecentBoard, useConnectionStore, useFavoritesStore } from "@/lib/store";
import { useBoardDetail, useDeleteBoard, useMembers, useUpdateBoard } from "@/lib/trello-queries";
import { BoardView } from "../components/trello/BoardView";
import { CalendarView } from "../components/trello/CalendarView";
import { CardModal } from "../components/trello/CardModal";
import { ManageCustomFields } from "../components/trello/ManageCustomFields";
import { ManageLabels } from "../components/trello/ManageLabels";
import { ConfirmButton } from "../components/shared/ConfirmButton";
import { NotFoundCard } from "../components/shared/primitives";
import { AppShell } from "../components/trello/AppShell";
import { UserCluster } from "../components/trello/TopBar";
import { cn } from "@/lib/utils";

function LiveDot({ boardId }: { boardId: string }) {
  const status = useConnectionStore((s) => s.statusByBoard[boardId] ?? "connecting");
  return (
    <span
      title={status === "live" ? "Live — board updates in realtime" : status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
    >
      <span className={cn("size-1.5 rounded-full", status === "live" ? "bg-green-500" : status === "reconnecting" ? "bg-amber-500" : "bg-muted-foreground/50")} />
      {status === "live" ? "live" : status === "reconnecting" ? "retrying" : ""}
    </span>
  );
}

/** Board view with drag-and-drop + card sheet. Routes `/b/:boardId` and `/b/:boardId/c/:cardId`. */
export function Board({ boardId, cardId: routeCardId }: { boardId: string; cardId?: string | null }) {
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState<"board" | "calendar">("board");
  const [filters, setFilters] = useState<CardFilters>(EMPTY_FILTERS);
  const { data: board, isPending, error } = useBoardDetail(boardId, showArchived);
  const { data: members = [] } = useMembers(board?.organizationId ?? null);
  const queryCardId = useSearchParam("card");
  const cardId = routeCardId ?? queryCardId;
  const updateBoard = useUpdateBoard(board?.organizationId ?? "");
  const deleteBoard = useDeleteBoard(board?.organizationId ?? "");
  const isFavorite = useFavoritesStore((s) => s.isFavorite(boardId));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  useBoardRealtime(boardId);

  useEffect(() => {
    if (board) pushRecentBoard({ id: board.id, title: board.title, orgId: board.organizationId });
  }, [board]);

  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const [opError, setOpError] = useState<string | null>(null);

  const commitRename = () => {
    setRenaming(false);
    if (!board) return;
    const next = title.trim();
    if (!next || next === board.title) return;
    updateBoard.mutate({ boardId, title: next, expectedVersion: board.version }, { onError: (e) => setOpError(e instanceof ApiError ? e.message : "Something went wrong") });
  };

  const visibleBoard = useMemo(() => (board ? filterBoard(board, filters) : board), [board, filters]);
  const filtering = isFiltering(filters);

  return (
    <AppShell>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label="Back to boards"
          onClick={() => navigate(board ? `/o/${board.organizationId}` : "/o")}
        >
          <ChevronLeft className="size-4" />
        </Button>
        {board ? (
          renaming ? (
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              className="h-8 max-w-64 text-sm font-semibold"
            />
          ) : (
            <button onClick={() => { setTitle(board.title); setRenaming(true); }} className="group flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-semibold tracking-tight">{board.title}</span>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          )
        ) : (
          <Skeleton className="h-5 w-32" />
        )}
        {board?.archivedAt ? <Badge variant="outline">archived</Badge> : null}
        {board ? (
          <>
            <button
              onClick={() => toggleFavorite({ id: board.id, title: board.title, orgId: board.organizationId })}
              aria-label={isFavorite ? "Unpin board" : "Pin board to favorites"}
              title={isFavorite ? "Unpin board" : "Pin board to favorites"}
              className={isFavorite ? "text-primary" : "text-muted-foreground hover:text-foreground"}
            >
              <Star className={cn("size-4", isFavorite && "fill-current")} />
            </button>
            <LiveDot boardId={boardId} />
          </>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {board ? (
            <>
              <span className="hidden items-center gap-1 md:flex" role="group" aria-label="View">
                <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" onClick={() => setView("board")} aria-label="Board view">
                  <SquareKanban className="size-4" />
                </Button>
                <Button variant={view === "calendar" ? "secondary" : "ghost"} size="sm" onClick={() => setView("calendar")} aria-label="Calendar view">
                  <Calendar className="size-4" />
                </Button>
              </span>
              <ManageLabels boardId={boardId} labels={board.labels} />
              <ManageCustomFields boardId={boardId} />
              <Button variant="ghost" size="sm" className="hidden text-muted-foreground sm:inline-flex" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Hide archived" : "Show archived"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-muted-foreground sm:inline-flex"
                onClick={() =>
                  updateBoard.mutate({ boardId, archived: !board.archivedAt, expectedVersion: board.version }, { onError: (e) => setOpError(e instanceof ApiError ? e.message : "Something went wrong") })
                }
              >
                {board.archivedAt ? "Unarchive" : "Archive"}
              </Button>
              <ConfirmButton
                label="Delete"
                confirmLabel="Confirm?"
                className="hidden sm:inline-flex"
                onConfirm={() =>
                  deleteBoard.mutate(
                    { boardId },
                    {
                      onSuccess: () => navigate(`/o/${board.organizationId}`),
                      onError: (e) => setOpError(e instanceof ApiError ? e.message : "Something went wrong"),
                    },
                  )
                }
              />
            </>
          ) : null}
          <UserCluster />
        </div>
      </header>
      {opError ? <p className="border-b border-border px-4 py-1.5 text-xs text-destructive md:px-6">{opError}</p> : null}

      {board && view === "board" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 md:px-6">
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Filter cards…"
              className="h-8 w-44 pl-8 text-[13px]"
              aria-label="Filter cards by text"
            />
          </span>
          <Select
            value={filters.labelId ?? "__all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, labelId: v === "__all" ? null : v }))}
          >
            <SelectTrigger size="sm" className="w-36" aria-label="Filter by label">
              <SelectValue placeholder="Label" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All labels</SelectItem>
              {board.labels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  <span className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${labelStyle(l.color).dot}`} />
                    {l.name || l.color}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.assigneeId ?? "__all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, assigneeId: v === "__all" ? null : v }))}
          >
            <SelectTrigger size="sm" className="w-36" aria-label="Filter by assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Anyone</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={filters.overdueOnly ? "secondary" : "ghost"}
            size="sm"
            className="h-8"
            onClick={() => setFilters((f) => ({ ...f, overdueOnly: !f.overdueOnly }))}
          >
            Overdue
          </Button>
          {filtering ? (
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
              <X className="size-3.5" />
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}

      <main className="flex-1 p-4 md:p-6">
        {isPending ? (
          <div className="flex items-start gap-3">
            <Skeleton className="h-40 w-72 shrink-0" />
            <Skeleton className="h-40 w-72 shrink-0" />
            <Skeleton className="h-40 w-72 shrink-0" />
          </div>
        ) : error || !board ? (
          <NotFoundCard
            title="Board not found"
            hint="It may have been deleted or you lost access."
            actionLabel="Back to workspaces"
            onAction={() => navigate("/o")}
          />
        ) : view === "calendar" ? (
          <CalendarView board={board} onOpenCard={(id) => navigate(`/b/${boardId}/c/${id}`)} />
        ) : visibleBoard ? (
          <BoardView board={visibleBoard} boardId={boardId} includeArchived={showArchived} onOpenCard={(id) => navigate(`/b/${boardId}/c/${id}`)} />
        ) : null}
      </main>

      {cardId ? <CardModal boardId={boardId} cardId={cardId} onClose={() => navigate(`/b/${boardId}`)} /> : null}
    </AppShell>
  );
}
