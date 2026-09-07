import { useState } from "react";
import { Copy, LayoutTemplate, Pencil, Plus, ThumbsUp, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { dueLabel, dueState, fromLocalInputValue, toLocalInputValue } from "@/lib/due";
import { LABEL_COLORS, labelStyle } from "@/lib/labels";
import { navigate } from "@/lib/router";
import {
  useAddComment,
  useAssign,
  useAttachLabel,
  useBoardDetail,
  useCardDetail,
  useCopyCard,
  useDeleteCard,
  useDeleteComment,
  useDetachLabel,
  useMembers,
  useOrg,
  useToggleVote,
  useUnassign,
  useUpdateCard,
  useUpdateComment,
} from "@/lib/trello-queries";
import { AttachmentsSection } from "./AttachmentsSection";
import { AttachmentImage } from "./AttachmentImage";
import { ChecklistsSection } from "./ChecklistsSection";
import { CustomFieldsSection } from "./CustomFieldsSection";
import { UserAvatar, userLabel } from "./UserAvatar";
import { ConfirmButton } from "@/components/shared/ConfirmButton";

const ACTION_LABELS: Record<string, string> = {
  CREATED_CARD: "created this card",
  MOVED_CARD: "moved this card",
  RENAMED_CARD: "renamed this card",
  DESCRIPTION_UPDATED: "edited the description",
  ASSIGNED: "assigned a member",
  UNASSIGNED: "removed a member",
  LABEL_ADDED: "added a label",
  LABEL_REMOVED: "removed a label",
  DUE_CHANGED: "changed the due date",
  CHECKLIST_ADDED: "added a checklist",
  CHECKLIST_REMOVED: "removed a checklist",
  ITEM_CONVERTED: "converted an item to a card",
  ATTACHMENT_ADDED: "attached a file",
  CARD_COPIED: "copied this card",
  VOTED: "voted for this card",
  UNVOTED: "removed their vote",
  COMMENT_ADDED: "commented",
};

function err(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DueEditor({
  dueAt,
  dueComplete,
  draft,
  onDraft,
  onSave,
  onError,
}: {
  dueAt: string | null;
  dueComplete: boolean;
  draft: string | null;
  onDraft: (v: string | null) => void;
  onSave: (v: { dueAt: string | null; dueComplete?: boolean }) => void;
  onError: (e: unknown) => void;
}) {
  const shown = draft ?? (dueAt ? toLocalInputValue(dueAt) : "");
  const dirty = draft !== null && draft !== (dueAt ? toLocalInputValue(dueAt) : "");
  const state = dueState(dueAt, dueComplete);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="datetime-local"
          value={shown}
          onChange={(e) => onDraft(e.target.value)}
          className="w-auto text-[13px]"
          aria-label="Due date"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px]">
          <Checkbox
            checked={dueComplete}
            disabled={!dueAt && draft === ""}
            onCheckedChange={(checked) => {
              try {
                onSave({ dueComplete: checked === true });
              } catch (e) {
                onError(e);
              }
            }}
          />
          Complete
        </label>
        {dueAt ? (
          <Button variant="ghost" size="sm" onClick={() => onSave({ dueAt: null, dueComplete: false })}>
            Clear
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {dirty ? (
          <>
            <Button
              size="sm"
              onClick={() => {
                if (!draft) {
                  onSave({ dueAt: null });
                  return;
                }
                const parsed = new Date(draft);
                if (Number.isNaN(parsed.getTime())) return;
                onSave({ dueAt: fromLocalInputValue(draft) });
              }}
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDraft(null)}>
              Cancel
            </Button>
          </>
        ) : dueAt ? (
          <span className="text-xs text-muted-foreground">
            {state === "overdue" ? "Overdue · " : state === "soon" ? "Due soon · " : state === "complete" ? "Done · " : ""}
            {dueLabel(dueAt)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No due date set.</span>
        )}
      </div>
    </div>
  );
}

function TemplateUseSection({ boardId, cardId, onError }: { boardId: string; cardId: string; onError: (e: unknown) => void }) {
  const { data: board } = useBoardDetail(boardId, false);
  const copyCard = useCopyCard(boardId);
  const [toListId, setToListId] = useState<string | null>(null);
  const lists = board?.lists ?? [];
  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">use as template</p>
      <div className="flex gap-1.5">
        <Select value={toListId ?? undefined} onValueChange={(v) => setToListId(v)}>
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue placeholder="Choose a list…" />
          </SelectTrigger>
          <SelectContent>
            {lists.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!toListId || copyCard.isPending}
          onClick={() =>
            toListId &&
            copyCard.mutate(
              { cardId, toListId },
              {
                onSuccess: (copy) => {
                  toast.success("Card created from template");
                  navigate(`/b/${boardId}/c/${copy.id}`);
                },
                onError: (e) => onError(e),
              },
            )
          }
        >
          Create card
        </Button>
      </div>
    </section>
  );
}

export function CardModal({ boardId, cardId, onClose }: { boardId: string; cardId: string; onClose: () => void }) {
  const { data: session } = useSession();
  const myId = session?.user ? (session.user as { id?: string }).id : undefined;
  const { data: card, isPending, error } = useCardDetail(cardId);
  const orgId = card?.list.board.organizationId ?? null;
  const { data: org } = useOrg(orgId);
  const { data: members = [] } = useMembers(orgId);
  const { data: boardDetail } = useBoardDetail(boardId, false);

  const updateCard = useUpdateCard(boardId, cardId);
  const deleteCard = useDeleteCard(boardId);
  const copyCard = useCopyCard(boardId);
  const toggleVote = useToggleVote(boardId, cardId);
  const assign = useAssign(boardId, cardId);
  const unassign = useUnassign(boardId, cardId);
  const attachLabel = useAttachLabel(boardId, cardId);
  const detachLabel = useDetachLabel(boardId, cardId);
  const addComment = useAddComment(boardId, cardId);
  const updateComment = useUpdateComment(cardId);
  const deleteComment = useDeleteComment(boardId, cardId);

  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [description, setDescription] = useState("");
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [opError, setOpError] = useState<string | null>(null);
  // null = pristine (mirrors card.dueAt); string = edited datetime-local value.
  const [dueInput, setDueInput] = useState<string | null>(null);

  const isAdmin = org?.myRole === "ADMIN";

  const commitTitle = () => {
    setEditingTitle(false);
    if (!card) return;
    const next = title.trim();
    if (!next || next === card.title) return;
    updateCard.mutate({ title: next }, { onError: (e) => setOpError(err(e)) });
  };

  const commitDescription = () => {
    setEditingDesc(false);
    if (!card) return;
    const next = description.trim();
    if ((next || null) === card.description) return;
    updateCard.mutate({ description: next || null }, { onError: (e) => setOpError(err(e)) });
  };

  const submitComment = () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText("");
    addComment.mutate({ text }, { onError: (e) => { setOpError(err(e)); setCommentText(text); } });
  };

  const unassignedMembers = members.filter((m) => !card?.assignees.some((a) => a.userId === m.userId));
  const availableLabels = (boardDetail?.labels ?? []).filter(
    (l) => !card?.cardLabels.some((cl) => cl.labelId === l.id),
  );

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-xl" aria-describedby={undefined}>
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading card…</p>
        ) : error || !card ? (
          <div className="py-8 text-center">
            <SheetTitle className="mb-2">Card not found</SheetTitle>
            <p className="text-[13px] text-muted-foreground">It may have been deleted or you lost access.</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {card.coverAttachmentId ? (
              <AttachmentImage
                attachmentId={card.coverAttachmentId}
                alt="Card cover"
                className="h-36 w-full shrink-0 rounded-none"
              />
            ) : card.coverColor ? (
              <span className={`block h-2 w-full shrink-0 ${labelStyle(card.coverColor).bar}`} />
            ) : null}
            <SheetHeader className="shrink-0 px-5 pt-5 pr-12">
              <div className="flex items-start gap-2">
                {editingTitle ? (
                  <Input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={commitTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    className="text-base font-semibold"
                  />
                ) : (
                  <>
                    <SheetTitle className="flex-1 text-left text-base break-words">{card.title}</SheetTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label="Rename card"
                      onClick={() => { setTitle(card.title); setEditingTitle(true); }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge variant="secondary">in {card.list.title}</Badge>
                {card.archivedAt ? <Badge variant="outline">archived</Badge> : null}
                {card.isTemplate ? (
                  <Badge variant="outline" className="inline-flex items-center gap-1">
                    <LayoutTemplate className="size-3" />
                    template
                  </Badge>
                ) : null}
                <span className="text-[11px] text-muted-foreground">created {stamp(card.createdAt)}</span>
                <span className="ml-auto flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Story points">
                    pts
                    <Input
                      key={card.id + (card.storyPoints ?? "")}
                      type="number"
                      min={0}
                      max={9999}
                      defaultValue={card.storyPoints ?? ""}
                      placeholder="–"
                      onBlur={(e) => {
                        if (e.target.value === "") {
                          if (card.storyPoints !== null) updateCard.mutate({ storyPoints: null }, { onError: (e) => setOpError(err(e)) });
                          return;
                        }
                        const next = Number(e.target.value);
                        if (Number.isInteger(next) && next >= 0 && next <= 9999 && next !== card.storyPoints) {
                          updateCard.mutate({ storyPoints: next }, { onError: (e) => setOpError(err(e)) });
                        }
                      }}
                      className="h-6 w-14 px-1.5 text-[11px] tabular-nums"
                    />
                  </label>
                  <button
                    onClick={() => toggleVote.mutate(undefined, { onError: (e) => setOpError(err(e)) })}
                    className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${card.votes.some((v) => v.userId === myId) ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    aria-label={card.votes.some((v) => v.userId === myId) ? "Remove vote" : "Vote for this card"}
                  >
                    <ThumbsUp className="size-3.5" />
                    {card.votes.length > 0 ? card.votes.length : ""}
                  </button>
                </span>
              </div>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6">
            <section>
              <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">description</p>
              {editingDesc ? (
                <div className="flex flex-col gap-2">
                  <Textarea autoFocus rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description…" />
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={commitDescription}>Save</Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingDesc(false)}>Cancel</Button>
                  </div>
                </div>
              ) : card.description ? (
                <button onClick={() => { setDescription(card.description ?? ""); setEditingDesc(true); }} className="w-full rounded-md border border-transparent p-2 text-left text-[13px] leading-relaxed whitespace-pre-wrap hover:border-border">
                  {card.description}
                </button>
              ) : (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setDescription(""); setEditingDesc(true); }}>
                  <Plus className="size-4" />
                  Add a description
                </Button>
              )}
            </section>

            <section>
              <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">due date</p>
              {card ? (
                <DueEditor
                  dueAt={card.dueAt}
                  dueComplete={card.dueComplete}
                  draft={dueInput}
                  onDraft={setDueInput}
                  onSave={(next) => {
                    setDueInput(null);
                    updateCard.mutate(next, { onError: (e) => setOpError(err(e)) });
                  }}
                  onError={(e) => setOpError(err(e))}
                />
              ) : null}
            </section>

            <section>
              <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">labels</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {card?.cardLabels.map((cl) => (
                  <span
                    key={cl.id}
                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${labelStyle(cl.label.color).soft}`}
                  >
                    {cl.label.name || cl.label.color}
                    <button
                      onClick={() => detachLabel.mutate({ labelId: cl.labelId }, { onError: (e) => setOpError(err(e)) })}
                      className="rounded p-0.5 opacity-60 hover:opacity-100"
                      aria-label={`Remove label ${cl.label.name || cl.label.color}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {availableLabels.length > 0 ? (
                  <Select onValueChange={(labelId) => attachLabel.mutate({ labelId }, { onError: (e) => setOpError(err(e)) })}>
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue placeholder="Add label…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLabels.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          <span className="flex items-center gap-2">
                            <span className={`size-2.5 rounded-full ${labelStyle(l.color).dot}`} />
                            {l.name || l.color}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </section>

            <section>
              <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">cover</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateCard.mutate({ coverColor: card.coverColor === c ? null : c }, { onError: (e) => setOpError(err(e)) })}
                    aria-label={`Cover color ${c}`}
                    title={c}
                    className={`size-6 rounded-md ${labelStyle(c).bar} ${card.coverColor === c ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100"}`}
                  />
                ))}
                {card.coverColor || card.coverAttachmentId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-muted-foreground"
                    onClick={() => updateCard.mutate({ coverColor: null, coverAttachmentId: null }, { onError: (e) => setOpError(err(e)) })}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              {card.coverAttachmentId ? (
                <p className="mt-1 text-[11px] text-muted-foreground">Cover image set — change it from attachments below.</p>
              ) : null}
            </section>

            <ChecklistsSection boardId={boardId} cardId={card.id} onError={(e) => setOpError(err(e))} />

            <AttachmentsSection boardId={boardId} cardId={card.id} onError={(e) => setOpError(err(e))} />

            <CustomFieldsSection boardId={boardId} cardId={card.id} onError={(e) => setOpError(err(e))} />

            {card.isTemplate ? (
              <TemplateUseSection boardId={boardId} cardId={card.id} onError={(e) => setOpError(err(e))} />
            ) : null}

            <section>
              <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">assignees</p>
              <div className="flex flex-wrap items-center gap-2">
                {card.assignees.map((a) => (
                  <span key={a.userId} className="inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pr-1 pl-0.5">
                    <UserAvatar name={a.user?.name} email={a.user?.email} image={a.user?.image} className="size-5" />
                    <span className="max-w-32 truncate text-xs font-medium">{userLabel(a.user?.name, a.user?.email)}</span>
                    <button
                      onClick={() => unassign.mutate({ userId: a.userId }, { onError: (e) => setOpError(err(e)) })}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={`Unassign ${a.user?.email ?? ""}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                {unassignedMembers.length > 0 ? (
                  <Select onValueChange={(userId) => assign.mutate({ userId }, { onError: (e) => setOpError(err(e)) })}>
                    <SelectTrigger size="sm" className="w-36">
                      <SelectValue placeholder="Assign…" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedMembers.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name} · {m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </section>

            <section>
              <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">comments</p>
              <div className="flex flex-col gap-3">
                {card.comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <UserAvatar name={c.user?.name} email={c.user?.email} image={c.user?.image} className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs">
                        <span className="font-medium">{userLabel(c.user?.name, c.user?.email)}</span>{" "}
                        <span className="text-muted-foreground">{stamp(c.createdAt)}{c.updatedAt !== c.createdAt ? " · edited" : ""}</span>
                      </p>
                      {editingCommentId === c.id ? (
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          <Textarea rows={2} value={editingCommentText} onChange={(e) => setEditingCommentText(e.target.value)} />
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => {
                                const text = editingCommentText.trim();
                                if (!text) return;
                                setEditingCommentId(null);
                                updateComment.mutate({ commentId: c.id, text }, { onError: (e) => setOpError(err(e)) });
                              }}
                            >
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="mt-0.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap">{c.text}</p>
                          <p className="mt-1 flex gap-2">
                            {c.userId && c.userId === myId ? (
                              <button
                                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                                onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.text); }}
                              >
                                Edit
                              </button>
                            ) : null}
                            {c.userId === myId || isAdmin ? (
                              <button
                                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                                onClick={() => deleteComment.mutate({ commentId: c.id }, { onError: (e) => setOpError(err(e)) })}
                              >
                                Delete
                              </button>
                            ) : null}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2.5">
                  <Avatar className="mt-0.5 size-6 shrink-0">
                    <AvatarImage src={undefined} alt="" />
                    <AvatarFallback className="text-[10px] font-medium text-muted-foreground">+</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Textarea rows={2} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment…" />
                    <div>
                      <Button size="sm" onClick={submitComment} disabled={!commentText.trim() || addComment.isPending}>
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">activity</p>
              {card.activities.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No activity yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {card.activities.map((a) => (
                    <li key={a.id} className="flex items-baseline gap-2 text-[13px]">
                      <span className="mt-1.5 size-1.5 shrink-0 self-center rounded-full bg-muted-foreground/50" />
                      <span>
                        <span className="font-medium">{userLabel(a.user?.name, a.user?.email)}</span>{" "}
                        <span className="text-muted-foreground">{ACTION_LABELS[a.action] ?? a.action.toLowerCase()}</span>
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">{stamp(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateCard.mutate({ archived: !card.archivedAt }, { onError: (e) => setOpError(err(e)) })}
              >
                {card.archivedAt ? "Unarchive" : "Archive"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyCard.mutate(
                    { cardId: card.id },
                    {
                      onSuccess: (copy) => {
                        toast.success("Card copied");
                        navigate(`/b/${boardId}/c/${copy.id}`);
                      },
                      onError: (e) => setOpError(err(e)),
                    },
                  )
                }
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateCard.mutate({ isTemplate: !card.isTemplate }, { onError: (e) => setOpError(err(e)) })}
              >
                <LayoutTemplate className="size-3.5" />
                {card.isTemplate ? "Unmark template" : "Make template"}
              </Button>
              <ConfirmButton
                label="Delete…"
                confirmLabel="Confirm delete?"
                onConfirm={() =>
                  deleteCard.mutate(
                    { cardId },
                    { onError: (e) => setOpError(err(e)), onSuccess: () => onClose() },
                  )
                }
              />
              {opError ? <p className="w-full text-xs text-destructive">{opError}</p> : null}
            </div>
          </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
