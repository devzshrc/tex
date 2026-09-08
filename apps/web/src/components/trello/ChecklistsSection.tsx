import { useState } from "react";
import { ArrowRightToLine, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  useAddChecklistItem,
  useCardDetail,
  useConvertChecklistItem,
  useCreateChecklist,
  useDeleteChecklist,
  useDeleteChecklistItem,
  useMembers,
  useUpdateChecklist,
  useUpdateChecklistItem,
} from "@/lib/trello-queries";
import type { Checklist } from "@/lib/trello";
import { UserAvatar } from "./UserAvatar";

function err(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <span className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground tabular-nums">{done}/{total}</span>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <span className={`block h-full rounded-full ${pct === 100 ? "bg-green-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}

function ChecklistBlock({
  boardId,
  cardId,
  orgId,
  checklist,
  onError,
}: {
  boardId: string;
  cardId: string;
  orgId: string | null;
  checklist: Checklist & { items: (Checklist["items"][number] & { assignee: { id: string; name: string; email: string; image: string | null } | null })[] };
  onError: (e: unknown) => void;
}) {
  const { data: members = [] } = useMembers(orgId);
  const updateChecklist = useUpdateChecklist(boardId, cardId);
  const deleteChecklist = useDeleteChecklist(boardId, cardId);
  const addItem = useAddChecklistItem(boardId, cardId);
  const updateItem = useUpdateChecklistItem(boardId, cardId);
  const deleteItem = useDeleteChecklistItem(boardId, cardId);
  const convertItem = useConvertChecklistItem(boardId, cardId);

  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(checklist.title);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const done = checklist.items.filter((i) => i.complete).length;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        {renaming ? (
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setRenaming(false);
              const next = title.trim();
              if (next && next !== checklist.title) updateChecklist.mutate({ checklistId: checklist.id, title: next }, { onError });
            }}
            onKeyDown={(e) => { if (e.key === "Escape") setRenaming(false); }}
            className="h-7 text-[13px] font-semibold"
          />
        ) : (
          <button onClick={() => { setTitle(checklist.title); setRenaming(true); }} className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">
            {checklist.title}
          </button>
        )}
        <Progress done={done} total={checklist.items.length} />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-muted-foreground hover:text-destructive"
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            deleteChecklist.mutate({ checklistId: checklist.id }, { onError });
          }}
        >
          {confirmDelete ? "Confirm?" : "Delete"}
        </Button>
      </div>

      <ul className="mt-2 flex flex-col">
        {checklist.items.map((item) => (
          <li key={item.id} className="group flex items-start gap-2 rounded-md px-1 py-1.5 hover:bg-muted/50">
            <Checkbox
              className="mt-0.5"
              checked={item.complete}
              onCheckedChange={(checked) => updateItem.mutate({ itemId: item.id, complete: checked === true }, { onError })}
              aria-label={`Mark "${item.text}" ${item.complete ? "incomplete" : "complete"}`}
            />
            <div className="min-w-0 flex-1">
              {editingItemId === item.id ? (
                <Input
                  autoFocus
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onBlur={() => {
                    setEditingItemId(null);
                    const next = editingText.trim();
                    if (next && next !== item.text) updateItem.mutate({ itemId: item.id, text: next }, { onError });
                  }}
                  onKeyDown={(e) => { if (e.key === "Escape") setEditingItemId(null); }}
                  className="h-7 text-[13px]"
                />
              ) : (
                <button
                  onClick={() => { setEditingItemId(item.id); setEditingText(item.text); }}
                  className={`w-full text-left text-[13px] break-words ${item.complete ? "text-muted-foreground line-through" : ""}`}
                >
                  {item.text}
                </button>
              )}
              <span className="mt-1 flex items-center gap-1.5">
                <Select
                  value={item.assigneeUserId ?? "__none"}
                  onValueChange={(v) => updateItem.mutate({ itemId: item.id, assigneeUserId: v === "__none" ? null : v }, { onError })}
                >
                  <SelectTrigger size="sm" className="h-6 w-auto gap-1 border-transparent px-1 text-[11px] text-muted-foreground shadow-none">
                    {item.assignee ? (
                      <span className="flex items-center gap-1">
                        <UserAvatar name={item.assignee.name} email={item.assignee.email} image={item.assignee.image} className="size-4" />
                        {item.assignee.name}
                      </span>
                    ) : (
                      <SelectValue placeholder="Assign" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  className="hidden text-[11px] text-muted-foreground underline-offset-2 hover:underline group-hover:block"
                  onClick={() => convertItem.mutate({ itemId: item.id }, { onError })}
                  title="Convert to card in the same list"
                >
                  <span className="inline-flex items-center gap-0.5">
                    <ArrowRightToLine className="size-3" />
                    card
                  </span>
                </button>
                <button
                  className="hidden text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline group-hover:block"
                  onClick={() => deleteItem.mutate({ itemId: item.id }, { onError })}
                >
                  <X className="size-3" />
                </button>
              </span>
            </div>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-1.5 flex gap-1.5">
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) {
                const next = text.trim();
                setText("");
                addItem.mutate({ checklistId: checklist.id, text: next }, { onError });
              }
              if (e.key === "Escape") { setAdding(false); setText(""); }
            }}
            placeholder="Item text"
            className="h-8 text-[13px]"
          />
          <Button
            size="sm"
            disabled={!text.trim()}
            onClick={() => {
              const next = text.trim();
              setText("");
              addItem.mutate({ checklistId: checklist.id, text: next }, { onError });
            }}
          >
            Add
          </Button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="mt-1 text-muted-foreground" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          Add item
        </Button>
      )}
    </div>
  );
}

export function ChecklistsSection({ boardId, cardId, onError }: { boardId: string; cardId: string; onError: (e: unknown) => void }) {
  const { data: card } = useCardDetail(cardId);
  const createChecklist = useCreateChecklist(boardId, cardId);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const orgId = card?.list.board.organizationId ?? null;

  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">checklists</p>
      <div className="flex flex-col gap-2.5">
        {card?.checklists.map((cl) => (
          <ChecklistBlock key={cl.id} boardId={boardId} cardId={cardId} orgId={orgId} checklist={cl} onError={onError} />
        ))}
        {adding ? (
          <div className="flex gap-1.5">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) {
                  const next = title.trim();
                  setTitle("");
                  setAdding(false);
                  createChecklist.mutate({ title: next }, { onError });
                }
                if (e.key === "Escape") { setAdding(false); setTitle(""); }
              }}
              placeholder="Checklist title"
              className="h-8 text-[13px]"
            />
            <Button
              size="sm"
              disabled={!title.trim()}
              onClick={() => {
                const next = title.trim();
                setTitle("");
                setAdding(false);
                createChecklist.mutate({ title: next }, { onError });
              }}
            >
              Add
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            Add checklist
          </Button>
        )}
      </div>
    </section>
  );
}
