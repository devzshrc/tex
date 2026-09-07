import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleAuth } from "../components/auth/GoogleAuth";
import { ModeToggle } from "../components/theme/ModeToggle";
import { Logo } from "../components/shared/Logo";
import { navigate } from "@/lib/router";

/** Public sign-in. Session holders are sent to /o. */
export function SignIn() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-5">
        <button onClick={() => navigate("/")} aria-label="tex home">
          <Logo size="lg" />
        </button>
        <Card className="relative w-full shadow-none">
          <div className="absolute top-3 right-3">
            <ModeToggle />
          </div>
          <CardHeader className="gap-1.5 text-center">
            <p className="text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">authentication</p>
            <CardTitle className="text-xl font-semibold tracking-tight">Sign in</CardTitle>
            <CardDescription className="text-[13px]">Continue with your Google account.</CardDescription>
          </CardHeader>
          <CardContent>
            <GoogleAuth />
          </CardContent>
          <CardFooter className="justify-center border-t pt-4">
            <p className="text-[11px] text-muted-foreground">OAuth 2.0 · sessions via Better Auth</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
