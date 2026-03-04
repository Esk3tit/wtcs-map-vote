import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { ErrorBoundary } from '@sentry/react'
import { RootErrorFallback } from '@/components/error-boundary'
import { PolicyFooter } from '@/components/layout/policy-footer'

export const Route = createRootRoute({
  component: RootLayout,
})

/** Routes that render their own policy links (admin sidebar, login footer, policy pages) */
const ROUTES_WITH_OWN_LINKS = ['/admin', '/login', '/privacy', '/terms']

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const showFooter = !ROUTES_WITH_OWN_LINKS.some((r) => pathname === r || pathname.startsWith(r + '/'))

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
        {showFooter && <PolicyFooter />}
        <Toaster />
      </div>
    </ErrorBoundary>
  )
}
