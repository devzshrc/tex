import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-semibold tracking-[0.22em] text-primary uppercase", className)}>
      {children}
    </p>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed shadow-none", className)}>
      <CardContent className="flex flex-col items-center px-6 py-14 text-center">
        {Icon ? (
          <span className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Icon className="size-5 text-muted-foreground" />
          </span>
        ) : null}
        <p className="mt-3 text-sm font-medium">{title}</p>
        {hint ? <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-muted-foreground">{hint}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export function NotFoundCard({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Card className="mx-auto max-w-md shadow-none">
      <CardContent className="px-6 py-16 text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">{hint}</p>
        <Button size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  hint,
  actions,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em] md:text-4xl">{title}</h1>
        {hint ? <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}
