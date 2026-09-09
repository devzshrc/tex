import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { navigate } from "@/lib/router";
import { useAcceptInvite } from "@/lib/trello-queries";

/** Join-by-link: validates the invite token, then lands on the workspace. */
export function AcceptInvite({ token }: { token: string }) {
  const { data: session, isPending } = useSession();
  const accept = useAcceptInvite();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!isPending && session?.user && !started) {
      setStarted(true);
      accept.mutate({ token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session, started]);

  useEffect(() => {
    if (accept.isSuccess && accept.data) navigate(`/o/${accept.data.id}`);
  }, [accept.isSuccess, accept.data]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-sm border-border bg-card/90">
        <CardContent className="px-6 py-12 text-center">
          {isPending || (started && accept.isPending) ? (
            <>
              <Skeleton className="mx-auto h-5 w-40" />
              <p className="mt-3 text-[13px] text-muted-foreground">
                {isPending ? "Checking session…" : "Joining workspace…"}
              </p>
            </>
          ) : !session?.user ? (
            <>
              <p className="section-kicker">workspace invite</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Sign In to Accept</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">
                This invite link works once you're signed in — come back to it after.
              </p>
              <Button size="sm" className="mt-4" onClick={() => navigate("/")}>
                Go to Sign In
              </Button>
            </>
          ) : accept.isError ? (
            <>
              <p className="section-kicker">workspace invite</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Invite Unavailable</p>
              <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">
                {accept.error instanceof ApiError ? accept.error.message : "This invite is invalid or expired."}
              </p>
              <Button size="sm" className="mt-4" onClick={() => navigate("/o")}>
                Back to workspaces
              </Button>
            </>
          ) : (
            <>
              <p className="section-kicker">workspace invite</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">You’re In</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Taking you to the workspace…</p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
