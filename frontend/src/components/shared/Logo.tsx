import { cn } from "@/lib/utils";

/** Brand mark: signal square + lowercase wordmark. Single source for the logo. */
export function Logo({ size = "md", withWordmark = true }: { size?: "sm" | "md" | "lg"; withWordmark?: boolean }) {
  const mark =
    size === "sm" ? "size-6 text-xs" : size === "lg" ? "size-10 text-lg" : "size-7 text-sm";
  const word = size === "sm" ? "text-[13px]" : size === "lg" ? "text-xl" : "text-sm";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn("flex shrink-0 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground", mark)}
      >
        t
      </span>
      {withWordmark ? <span className={cn("font-semibold tracking-tight", word)}>tex</span> : null}
    </span>
  );
}
