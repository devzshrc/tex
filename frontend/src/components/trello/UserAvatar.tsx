import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  email,
  image,
  className,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  className?: string;
}) {
  const label = name ?? email ?? "?";
  return (
    <Avatar className={cn("size-6", className)}>
      {image ? <AvatarImage src={image} alt={label} /> : null}
      <AvatarFallback className="text-[10px] font-medium text-muted-foreground">
        {label.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export function userLabel(name?: string | null, email?: string | null): string {
  return name ?? email ?? "Deleted user";
}
