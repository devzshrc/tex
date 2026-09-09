import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleAuth } from "../components/auth/GoogleAuth";
import { Logo } from "../components/shared/Logo";
import { Link } from "@/lib/router";

/** Public sign-in. Session holders are sent to /o. */
export function SignIn() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Link to="/" aria-label="tex home">
          <Logo size="lg" />
        </Link>
        <Card className="w-full border-border bg-card/90">
          <CardHeader className="gap-2 text-center">
            <p className="section-kicker">secure entry</p>
            <CardTitle className="text-3xl font-semibold tracking-[-0.045em]">Welcome Back</CardTitle>
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
    </main>
  );
}
