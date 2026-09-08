import type { ReactNode } from "react";
import { useState } from "react";
import {
  CheckSquare,
  ChevronDown,
  House,
  PanelLeft,
  Search,
  Star,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { Logo } from "@/components/shared/Logo";
import { useSession } from "@/lib/auth-client";
import { navigate, useLocation } from "@/lib/router";
import { useFavoritesStore, useUiStore } from "@/lib/store";
import { useOrgs } from "@/lib/trello-queries";
import { cn } from "@/lib/utils";

export function UserCluster() {
  const { data: session } = useSession();
  const user = session?.user;
  const label = user?.name ?? user?.email ?? "?";
  return (
    <div className="flex items-center gap-1.5">
      <ModeToggle />
      <Avatar className="size-7">
        {user?.image ? <AvatarImage src={user.image} alt={label} /> : null}
        <AvatarFallback className="text-[11px] font-medium text-muted-foreground">
          {label.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="hidden max-w-40 truncate text-[13px] font-medium xl:block">{user?.name ?? user?.email}</span>
      <SignOutButton variant="ghost" size="sm" />
    </div>
  );
}

function TopNav({ onSearch }: { onSearch: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:px-6">
      <button onClick={() => navigate("/o")} aria-label="tex home">
        <Logo size="sm" />
      </button>
      <button
        onClick={onSearch}
        className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-[13px] text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search boards, cards, people…</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      <div className="ml-auto">
        <UserCluster />
      </div>
    </header>
  );
}

function Row({
  icon,
  label,
  active,
  collapsed,
  badge,
  onClick,
  trailing,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  badge?: ReactNode;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
        active ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <span className="shrink-0 [&_svg]:size-4">{icon}</span>
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {!collapsed && badge}
      {!collapsed && trailing}
    </button>
  );
}

function Sidebar({ current }: { current: { pathname: string } }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { data: orgs = [] } = useOrgs();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const [orgsOpen, setOrgsOpen] = useCollapsedSection(true);

  return (
    <aside className={cn("hidden shrink-0 flex-col border-r border-border py-3 md:flex", collapsed ? "w-14 items-center px-2" : "w-60 px-3")}>
      <div className="flex w-full flex-col gap-0.5">
        <Row icon={<House />} label="Home" collapsed={collapsed} active={current.pathname === "/o"} onClick={() => navigate("/o")} />
        <Row icon={<CheckSquare />} label="My Tasks" collapsed={collapsed} active={current.pathname === "/tasks"} onClick={() => navigate("/tasks")} />
      </div>

      {!collapsed && (
        <>
          <button
            onClick={() => setOrgsOpen(!orgsOpen)}
            className="mt-4 mb-1 flex items-center gap-1 px-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
          >
            <ChevronDown className={cn("size-3 transition-transform", !orgsOpen && "-rotate-90")} />
            Workspaces
          </button>
          {orgsOpen && (
            <div className="flex flex-col gap-0.5">
              {orgs.map((org) => (
                <Row
                  key={org.id}
                  icon={
                    <span className="flex size-4 items-center justify-center rounded bg-muted text-[10px] font-semibold">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  }
                  label={org.name}
                  active={current.pathname === `/o/${org.id}`}
                  onClick={() => navigate(`/o/${org.id}`)}
                />
              ))}
            </div>
          )}

          {favorites.length > 0 && (
            <>
              <p className="mt-4 mb-1 px-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Favorites</p>
              <div className="flex flex-col gap-0.5">
                {favorites.map((fav) => (
                  <Row
                    key={fav.id}
                    icon={<Star className="fill-current" />}
                    label={fav.title}
                    active={current.pathname === `/b/${fav.id}`}
                    onClick={() => navigate(`/b/${fav.id}`)}
                    trailing={
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Unpin ${fav.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(fav);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") toggleFavorite(fav);
                        }}
                        className="hidden rounded p-0.5 hover:text-destructive group-hover:block"
                      >
                        <X className="size-3" />
                      </span>
                    }
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className="mt-auto flex w-full flex-col gap-0.5 pt-3">
        <Separator className="mb-2" />
        <Row icon={<PanelLeft />} label="Collapse" collapsed={collapsed} onClick={toggleSidebar} />
      </div>
    </aside>
  );
}

function useCollapsedSection(initial: boolean): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(initial);
  return [open, setOpen];
}

function BottomNav({ current }: { current: { pathname: string } }) {
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background md:hidden" aria-label="Primary">
      <button onClick={() => navigate("/o")} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", current.pathname === "/o" ? "text-foreground" : "text-muted-foreground")}>
        <House className="size-5" />
        Home
      </button>
      <button onClick={() => navigate("/tasks")} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", current.pathname === "/tasks" ? "text-foreground" : "text-muted-foreground")}>
        <CheckSquare className="size-5" />
        Tasks
      </button>
      <button onClick={() => setPaletteOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground">
        <Search className="size-5" />
        Search
      </button>
    </nav>
  );
}

/** Authenticated app frame: top nav + collapsible sidebar + content. */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopNav onSearch={() => setPaletteOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar current={{ pathname }} />
        <main className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
      </div>
      <BottomNav current={{ pathname }} />
    </div>
  );
}

export function OrgBadge({ role }: { role: string }) {
  return <Badge variant={role === "ADMIN" ? "default" : "secondary"}>{role.toLowerCase()}</Badge>;
}
