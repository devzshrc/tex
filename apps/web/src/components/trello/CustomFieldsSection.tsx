import { useState } from "react";
import { Plus, X } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  useBoardDetail,
  useCardDetail,
  useClearFieldValue,
  useSetFieldValue,
} from "@/lib/trello-queries";
import type { CustomFieldDef } from "@/lib/trello";

function err(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

function FieldEditor({ boardId, cardId, def, onError }: { boardId: string; cardId: string; def: CustomFieldDef; onError: (e: unknown) => void }) {
  const { data: card } = useCardDetail(cardId);
  const setValue = useSetFieldValue(boardId, cardId);
  const clearValue = useClearFieldValue(boardId, cardId);
  const current = card?.customFieldValues.find((v) => v.fieldId === def.id);

  const save = (value: unknown) => setValue.mutate({ fieldId: def.id, value }, { onError: (e) => onError(e) });

  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 truncate text-[13px] text-muted-foreground">{def.name}</span>
      {def.type === "TEXT" ? (
        <Input
          key={def.id + (current?.valueText ?? "")}
          defaultValue={current?.valueText ?? ""}
          placeholder="Empty"
          maxLength={2000}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if ((next || null) !== current?.valueText) save(next);
          }}
          className="h-8 text-[13px]"
        />
      ) : null}
      {def.type === "NUMBER" ? (
        <Input
          key={def.id + (current?.valueNumber ?? "")}
          type="number"
          defaultValue={current?.valueNumber ?? ""}
          placeholder="Empty"
          onBlur={(e) => {
            if (e.target.value === "") {
              if (current) clearValue.mutate({ fieldId: def.id }, { onError: (e) => onError(e) });
              return;
            }
            const next = Number(e.target.value);
            if (Number.isFinite(next) && next !== current?.valueNumber) save(next);
          }}
          className="h-8 text-[13px]"
        />
      ) : null}
      {def.type === "DATE" ? (
        <Input
          key={def.id + (current?.valueDate ?? "")}
          type="date"
          defaultValue={current?.valueDate ? current.valueDate.slice(0, 10) : ""}
          onBlur={(e) => {
            if (!e.target.value) {
              if (current) clearValue.mutate({ fieldId: def.id }, { onError: (e) => onError(e) });
              return;
            }
            save(new Date(`${e.target.value}T00:00:00`).toISOString());
          }}
          className="h-8 text-[13px]"
        />
      ) : null}
      {def.type === "SELECT" ? (
        <Select
          key={def.id + (current?.valueText ?? "")}
          defaultValue={current?.valueText ?? undefined}
          onValueChange={(v) => save(v)}
        >
          <SelectTrigger size="sm" className="flex-1">
            <SelectValue placeholder="Empty" />
          </SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {current ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Clear ${def.name}`}
          onClick={() => clearValue.mutate({ fieldId: def.id }, { onError: (e) => onError(e) })}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

export function CustomFieldsSection({ boardId, cardId, onError }: { boardId: string; cardId: string; onError: (e: unknown) => void }) {
  const { data: board } = useBoardDetail(boardId, false);
  const defs = board?.customFieldDefs ?? [];
  if (defs.length === 0) return null;
  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">custom fields</p>
      <div className="flex flex-col gap-2">
        {defs.map((def) => (
          <FieldEditor key={def.id} boardId={boardId} cardId={cardId} def={def} onError={onError} />
        ))}
      </div>
    </section>
  );
}
