import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useConvexAuth } from '@/lib/convex'
import { Loader2 } from 'lucide-react'

const OAUTH_FLAG = 'oauthInProgress'

export const Route = createFileRoute('/')({
  component: IndexRedirect,
})

/**
 * Redirect index route based on auth state.
 *
 * Uses a component-level redirect instead of beforeLoad to avoid stripping
 * the ?code= parameter from OAuth callbacks. The ConvexAuthProvider's useEffect
 * needs to read ?code= from window.location.search before any URL changes occur.
 * A beforeLoad redirect fires during the render phase and strips it first.
 *
 * When an OAuth flow is in progress (flagged via sessionStorage), this component
 * keeps showing a spinner instead of redirecting to /login, giving the code
 * exchange time to complete. A 5-second timeout acts as a fallback.
 */
function IndexRedirect() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const navigate = useNavigate()
  const [oauthPending] = useState(
    () => sessionStorage.getItem(OAUTH_FLAG) === 'true',
  )

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        sessionStorage.removeItem(OAUTH_FLAG)
        void navigate({ to: '/admin/dashboard', replace: true })
      } else if (!oauthPending) {
        void navigate({ to: '/login', search: { error: undefined }, replace: true })
      }
      // oauthPending && !isAuthenticated: stay on spinner, wait for code exchange
    }
  }, [isAuthenticated, isLoading, oauthPending, navigate])

  // Fallback: if OAuth code exchange doesn't complete, redirect to login
  useEffect(() => {
    if (!oauthPending) return
    const timeout = setTimeout(() => {
      sessionStorage.removeItem(OAUTH_FLAG)
      void navigate({ to: '/login', search: { error: undefined }, replace: true })
    }, 5000)
    return () => clearTimeout(timeout)
  }, [oauthPending, navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  )
}
