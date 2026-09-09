import type { ReactNode } from "react";
import { useState } from "react";
import {
  CheckSquare,
  ChevronDown,
  House,
  PanelLeft,
  Search,
  Star,
} from "@/components/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Logo } from "@/components/shared/Logo";
import { useSession } from "@/lib/auth-client";
import { Link, navigate, useLocation } from "@/lib/router";
import { useFavoritesStore, useUiStore } from "@/lib/store";
import { useOrgs } from "@/lib/trello-queries";
import { cn } from "@/lib/utils";

export function UserCluster() {
  const { data: session } = useSession();
  const user = session?.user;
  const label = user?.name ?? user?.email ?? "?";
  return (
    <div className="flex items-center gap-1.5">
      <Avatar className="size-8 border border-border">
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
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <Link to="/o" aria-label="tex home">
        <Logo size="sm" />
      </Link>
      <button
        onClick={onSearch}
        className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-full border border-border bg-muted/35 px-3.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/70 hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search boards, cards, people…</span>
        <kbd className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
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
        "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
        active ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-16px_var(--primary)]" : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground",
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
  const [orgsOpen, setOrgsOpen] = useCollapsedSection(true);

  return (
    <aside className={cn("hidden shrink-0 flex-col border-r border-border bg-sidebar/72 py-4 backdrop-blur-xl md:flex", collapsed ? "w-16 items-center px-2" : "w-64 px-3")}>
      <div className="flex w-full flex-col gap-0.5">
        {!collapsed ? <p className="mb-1 px-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Navigate</p> : null}
        <Row icon={<House />} label="Overview" collapsed={collapsed} active={current.pathname === "/o"} onClick={() => navigate("/o")} />
        <Row icon={<CheckSquare />} label="My Tasks" collapsed={collapsed} active={current.pathname === "/tasks"} onClick={() => navigate("/tasks")} />
      </div>

      {!collapsed && (
        <>
          <button
            onClick={() => setOrgsOpen(!orgsOpen)}
            className="mt-6 mb-1 flex w-full items-center gap-1 px-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
          >
            <ChevronDown className={cn("size-3 transition-transform", !orgsOpen && "-rotate-90")} />
            <span>Your Workspaces</span>
            <span className="ml-auto text-primary">{orgs.length}</span>
          </button>
          {orgsOpen && (
            <div className="flex flex-col gap-0.5">
              {orgs.map((org) => (
                <Row
                  key={org.id}
                  icon={
                    <span className="flex size-4 items-center justify-center rounded bg-primary/15 text-[10px] font-semibold text-primary">
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
              <p className="mt-6 mb-1 px-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Starred Boards</p>
              <div className="flex flex-col gap-0.5">
                {favorites.map((fav) => (
                  <Row
                    key={fav.id}
                    icon={<Star className="fill-current" />}
                    label={fav.title}
                    active={current.pathname === `/b/${fav.id}`}
                    onClick={() => navigate(`/b/${fav.id}`)}
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
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Primary">
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
      <a href="#main-content" className="skip-link">Skip to content</a>
      <TopNav onSearch={() => setPaletteOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar current={{ pathname }} />
        <div id="main-content" className="min-w-0 flex-1 pb-16 md:pb-0">{children}</div>
      </div>
      <BottomNav current={{ pathname }} />
    </div>
  );
}

export function OrgBadge({ role }: { role: string }) {
  return <Badge variant={role === "ADMIN" ? "default" : "secondary"}>{role.toLowerCase()}</Badge>;
}
