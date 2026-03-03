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

/** Redact player tokens from URL paths: /vote/{token} → /vote/[REDACTED] */
const redactPath = (path: string) =>
  path.replace(/\/(vote|lobby)\/[^/?#]+/g, "/$1/[REDACTED]");

/** Redact tokens from a full URL (path segments + ?token= query param) */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = redactPath(parsed.pathname);
    if (parsed.searchParams.has("token")) {
      parsed.searchParams.set("token", "[REDACTED]");
    }
    return parsed.toString();
  } catch {
    return redactPath(url);
  }
}

/** All PostHog properties that contain full URLs */
const URL_PROPERTIES = [
  "$current_url",
  "$referrer",
  "$initial_referrer",
  "$initial_current_url",
  "$session_entry_url",
] as const;

/** All PostHog properties that contain path-only values */
const PATH_PROPERTIES = ["$pathname", "$session_entry_pathname"] as const;

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
    session_recording: {
      maskAllInputs: true,
    },

    // Strip player tokens from all URL-bearing properties before capture
    sanitize_properties: (properties) => {
      for (const key of URL_PROPERTIES) {
        if (typeof properties[key] === "string") {
          properties[key] = redactUrl(properties[key]);
        }
      }
      for (const key of PATH_PROPERTIES) {
        if (typeof properties[key] === "string") {
          properties[key] = redactPath(properties[key]);
        }
      }
      return properties;
    },

    // Debug logging in development only
    debug: import.meta.env.DEV,
  });

  return posthog;
}
