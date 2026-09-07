import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ApiError } from "@/lib/api";
import { useCreateCard, useDeleteList, useUpdateList } from "@/lib/trello-queries";
import type { BoardList } from "@/lib/trello";
import { cn } from "@/lib/utils";
import { SortableCardRow } from "./CardRow";

function err(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

export function ListColumn({
  list,
  boardId,
  onOpenCard,
}: {
  list: BoardList;
  boardId: string;
  onOpenCard: (cardId: string) => void;
}) {
  const sortable = useSortable({ id: list.id, data: { type: "list" } });
  const updateList = useUpdateList(boardId);
  const deleteList = useDeleteList(boardId);
  const createCard = useCreateCard(boardId);

  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [adding, setAdding] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commitRename = () => {
    setRenaming(false);
    const next = title.trim();
    if (!next || next === list.title) {
      setTitle(list.title);
      return;
    }
    updateList.mutate(
      { listId: list.id, title: next },
      { onError: (e) => { setError(err(e)); setTitle(list.title); } },
    );
  };

  const toggleArchive = () => {
    setError(null);
    updateList.mutate(
      { listId: list.id, archived: !list.archivedAt },
      { onError: (e) => setError(err(e)) },
    );
  };

  const remove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    deleteList.mutate({ listId: list.id }, { onError: (e) => setError(err(e)) });
  };

  const addCard = () => {
    const next = cardTitle.trim();
    if (!next) return;
    setCardTitle("");
    createCard.mutate(
      { listId: list.id, title: next },
      { onError: (e) => { setError(err(e)); setCardTitle(next); } },
    );
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={cn("flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/40", sortable.isDragging && "opacity-40")}
    >
      <div
        {...sortable.attributes}
        {...sortable.listeners}
        className="flex cursor-grab items-center gap-1.5 px-3 pt-2.5 pb-1.5 active:cursor-grabbing"
      >
        {renaming ? (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setTitle(list.title); setRenaming(false); }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 bg-background text-[13px] font-semibold"
          />
        ) : (
          <button onClick={() => { setTitle(list.title); setRenaming(true); }} className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">
            {list.title}
          </button>
        )}
        <Badge variant="secondary" className="tabular-nums">{list.cards.length}</Badge>
        {list.archivedAt ? <Badge variant="outline">archived</Badge> : null}
        <DropdownMenu onOpenChange={(open) => { if (!open) setConfirmDelete(false); }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label="List actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>list</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => { setTitle(list.title); setRenaming(true); }}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={toggleArchive}>{list.archivedAt ? "Unarchive" : "Archive"}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); remove(); }}>
              {confirmDelete ? "Confirm delete?" : "Delete…"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-3 flex-col gap-2 px-2.5 py-1.5">
          {list.cards.map((card) => (
            <SortableCardRow key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
          ))}
        </div>
      </SortableContext>

      <div className="px-2.5 pt-1 pb-2.5">
        {adding ? (
          <div className="flex flex-col gap-2">
            <Textarea
              autoFocus
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCard(); }
                if (e.key === "Escape") { setAdding(false); setCardTitle(""); }
              }}
              placeholder="Card title"
              rows={2}
              className="bg-background text-[13px]"
            />
            <div className="flex items-center gap-1.5">
              <Button size="sm" onClick={addCard} disabled={!cardTitle.trim() || createCard.isPending}>
                Add card
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => { setAdding(false); setCardTitle(""); }} aria-label="Cancel">
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add a card
          </Button>
        )}
        {error ? <p className="px-1 pt-1.5 text-xs text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
