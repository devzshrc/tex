import { AlignLeft, Check, Clock, ListChecks, ThumbsUp } from "@/components/ui/icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth-client";
import { dueLabel, dueState } from "@/lib/due";
import { labelStyle } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { BoardCard } from "@/lib/trello";
import { AttachmentImage } from "./AttachmentImage";
import { UserAvatar } from "./UserAvatar";

const DUE_TEXT: Record<string, string> = {
  overdue: "text-red-700 dark:text-red-300",
  soon: "text-amber-700 dark:text-amber-300",
  upcoming: "text-muted-foreground",
  complete: "text-green-700 dark:text-green-300",
};

export function CardRow({ card, onOpen, overlay }: { card: BoardCard; onOpen: () => void; overlay?: boolean }) {
  const { data: session } = useSession();
  const myId = session?.user ? (session.user as { id?: string }).id : undefined;
  const due = dueState(card.dueAt, card.dueComplete);
  const totalItems = card.checklists.reduce((n, cl) => n + cl.items.length, 0);
  const doneItems = card.checklists.reduce((n, cl) => n + cl.items.filter((i) => i.complete).length, 0);
  const iVoted = myId ? card.votes.some((v) => v.userId === myId) : false;
  const showMeta =
    card.description || card.assignees.length > 0 || card.archivedAt || due !== "none" || totalItems > 0 || card.votes.length > 0 || card.storyPoints != null;
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border bg-background/65 text-left shadow-[0_12px_22px_-20px_rgb(0_0_0_/_0.9)] transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-ring hover:bg-card",
        overlay && "rotate-2 shadow-xl",
      )}
    >
      {card.coverAttachmentId ? (
        <AttachmentImage attachmentId={card.coverAttachmentId} alt="" className="h-20 w-full rounded-none" />
      ) : card.coverColor ? (
        <span className={cn("block h-1.5 w-full", labelStyle(card.coverColor).bar)} />
      ) : null}
      <span className="block p-2.5">
        {card.cardLabels.length > 0 ? (
          <span className="mb-1.5 flex flex-wrap gap-1">
            {card.cardLabels.map((cl) => (
              <span key={cl.id} title={cl.label.name || cl.label.color} className={cn("h-1.5 w-8 rounded-full", labelStyle(cl.label.color).bar)} />
            ))}
          </span>
        ) : null}
        <span className="flex items-start gap-1.5">
          <span className="flex-1 text-[13px] leading-snug font-medium break-words">{card.title}</span>
          {card.isTemplate ? (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              template
            </Badge>
          ) : null}
        </span>
        {showMeta ? (
          <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {card.description ? <AlignLeft className="size-3.5 text-muted-foreground" /> : null}
            {due !== "none" && card.dueAt ? (
              <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium tabular-nums", DUE_TEXT[due])}>
                {due === "complete" ? <Check className="size-3.5" /> : <Clock className="size-3.5" />}
                {dueLabel(card.dueAt)}
              </span>
            ) : null}
            {totalItems > 0 ? (
              <span className={cn("inline-flex items-center gap-1 text-[11px] tabular-nums", doneItems === totalItems ? "text-green-700 dark:text-green-300" : "text-muted-foreground")}>
                <ListChecks className="size-3.5" />
                {doneItems}/{totalItems}
              </span>
            ) : null}
            {card.votes.length > 0 ? (
              <span className={cn("inline-flex items-center gap-1 text-[11px] tabular-nums", iVoted ? "text-primary" : "text-muted-foreground")}>
                <ThumbsUp className="size-3.5" />
                {card.votes.length}
              </span>
            ) : null}
            {card.storyPoints != null ? (
              <Badge variant="secondary" className="tabular-nums">{card.storyPoints} pts</Badge>
            ) : null}
            {card.assignees.length > 0 ? (
              <span className="flex -space-x-1.5">
                {card.assignees.slice(0, 4).map((a) => (
                  <UserAvatar
                    key={a.userId}
                    name={a.user?.name}
                    email={a.user?.email}
                    image={a.user?.image}
                    className="size-5 ring-2 ring-card"
                  />
                ))}
              </span>
            ) : null}
            {card.assignees.length > 4 ? (
              <span className="text-[11px] text-muted-foreground">+{card.assignees.length - 4}</span>
            ) : null}
            {card.archivedAt ? (
              <Badge variant="secondary" className="ml-auto">
                archived
              </Badge>
            ) : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function SortableCardRow({ card, onOpen }: { card: BoardCard; onOpen: () => void }) {
  const sortable = useSortable({ id: card.id, data: { type: "card" } });
  return (
    <span
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={cn("block", sortable.isDragging && "opacity-40")}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <CardRow card={card} onOpen={onOpen} />
    </span>
  );
}
