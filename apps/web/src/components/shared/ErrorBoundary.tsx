import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface State {
  failed: boolean;
}

/** Last-resort catch: a crashing widget must never blank the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode; label: string }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary:${this.props.label}]`, error);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <Card className="w-full max-w-sm shadow-none">
          <CardContent className="px-6 py-12 text-center">
            <p className="text-sm font-medium">Something went wrong</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">
              This section couldn't load. Your data is safe.
            </p>
            <Button size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Reload application
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
