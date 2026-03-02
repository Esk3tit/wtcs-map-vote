import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@sentry/react'
import { RootErrorFallback } from '@/components/error-boundary'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <RootErrorFallback
          error={error instanceof Error ? error : new Error(String(error))}
          resetError={resetError}
        />
      )}
      beforeCapture={(scope) => {
        scope.setTag("boundary", "root");
      }}
    >
      <div className="dark min-h-screen bg-background text-foreground">
        <Outlet />
        <Toaster />
      </div>
    </ErrorBoundary>
  )
}
