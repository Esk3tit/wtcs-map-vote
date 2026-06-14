/**
 * Sentry Instrumentation Entry
 *
 * Imported first in main.tsx so Sentry initializes as early as possible —
 * before the rest of the app's modules evaluate. Sentry.init() performs no
 * network I/O at init time; events are sent later on a non-blocking background
 * queue, so initializing synchronously here does not delay render.
 */

import { router } from "@/router";
import { initSentry } from "@/lib/sentry";

try {
  initSentry(router);
} catch {
  // Sentry unavailable — app continues without error tracking
}
