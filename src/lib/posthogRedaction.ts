/**
 * PostHog Event Redaction & Tagging
 *
 * Pure `before_send` handler for PostHog: strips player tokens from URL-bearing
 * properties and stamps every event with the app identifier. Kept free of any
 * runtime `posthog-js` import (types only) so it is unit-testable in a node
 * environment without loading the browser SDK.
 */

import type { CaptureResult } from "posthog-js";

/** Tag every event with the app name so this app and the Community Polls app
 *  can share one PostHog project and filter per-app. */
const APP_NAME = "map-vote-ban";

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
 * PostHog `before_send` handler. Redacts player tokens from URL-bearing
 * properties and stamps the `app` tag on every event — including the SDK's
 * macrotask-deferred initial `$pageview`. Setting the tag here (rather than via
 * `register()`/`loaded`) makes it independent of init/network timing.
 *
 * Always returns the event; returning `null` would drop it.
 */
export function beforeSendEvent(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event) return event;

  const properties = event.properties;
  if (properties) {
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
    properties.app = APP_NAME;
  }

  return event;
}
