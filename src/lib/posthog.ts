/**
 * PostHog Analytics
 *
 * Initializes PostHog product analytics and session replay.
 * Operates as a no-op when VITE_PUBLIC_POSTHOG_KEY is not configured.
 */

import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * Initialize PostHog analytics.
 * Returns the PostHog instance if configured, null otherwise.
 */
export function initPostHog(): typeof posthog | null {
  if (!POSTHOG_KEY) return null;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // SPA page view tracking — listen to History API changes.
    // TanStack Router uses pushState under the hood, so this works automatically.
    capture_pageview: "history_change",
    capture_pageleave: "if_capture_pageview",

    // Disable autocapture — use explicit events only
    autocapture: false,

    // Privacy
    persistence: "localStorage",
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
    },

    // Strip player tokens from URLs before capture
    sanitize_properties: (properties) => {
      if (properties.$current_url) {
        properties.$current_url = properties.$current_url.replace(
          /\/(vote|lobby)\/[a-zA-Z0-9-]+/,
          "/$1/[REDACTED]",
        );
      }
      if (properties.$pathname) {
        properties.$pathname = properties.$pathname.replace(
          /\/(vote|lobby)\/[a-zA-Z0-9-]+/,
          "/$1/[REDACTED]",
        );
      }
      return properties;
    },

    // Debug logging in development only
    debug: import.meta.env.DEV,
  });

  return posthog;
}

export { posthog };
