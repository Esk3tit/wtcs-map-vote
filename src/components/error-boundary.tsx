import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorFallbackProps {
  error: Error;
  resetError?: () => void;
}

/** Player-facing error fallback — simple, reassuring, no technical details. */
export function PlayerErrorFallback({ resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h1 className="text-2xl font-bold">Connection Issue</h1>
        <p className="text-muted-foreground">
          Something went wrong. Please reload to rejoin your session.
        </p>
        <Button
          onClick={resetError ?? (() => window.location.reload())}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Page
        </Button>
      </Card>
    </div>
  );
}

/** Admin-facing error fallback — shows error detail with retry and reload. */
export function AdminErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <Card className="max-w-lg p-8 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">An error occurred</h1>
        <p className="text-muted-foreground">
          Please reload the page. If this persists, contact support.
        </p>
        <pre className="max-w-full overflow-auto rounded bg-muted p-3 text-xs text-left text-muted-foreground">
          {error.message}
        </pre>
        <div className="flex gap-2 justify-center">
          {resetError && (
            <Button onClick={resetError} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Root-level error fallback — minimal, works even if design system fails.
 * Used by the outermost Sentry.ErrorBoundary in __root.tsx.
 */
export function RootErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <div className="dark min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <AlertTriangle className="h-16 w-16 text-destructive" />
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground">
        An unexpected error occurred. The error has been reported.
      </p>
      {import.meta.env.DEV && (
        <pre className="max-w-md overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}
      <button
        onClick={() => window.location.reload()}
        className="rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Reload Page
      </button>
    </div>
  );
}
