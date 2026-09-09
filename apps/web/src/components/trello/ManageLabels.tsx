import { useState } from "react";
import { Tag, X } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";
import { LABEL_COLORS, labelStyle, type LabelColor } from "@/lib/labels";
import { useCreateLabel, useDeleteLabel, useUpdateLabel } from "@/lib/trello-queries";
import type { Label } from "@/lib/trello";

function err(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

function LabelRow({ boardId, label }: { boardId: string; label: Label }) {
  const updateLabel = useUpdateLabel(boardId);
  const deleteLabel = useDeleteLabel(boardId);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`size-3 shrink-0 rounded-full ${labelStyle(label.color).dot}`} />
        <Input
          key={label.id + label.name}
          defaultValue={label.name}
          placeholder="Label name (optional)"
          maxLength={60}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== label.name) updateLabel.mutate({ labelId: label.id, name: next }, { onError: (e) => setError(err(e)) });
          }}
          className="h-8 text-[13px]"
        />
        <Select
          defaultValue={label.color}
          onValueChange={(color) => updateLabel.mutate({ labelId: label.id, color }, { onError: (e) => setError(err(e)) })}
        >
          <SelectTrigger size="sm" className="w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LABEL_COLORS.map((c) => (
              <SelectItem key={c} value={c}>
                <span className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${labelStyle(c).dot}`} />
                  {c}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Delete label ${label.name || label.color}`}
          onClick={() => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            deleteLabel.mutate({ labelId: label.id }, { onError: (e) => { setConfirm(false); setError(err(e)); } });
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
      {confirm ? <p className="pt-1 pl-5 text-[11px] text-destructive">Click × again to confirm — cards keep working, tags are removed.</p> : null}
      {error ? <p className="pt-1 pl-5 text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}

/** Board-level label CRUD. Labels are board-scoped color tags. */
export function ManageLabels({ boardId, labels }: { boardId: string; labels: Label[] }) {
  const createLabel = useCreateLabel(boardId);
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    setError(null);
    createLabel.mutate(
      { name: name.trim(), color },
      { onSuccess: () => setName(""), onError: (e) => setError(err(e)) },
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="hidden text-muted-foreground sm:inline-flex">
          <Tag className="size-4" />
          Labels
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Board labels</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2.5">
          {labels.map((label, i) => (
            <div key={label.id}>
              {i > 0 ? <Separator className="mb-2.5" /> : null}
              <LabelRow boardId={boardId} label={label} />
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <FieldLabel htmlFor="new-label-name">New label</FieldLabel>
            <Input
              id="new-label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
              placeholder="e.g. Bug"
              maxLength={60}
            />
          </div>
          <Select value={color} onValueChange={(v) => setColor(v as LabelColor)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABEL_COLORS.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${labelStyle(c).dot}`} />
                    {c}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9" onClick={add} disabled={createLabel.isPending}>
            Add
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
