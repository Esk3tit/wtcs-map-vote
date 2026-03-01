import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { Sentry } from '@/lib/sentry'
import { AdminErrorFallback } from '@/components/error-boundary'
import { createElement, useEffect } from 'react'

/** Captures the error to Sentry once (via effect) and renders the admin fallback. */
function ErrorCapture({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return createElement(AdminErrorFallback, { error, resetError: reset })
}

export const router = createRouter({
  routeTree,
  defaultErrorComponent: ({ error, reset }) => {
    return createElement(ErrorCapture, { error, reset })
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
