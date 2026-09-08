import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { authClient, useSession } from "@/lib/auth-client";

/** Google-only sign-in: shadcn primitives only, mono type in stepped shades. */
export function GoogleAuth() {
  const { data: session, isPending, error } = useSession();
  const [signingIn, setSigningIn] = useState(false);

  if (isPending) {
    return (
      <div className="flex w-full items-center gap-3" aria-busy="true">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-center text-xs leading-relaxed text-destructive">
        Auth server unreachable. Is the backend running on {process.env.BUN_PUBLIC_AUTH_URL ?? "http://localhost:8000"}?
      </p>
    );
  }

  if (session?.user) {
    const label = session.user.name ?? session.user.email ?? "?";
    return (
      <div className="flex w-full items-center gap-3">
        <Avatar className="size-9">
          {session.user.image ? <AvatarImage src={session.user.image} alt={label} /> : null}
          <AvatarFallback className="text-xs font-medium text-muted-foreground">
            {label.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-foreground">{session.user.name ?? "Signed in"}</p>
          <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
        </div>
        <SignOutButton variant="ghost" size="sm" />
      </div>
    );
  }

  return (
    <Button
      className="w-full font-medium"
      disabled={signingIn}
      onClick={async () => {
        setSigningIn(true);
        try {
          // Land on the workspaces page after the Google round-trip.
          await authClient.signIn.social({
            provider: "google",
            callbackURL: `${window.location.origin}/o`,
          });
        } finally {
          setSigningIn(false);
        }
      }}
    >
      {signingIn ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
