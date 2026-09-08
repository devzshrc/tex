import { useState } from "react";
import { Plus, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/lib/api";
import { useBoardDetail, useCreateField, useDeleteField, useUpdateField } from "@/lib/trello-queries";
import type { CustomFieldDef, CustomFieldType } from "@/lib/trello";

function err(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

function FieldRow({ boardId, def }: { boardId: string; def: CustomFieldDef }) {
  const updateField = useUpdateField(boardId);
  const deleteField = useDeleteField(boardId);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          key={def.id + def.name}
          defaultValue={def.name}
          maxLength={60}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== def.name) updateField.mutate({ fieldId: def.id, name: next }, { onError: (e) => setError(err(e)) });
          }}
          className="h-8 text-[13px]"
          aria-label="Field name"
        />
        <Badge variant="secondary" className="shrink-0">{def.type.toLowerCase()}</Badge>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Delete field ${def.name}`}
          onClick={() => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            deleteField.mutate({ fieldId: def.id }, { onError: (e) => { setConfirm(false); setError(err(e)); } });
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
      {def.type === "SELECT" ? (
        <Input
          key={def.id + (def.options ?? []).join("|")}
          defaultValue={(def.options ?? []).join(", ")}
          placeholder="Options, comma separated"
          onBlur={(e) => {
            const options = e.target.value.split(",").map((o) => o.trim()).filter(Boolean);
            updateField.mutate({ fieldId: def.id, options }, { onError: (e) => setError(err(e)) });
          }}
          className="mt-1.5 h-8 text-[13px]"
          aria-label="Field options"
        />
      ) : null}
      {confirm ? <p className="pt-1 text-[11px] text-destructive">Click × again to confirm — values on cards are deleted too.</p> : null}
      {error ? <p className="pt-1 text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}

/** Board custom-field definitions (text/number/date/select). */
export function ManageCustomFields({ boardId }: { boardId: string }) {
  const { data: board } = useBoardDetail(boardId, false);
  const createField = useCreateField(boardId);
  const [name, setName] = useState("");
  const [type, setType] = useState<CustomFieldType>("TEXT");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const defs = board?.customFieldDefs ?? [];

  const add = () => {
    const value = name.trim();
    if (!value) return;
    setError(null);
    createField.mutate(
      { name: value, type, options: type === "SELECT" ? options.split(",").map((o) => o.trim()).filter(Boolean) : undefined },
      { onSuccess: () => { setName(""); setOptions(""); }, onError: (e) => setError(err(e)) },
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="hidden text-muted-foreground sm:inline-flex">
          <SlidersHorizontal className="size-4" />
          Fields
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom fields</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2.5">
          {defs.map((def, i) => (
            <div key={def.id}>
              {i > 0 ? <Separator className="mb-2.5" /> : null}
              <FieldRow boardId={boardId} def={def} />
            </div>
          ))}
          {defs.length === 0 ? <p className="text-[13px] text-muted-foreground">No fields yet. Add priority, budget, ship date…</p> : null}
        </div>
        <Separator />
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <FieldLabel htmlFor="new-field-name">New field</FieldLabel>
            <Input id="new-field-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="e.g. Priority" maxLength={60} />
          </div>
          <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEXT">text</SelectItem>
              <SelectItem value="NUMBER">number</SelectItem>
              <SelectItem value="DATE">date</SelectItem>
              <SelectItem value="SELECT">select</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9" onClick={add} disabled={!name.trim() || createField.isPending}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        {type === "SELECT" ? (
          <Input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Options, comma separated" className="h-8 text-[13px]" aria-label="Field options" />
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
