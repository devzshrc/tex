import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { useSession } from "@/lib/auth-client";

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
