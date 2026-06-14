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
export const APP_NAME = "map-vote-ban";

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

/** Redact tokens from every URL- and path-bearing key in a property bag. */
function redactProperties(props: Record<string, unknown>): void {
  for (const key of URL_PROPERTIES) {
    const value = props[key];
    if (typeof value === "string") props[key] = redactUrl(value);
  }
  for (const key of PATH_PROPERTIES) {
    const value = props[key];
    if (typeof value === "string") props[key] = redactPath(value);
  }
}

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

  // Event properties: redact URLs and stamp the app tag.
  if (event.properties) {
    redactProperties(event.properties);
    event.properties.app = APP_NAME;
  }

  // Person properties ($set, $set_once) travel as sibling fields, not inside
  // `properties`. The deprecated sanitize_properties hook also ran on $set_once,
  // so redact both here — $set_once.$pathname carries the initial landing path
  // (e.g. a raw /vote/{token} for a first-time visitor) and would otherwise leak.
  if (event.$set) redactProperties(event.$set);
  if (event.$set_once) redactProperties(event.$set_once);

  return event;
}
