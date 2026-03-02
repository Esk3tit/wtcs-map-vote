/**
 * Sentry Error Tracking
 *
 * Initializes Sentry with TanStack Router tracing and session replay.
 * Operates as a no-op when VITE_SENTRY_DSN is not configured.
 */

import * as Sentry from "@sentry/react";
import type { AnyRouter } from "@tanstack/react-router";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry with the application router.
 *
 * @param router - TanStack Router instance for route-aware tracing
 */
export function initSentry(router: AnyRouter) {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,

    integrations: [
      Sentry.tanstackRouterBrowserTracingIntegration(router),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],

    // Conservative sample rates for free tier (5k errors/month)
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    tracePropagationTargets: [/^\//],

    // Session replay: only capture on error to preserve budget
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    // Filter common browser noise
    ignoreErrors: [
      /^ResizeObserver loop/,
      /^Non-Error promise rejection captured/,
      "Failed to fetch",
      "Load failed",
      "NetworkError",
      /Loading chunk [\d]+ failed/,
      /dynamically imported module/,
    ],

    beforeSend(event, hint) {
      const error = hint.originalException;

      // Drop ConvexError — expected business logic errors.
      // Use error.name (preserved after minification) instead of constructor.name.
      if (
        error instanceof Error &&
        error.name === "ConvexError"
      ) {
        return null;
      }

      // Drop browser extension errors
      if (
        event.exception?.values?.[0]?.stacktrace?.frames?.some((frame) =>
          frame.filename?.includes("extension://"),
        )
      ) {
        return null;
      }

      return event;
    },
  });
}

export { Sentry };
