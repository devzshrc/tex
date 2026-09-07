import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { keyBetween } from "@/lib/order";
import { keys, useCreateList } from "@/lib/trello-queries";
import type { BoardDetail, BoardList } from "@/lib/trello";
import { CardRow } from "./CardRow";
import { ListColumn } from "./ListColumn";

type Active = { kind: "card" | "list"; id: string } | null;

function findCardList(board: BoardDetail, cardId: string): BoardList | undefined {
  return board.lists.find((l) => l.cards.some((c) => c.id === cardId));
}

export function BoardView({
  board,
  boardId,
  includeArchived,
  onOpenCard,
}: {
  board: BoardDetail;
  boardId: string;
  includeArchived: boolean;
  onOpenCard: (cardId: string) => void;
}) {
  const qc = useQueryClient();
  const boardKey = keys.board(boardId, includeArchived);
  const [active, setActive] = useState<Active>(null);
  const origin = useRef<{ listId: string | null; index: number }>({ listId: null, index: -1 });
  const [addingList, setAddingList] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const createList = useCreateList(boardId);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const getBoard = () => qc.getQueryData<BoardDetail>(boardKey);
  const setBoard = (fn: (b: BoardDetail) => BoardDetail) => {
    qc.setQueryData<BoardDetail>(boardKey, (old) => (old ? fn(old) : old));
  };

  const persist = useMutation({
    mutationFn: (v: { path: string; body: unknown }) => api.post<{ list?: unknown; card?: unknown }>(v.path, v.body),
    onError: () => qc.invalidateQueries({ queryKey: boardKey }),
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey }),
  });

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const b = getBoard();
    if (!b) return;
    if (b.lists.some((l) => l.id === id)) {
      origin.current = { listId: null, index: b.lists.findIndex((l) => l.id === id) };
      setActive({ kind: "list", id });
    } else {
      const host = findCardList(b, id);
      if (!host) return;
      origin.current = { listId: host.id, index: host.cards.findIndex((c) => c.id === id) };
      setActive({ kind: "card", id });
    }
  };

  const onDragOver = (e: DragOverEvent) => {
    if (!active) return;
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || overId === active.id) return;
    setBoard((b) => {
      if (active.kind === "list") {
        const ids = b.lists.map((l) => l.id);
        let targetId = overId;
        if (!ids.includes(targetId)) {
          const host = b.lists.find((l) => l.cards.some((c) => c.id === targetId));
          if (!host) return b;
          targetId = host.id;
        }
        const from = b.lists.findIndex((l) => l.id === active.id);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0 || from === to) return b;
        return { ...b, lists: arrayMove(b.lists, from, to) };
      }
      // Card: splice into the hovered list at the hovered position.
      const lists = b.lists.map((l) => ({ ...l, cards: [...l.cards] }));
      const from = lists.find((l) => l.cards.some((c) => c.id === active.id));
      if (!from) return b;
      let to = lists.find((l) => l.id === overId);
      let index: number;
      if (to) {
        index = to.cards.length;
      } else {
        to = lists.find((l) => l.cards.some((c) => c.id === overId));
        if (!to) return b;
        index = to.cards.findIndex((c) => c.id === overId);
      }
      const fromIdx = from.cards.findIndex((c) => c.id === active.id);
      let insertAt = index;
      if (from === to && fromIdx < index) insertAt = index - 1;
      if (from === to && fromIdx === insertAt) return b;
      const [moved] = from.cards.splice(fromIdx, 1);
      if (!moved) return b;
      to.cards.splice(insertAt, 0, moved);
      return { ...b, lists };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const current = active;
    setActive(null);
    if (!current) return;
    const b = getBoard();
    if (!b) return;

    if (current.kind === "list") {
      const ids = b.lists.map((l) => l.id);
      const from = origin.current.index;
      const to = ids.indexOf(current.id);
      if (from < 0 || to < 0 || from === to) return;
      const prev = b.lists[to - 1]?.order ?? null;
      const next = b.lists[to + 1]?.order ?? null;
      const order = keyBetween(prev, next);
      setBoard((old) => ({
        ...old,
        lists: old.lists.map((l) => (l.id === current.id ? { ...l, order } : l)),
      }));
      persist.mutate({ path: `/lists/${current.id}/position`, body: { beforeOrder: prev, afterOrder: next } });
      return;
    }

    const host = findCardList(b, current.id);
    if (!host) return;
    const index = host.cards.findIndex((c) => c.id === current.id);
    if (origin.current.listId === host.id && origin.current.index === index) return;
    const before = host.cards[index - 1]?.order ?? null;
    const after = host.cards[index + 1]?.order ?? null;
    const order = keyBetween(before, after);
    setBoard((old) => ({
      ...old,
      lists: old.lists.map((l) =>
        l.id === host.id
          ? { ...l, cards: l.cards.map((c) => (c.id === current.id ? { ...c, order } : c)) }
          : l,
      ),
    }));
    persist.mutate({ path: `/cards/${current.id}/move`, body: { toListId: host.id, beforeOrder: before, afterOrder: after } });
  };

  const overlayCard = active?.kind === "card" ? (getBoard() ? findCardList(getBoard() as BoardDetail, active.id)?.cards.find((c) => c.id === active.id) ?? null : null) : null;
  const overlayList = active?.kind === "list" ? (getBoard()?.lists.find((l) => l.id === active.id) ?? null) : null;

  const addList = () => {
    const title = listTitle.trim();
    if (!title) return;
    setListTitle("");
    createList.mutate({ title });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <SortableContext items={board.lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          {board.lists.map((list) => (
            <ListColumn key={list.id} list={list} boardId={boardId} onOpenCard={onOpenCard} />
          ))}
          <div className="w-72 shrink-0">
            {addingList ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
                <Input
                  autoFocus
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addList();
                    if (e.key === "Escape") { setAddingList(false); setListTitle(""); }
                  }}
                  placeholder="List title"
                  className="bg-background text-[13px] font-medium"
                />
                <div className="flex items-center gap-1.5">
                  <Button size="sm" onClick={addList} disabled={!listTitle.trim() || createList.isPending}>
                    Add list
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => { setAddingList(false); setListTitle(""); }} aria-label="Cancel">
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => setAddingList(true)}>
                <Plus className="size-4" />
                Add a list
              </Button>
            )}
          </div>
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {overlayCard ? <CardRow card={overlayCard} onOpen={() => {}} overlay /> : null}
        {overlayList ? (
          <div className="w-72 shrink-0 rotate-2 rounded-lg border border-border bg-muted/40 p-3 shadow-lg">
            <p className="text-[13px] font-semibold">{overlayList.title}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{overlayList.cards.length} cards</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
