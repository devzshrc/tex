import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CommandPalette, GlobalShortcuts, ShortcutsDialog } from "@/components/CommandPalette";
import { NotFoundCard } from "@/components/shared/primitives";
import { useSession } from "@/lib/auth-client";
import { navigate, useLocation } from "@/lib/router";
import { AcceptInvite } from "./pages/AcceptInvite";
import { Board } from "./pages/Board";
import { Landing } from "./pages/Landing";
import { MyTasks } from "./pages/MyTasks";
import { OrgBoards } from "./pages/OrgBoards";
import { SignIn } from "./pages/SignIn";
import { Workspaces } from "./pages/Workspaces";
import "./index.css";

function AuthSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <Skeleton className="h-8 w-48" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

/**
 * Route switch. `/` (landing) and `/signin` are public; everything else
 * needs a session (signed-in visitors to either are sent to `/o`).
 * Card routes nest under their board (`/b/:id/c/:cardId`) so the sheet
 * deep-links with board context preserved; legacy `?card=` still works.
 */
export function App() {
  const { pathname } = useLocation();
  const { data: session, isPending } = useSession();
  const authed = !!session?.user;

  useEffect(() => {
    if (isPending) return;
    if (pathname === "/dashboard") navigate("/o");
    else if ((pathname === "/" || pathname === "/signin") && authed) navigate("/o");
  }, [pathname, authed, isPending]);

  const segments = pathname.split("/").filter(Boolean);

  if (pathname === "/") return <Landing />;
  if (pathname === "/signin") return <SignIn />;

  if (isPending) return <AuthSkeleton />;
  if (!authed) return <SignIn />;

  const shell = (node: React.ReactNode) => (
    <>
      {node}
      <CommandPalette />
      <ShortcutsDialog />
      <GlobalShortcuts />
    </>
  );

  if (pathname === "/o") return shell(<Workspaces />);
  if (pathname === "/tasks") return shell(<MyTasks />);
  if (segments[0] === "o" && segments[1]) return shell(<OrgBoards orgId={segments[1] as string} />);
  if (segments[0] === "b" && segments[1]) {
    const nestedCardId = segments[2] === "c" && segments[3] ? (segments[3] as string) : null;
    return shell(<Board boardId={segments[1] as string} cardId={nestedCardId} />);
  }
  if (segments[0] === "invite" && segments[1]) return shell(<AcceptInvite token={segments[1] as string} />);

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <NotFoundCard
        title="Page not found"
        hint="That route doesn't exist."
        actionLabel="Back to workspaces"
        onAction={() => navigate("/o")}
      />
    </div>
  );
}

export default App;
