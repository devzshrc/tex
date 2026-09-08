import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Two-step destructive button: first click arms, second fires.
 * Armed state is unmissable (destructive tint); blur disarms.
 */
export function ConfirmButton({
  label = "Delete…",
  confirmLabel = "Confirm?",
  icon,
  size = "sm",
  className,
  onConfirm,
  disabled,
}: {
  label?: string;
  confirmLabel?: string;
  icon?: ReactNode;
  size?: "sm" | "icon";
  className?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const fire = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onConfirm();
  };
  return (
    <Button
      variant="ghost"
      size={size}
      title={armed ? confirmLabel : label}
      aria-label={armed ? confirmLabel : label}
      disabled={disabled}
      onClick={fire}
      onBlur={() => setArmed(false)}
      className={cn(
        size === "icon" && "size-7",
        armed ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {size === "icon" ? icon : armed ? confirmLabel : (icon ?? label)}
    </Button>
  );
}
