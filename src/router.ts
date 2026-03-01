import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { Sentry } from '@/lib/sentry'
import { AdminErrorFallback } from '@/components/error-boundary'
import { createElement } from 'react'

export const router = createRouter({
  routeTree,
  defaultErrorComponent: ({ error, reset }) => {
    Sentry.captureException(error)
    return createElement(AdminErrorFallback, { error, resetError: reset })
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
