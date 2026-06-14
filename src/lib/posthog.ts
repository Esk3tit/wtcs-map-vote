/**
 * PostHog Analytics
 *
 * PostHog configuration consumed by the `PostHogProvider` (apiKey/options
 * pattern). The provider owns initialization and renders children regardless of
 * init state, so the app never blocks on PostHog. Operates as a no-op when
 * VITE_PUBLIC_POSTHOG_KEY is not configured.
 */

import type { PostHogConfig } from "posthog-js";

import { beforeSendEvent } from "./posthogRedaction";
import { initWebVitals } from "./vitals";

export const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as
  | string
  | undefined;

const POSTHOG_HOST =
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/**
 * PostHog options passed to `PostHogProvider`. The provider calls
 * `posthog.init()` with these on mount.
 */
export const posthogOptions: Partial<PostHogConfig> = {
  api_host: POSTHOG_HOST,

  // Modern baseline; explicit options below override it where set.
  defaults: "2025-05-24",

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

  // Strip player tokens from URL-bearing properties and stamp the app tag
  // on every event (including the deferred initial $pageview).
  before_send: beforeSendEvent,

  // Initialize Web Vitals once PostHog is ready (the app tag is handled in
  // before_send, not here — loaded fires after the remote-config round-trip).
  loaded: (ph) => {
    initWebVitals(ph);
  },

  // Debug logging in development only
  debug: import.meta.env.DEV,
};
