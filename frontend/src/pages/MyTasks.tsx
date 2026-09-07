import { CalendarDays } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { dueLabel } from "@/lib/due";
import { navigate } from "@/lib/router";
import { useMyTasks, useUpdateCard, type MyTask } from "@/lib/trello-queries";
import { EmptyState, PageHeader } from "../components/shared/primitives";
import { AppShell } from "../components/trello/AppShell";
import { cn } from "@/lib/utils";

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function TaskRow({ task }: { task: MyTask }) {
  const updateCard = useUpdateCard(task.boardId, task.id);
  const overdue = task.dueAt && !task.dueComplete && new Date(task.dueAt).getTime() < Date.now();
  return (
    <div className="flex items-center gap-2.5 p-3">
      <Checkbox
        checked={task.dueComplete}
        onCheckedChange={(checked) => updateCard.mutate({ dueComplete: checked === true })}
        aria-label={`Mark "${task.title}" ${task.dueComplete ? "incomplete" : "complete"}`}
      />
      <button onClick={() => navigate(`/b/${task.boardId}/c/${task.id}`)} className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-[13px] font-medium", task.dueComplete && "text-muted-foreground line-through")}>
          {task.title}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {task.boardTitle} · {task.listTitle}
        </span>
      </button>
      {task.dueAt ? (
        <span className={cn("shrink-0 text-[11px] tabular-nums", overdue ? "font-medium text-red-700 dark:text-red-300" : "text-muted-foreground")}>
          {dueLabel(task.dueAt)}
        </span>
      ) : null}
    </div>
  );
}

function Group({ title, tasks }: { title: string; tasks: MyTask[] }) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {title} · {tasks.length}
      </p>
      <div className="flex flex-col rounded-lg border border-border">
        {tasks.map((t, i) => (
          <div key={t.id}>
            {i > 0 ? <div className="h-px bg-border" /> : null}
            <TaskRow task={t} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Everything assigned to me, grouped by due state. Route `/tasks`. */
export function MyTasks() {
  const { data: tasks = [], isPending } = useMyTasks();
  const eod = endOfToday();
  const completed = tasks.filter((t) => t.dueComplete);
  const open = tasks.filter((t) => !t.dueComplete);
  const today = open.filter((t) => t.dueAt && new Date(t.dueAt).getTime() <= eod);
  const upcoming = open.filter((t) => t.dueAt && new Date(t.dueAt).getTime() > eod);
  const undated = open.filter((t) => !t.dueAt);

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-4 md:p-6">
        <PageHeader eyebrow="personal" title="My Tasks" hint="Every card assigned to you, across workspaces." />
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nothing assigned to you." hint="Enjoy the empty queue." />
        ) : (
          <>
            <Group title="Due today & overdue" tasks={today} />
            <Group title="Upcoming" tasks={upcoming} />
            <Group title="No due date" tasks={undated} />
            <Group title="Completed" tasks={completed} />
          </>
        )}
      </main>
    </AppShell>
  );
}
