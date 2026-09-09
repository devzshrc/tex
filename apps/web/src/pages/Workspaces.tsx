import { useState } from "react";
import { Plus } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { navigate } from "@/lib/router";
import { useCreateOrg, useOrgs, useReminders } from "@/lib/trello-queries";
import { dueLabel } from "@/lib/due";
import { EmptyState, PageHeader } from "../components/shared/primitives";
import { AppShell } from "../components/trello/AppShell";

/** Workspace home: org list + create. Route `/o`. */
export function Workspaces() {
  const { data: orgs, isPending } = useOrgs();
  const { data: reminders = [] } = useReminders(7);
  const createOrg = useCreateOrg();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    createOrg.mutate(
      { name: name.trim(), slug: slug.trim() },
      {
        onSuccess: (org) => { setOpen(false); setName(""); setSlug(""); navigate(`/o/${org.id}`); },
        onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong"),
      },
    );
  };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">
        <PageHeader
          eyebrow="workspaces"
          title="Your organizations"
          actions={
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" />
                  New workspace
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create workspace</DialogTitle>
                  <DialogDescription>Workspaces hold boards, members and invites. The slug is permanent.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="org-name">Name</Label>
                    <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="org-slug">Slug</Label>
                    <Input id="org-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-inc" className="font-mono" />
                  </div>
                  {error ? <p className="text-xs text-destructive">{error}</p> : null}
                </div>
                <DialogFooter>
                  <Button size="sm" onClick={submit} disabled={!name.trim() || !slug.trim() || createOrg.isPending}>
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        {isPending ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : orgs && orgs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {orgs.map((org) => (
              <button key={org.id} onClick={() => navigate(`/o/${org.id}`)} className="group text-left">
                <Card className="h-full gap-0 border-border bg-card/80 py-0 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/60 hover:bg-card">
                  <CardContent className="flex items-center gap-4 p-5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-[0_12px_28px_-16px_var(--primary)]">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold tracking-[-0.03em]">{org.name}</span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] tracking-wider text-muted-foreground uppercase">/{org.slug}</span>
                    </span>
                    <Badge variant={org.role === "ADMIN" ? "default" : "secondary"}>{org.role.toLowerCase()}</Badge>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No workspaces yet"
            hint="Create your first workspace to start organizing boards."
          />
        )}

        {reminders.length > 0 ? (
          <section className="mt-8">
            <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
              due soon · assigned to you
            </p>
            <div className="editorial-panel flex flex-col rounded-2xl">
              {reminders.slice(0, 8).map((r, i) => {
                const overdue = new Date(r.dueAt).getTime() < Date.now();
                return (
                  <div key={r.id}>
                    {i > 0 ? <div className="h-px bg-border" /> : null}
                    <button
                      onClick={() => navigate(`/b/${r.boardId}/c/${r.id}`)}
                      className="flex w-full items-center gap-2.5 p-3 text-left hover:bg-muted/50"
                    >
                      <span className={`size-1.5 shrink-0 rounded-full ${overdue ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{r.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {r.boardTitle} · {r.listTitle}
                        </span>
                      </span>
                      <span className={`shrink-0 text-[11px] font-medium tabular-nums ${overdue ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>
                        {overdue ? "overdue · " : ""}{dueLabel(r.dueAt)}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}
