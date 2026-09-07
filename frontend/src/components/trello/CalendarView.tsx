import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { labelStyle } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { BoardCard, BoardDetail } from "@/lib/trello";

interface DatedCard extends BoardCard {
  listTitle: string;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Month grid of cards with due dates. Sunday-first, minimal. */
export function CalendarView({ board, onOpenCard }: { board: BoardDetail; onOpenCard: (cardId: string) => void }) {
  const dated = useMemo<DatedCard[]>(
    () =>
      board.lists.flatMap((l) =>
        l.cards
          .filter((c) => c.dueAt && !c.archivedAt)
          .map((c) => ({ ...c, listTitle: l.title })),
      ),
    [board],
  );

  const [month, setMonth] = useState(() => {
    const first = dated.map((c) => new Date(c.dueAt as string).getTime()).sort((a, b) => a - b)[0];
    const base = first && !Number.isNaN(first) ? new Date(first) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const cells = useMemo(() => {
    const startOffset = month.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const prevMonthDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
    const list: { date: Date; outside: boolean }[] = [];
    for (let i = startOffset - 1; i >= 0; i -= 1) {
      list.push({ date: new Date(month.getFullYear(), month.getMonth() - 1, prevMonthDays - i), outside: true });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      list.push({ date: new Date(month.getFullYear(), month.getMonth(), d), outside: false });
    }
    while (list.length % 7 !== 0 || list.length < 35) {
      const last = list[list.length - 1]?.date ?? new Date();
      list.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
    }
    return list;
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, DatedCard[]>();
    for (const c of dated) {
      const k = dayKey(new Date(c.dueAt as string));
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => +new Date(a.dueAt as string) - +new Date(b.dueAt as string));
    return map;
  }, [dated]);

  const today = new Date();

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <p className="text-sm font-semibold tracking-tight">
          {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </p>
        <span className="ml-2 text-[11px] text-muted-foreground tabular-nums">{dated.length} dated</span>
        <span className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </span>
      </div>
      <div className="grid grid-cols-7 border-b border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <p key={d} className="px-2 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">
            {d}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(({ date, outside }, i) => {
          const cards = byDay.get(dayKey(date)) ?? [];
          return (
            <div
              key={`${date.getTime()}-${i}`}
              className={cn("min-h-20 border-b border-border p-1.5 [&:nth-last-child(-n+7)]:border-b-0", outside && "bg-muted/30")}
            >
              <p className={cn(
                "inline-flex size-6 items-center justify-center rounded-full text-[11px] tabular-nums",
                sameDay(date, today) ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
              )}>
                {date.getDate()}
              </p>
              <div className="mt-1 flex flex-col gap-1">
                {cards.slice(0, 3).map((c) => {
                  const dot = c.cardLabels[0] ? labelStyle(c.cardLabels[0].label.color).dot : "bg-muted-foreground/40";
                  const overdue = !c.dueComplete && new Date(c.dueAt as string).getTime() < Date.now();
                  return (
                    <button
                      key={c.id}
                      onClick={() => onOpenCard(c.id)}
                      title={`${c.title} · ${c.listTitle}`}
                      className="flex items-center gap-1.5 rounded border border-border bg-background px-1.5 py-1 text-left hover:border-ring"
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", dot)} />
                      <span className={cn("min-w-0 flex-1 truncate text-[11px] font-medium", overdue && "text-red-700 dark:text-red-300")}>
                        {c.title}
                      </span>
                      {c.dueComplete ? <span className="shrink-0 text-[10px] text-green-700 dark:text-green-300">done</span> : null}
                    </button>
                  );
                })}
                {cards.length > 3 ? <p className="px-1 text-[10px] text-muted-foreground">+{cards.length - 3} more</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
