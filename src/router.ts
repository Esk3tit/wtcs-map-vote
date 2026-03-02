import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { AdminErrorFallback } from '@/components/error-boundary'
import { createElement } from 'react'

export const router = createRouter({
  routeTree,
  defaultErrorComponent: ({ error, reset }) => {
    return createElement(AdminErrorFallback, { error, resetError: reset })
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
