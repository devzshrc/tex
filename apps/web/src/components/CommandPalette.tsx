import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { ArrowRight, CheckSquare, House, Keyboard, LogOut, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authClient, useSession } from "@/lib/auth-client";
import { navigate } from "@/lib/router";
import { getRecentBoards, useUiStore } from "@/lib/store";
import { useSearch } from "@/lib/trello-queries";

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const { setTheme, resolvedTheme } = useTheme();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 200);
  const { data: results, isFetching } = useSearch(debounced);
  const recents = open ? getRecentBoards() : [];

  useEffect(() => {
    if (!open) setQuery("");
  }, [open ]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed top-[18%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      overlayClassName="fixed inset-0 z-50 bg-black/50"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search boards, cards…  (commands when empty)"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isFetching ? <span className="font-mono text-[10px] text-muted-foreground">…</span> : null}
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted-foreground">
          {debounced.trim().length >= 2 ? "No matches. Try another board, card, or member." : "Type to search."}
        </Command.Empty>

        {query.trim() === "" && (
          <Command.Group heading="Go to" className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            <PaletteItem icon={<House />} label="Home" hint="workspaces" onSelect={() => go("/o")} />
            <PaletteItem icon={<CheckSquare />} label="My Tasks" hint="assigned to you" onSelect={() => go("/tasks")} />
            <PaletteItem
              icon={resolvedTheme === "dark" ? <Sun /> : <Moon />}
              label={`Theme: switch to ${resolvedTheme === "dark" ? "light" : "dark"}`}
              onSelect={() => {
                setTheme(resolvedTheme === "dark" ? "light" : "dark");
                setOpen(false);
              }}
            />
            <PaletteItem icon={<Keyboard />} label="Keyboard shortcuts" hint="?" onSelect={() => { setOpen(false); setShortcutsOpen(true); }} />
            <PaletteItem
              icon={<LogOut />}
              label="Sign out"
              onSelect={async () => {
                setOpen(false);
                await authClient.signOut();
                navigate("/");
              }}
            />
          </Command.Group>
        )}

        {query.trim() === "" && recents.length > 0 && (
          <Command.Group heading="Recent boards" className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {recents.map((b) => (
              <PaletteItem key={b.id} icon={<ArrowRight />} label={b.title} onSelect={() => go(`/b/${b.id}`)} />
            ))}
          </Command.Group>
        )}

        {results && results.boards.length > 0 && (
          <Command.Group heading="Boards" className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {results.boards.map((b) => (
              <PaletteItem key={b.id} label={b.title} hint={b.organizationName} onSelect={() => go(`/b/${b.id}`)} />
            ))}
          </Command.Group>
        )}

        {results && results.cards.length > 0 && (
          <Command.Group heading="Cards" className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {results.cards.map((c) => (
              <PaletteItem
                key={c.id}
                label={c.title}
                hint={`${c.boardTitle} · ${c.listTitle}`}
                onSelect={() => go(`/b/${c.boardId}/c/${c.id}`)}
              />
            ))}
          </Command.Group>
        )}
      </Command.List>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span className="ml-auto">esc close</span>
      </div>
    </Command.Dialog>
  );
}

function PaletteItem({ icon, label, hint, onSelect }: { icon?: React.ReactNode; label: string; hint?: string; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] aria-selected:bg-accent aria-selected:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {hint ? <span className="shrink-0 truncate font-mono text-[11px] text-muted-foreground">{hint}</span> : null}
    </Command.Item>
  );
}

const SHORTCUTS: [string, string][] = [
  ["⌘K / Ctrl+K", "Command palette"],
  ["?", "This shortcuts dialog"],
  ["Esc", "Close dialog, sheet, or palette"],
  ["Enter", "Confirm inline editing"],
];

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col">
          {SHORTCUTS.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between border-b border-border py-2.5 text-[13px] last:border-0">
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{keys}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GlobalShortcuts() {
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest("input, textarea, select, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useUiStore.getState().paletteOpen);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen, setShortcutsOpen]);
  return null;
}

export function toastCopied(label: string): void {
  toast.success(`${label} link copied`);
}
