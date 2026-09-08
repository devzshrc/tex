import type { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { navigate } from "@/lib/router";

type SignOutButtonProps = VariantProps<typeof buttonVariants> & {
  label?: string;
};

/** Signs out of the backend session, then returns to the sign-in page. */
export function SignOutButton({ label = "Sign out", ...props }: SignOutButtonProps) {
  return (
    <Button
      {...props}
      onClick={async () => {
        await authClient.signOut();
        navigate("/");
      }}
    >
      {label}
    </Button>
  );
}
