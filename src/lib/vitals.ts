/**
 * Web Vitals
 *
 * Reports Core Web Vitals (CLS, INP, LCP, FCP, TTFB) to PostHog
 * and console (dev only). No-op if PostHog is not configured.
 */

import type { Metric } from "web-vitals";
import type posthog from "posthog-js";

type PostHogClient = typeof posthog;

/** Send a Web Vital metric to PostHog as a custom event. */
function reportToPostHog(client: PostHogClient, metric: Metric) {
  client.capture("web_vital", {
    vital_name: metric.name,
    vital_value: metric.value,
    vital_rating: metric.rating,
    vital_delta: metric.delta,
    vital_id: metric.id,
    vital_navigationType: metric.navigationType,
  });
}

/** Log a Web Vital metric to the console (dev only). */
function reportToConsole(metric: Metric) {
  console.log(
    `[Web Vital] ${metric.name}: ${metric.value} (${metric.rating})`
  );
}

/**
 * Initialize Web Vitals reporting.
 *
 * @param posthogClient - PostHog instance (null if not configured)
 */
export function initWebVitals(posthogClient: PostHogClient | null) {
  import("web-vitals").then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
    const report = (metric: Metric) => {
      if (import.meta.env.DEV) reportToConsole(metric);
      if (posthogClient) reportToPostHog(posthogClient, metric);
    };

    onCLS(report);
    onINP(report);
    onLCP(report);
    onFCP(report);
    onTTFB(report);
  });
}
