---
title: "Don't Defer Analytics SDK Init to Work Around Geo-Blocking"
date: 2026-06-14
category: docs/solutions/best-practices
module: "src/main.tsx (analytics & error SDK init)"
problem_type: best_practice
component: tooling
severity: medium
root_cause: async_timing
applies_when:
  - "Initializing PostHog, Sentry, or any analytics/error SDK in a client-side app"
  - "Tempted to defer, gate, or reorder an SDK init() call for render performance"
  - "Diagnosing slow page render blamed on a third-party analytics or monitoring script"
  - "Mitigating analytics/error reporting for users in a geo-blocked region (e.g. Russia)"
  - "Designing a workaround based on an assumption about a library's network or timing behavior"
tags: [posthog, sentry, web-vitals, analytics, async-timing, geo-blocking, initialization, third-party-libraries]
related_components:
  - "src/lib/posthog.ts"
  - "src/lib/sentry.ts"
  - "src/lib/vitals.ts"
---

# Don't Defer Analytics SDK Init to Work Around Geo-Blocking

## Context

A geo-block "fix" was added to `src/main.tsx` (commit `ab1016e`) on a plausible-but-wrong root cause. The premise: synchronous `Sentry.init()` / `posthog.init()` make blocking network requests that hang page render for 30-60s for users in Russia (where `sentry.io` / `us.i.posthog.com` are blocked), forcing them to use a VPN. The "fix" deferred PostHog + Web Vitals init behind `setTimeout(0)` *after* `render()`.

The premise was never verified against the SDK docs or source, and it is wrong on every load-bearing claim. The workaround neither fixed the blocked region (users still needed a VPN) nor left the rest of the system intact (it dropped early events for everyone else). Sentry's portion was partially reverted in `f07def1`; a full revert plus modernization is planned in `docs/plans/2026-06-14-001-refactor-analytics-init-modernization-plan.md`.

## Guidance

**(a) Concrete — initialize analytics/error SDKs the standard, documented way; do not defer to dodge geo-blocking.** The init calls do not block render:

- `Sentry.init()` performs **no network I/O at init time**. Events are sent later on a non-blocking background queue.
- `posthog.init()` returns **synchronously**; all of its network activity is async and batched. It even schedules its own initial `$pageview` as a macrotask via `setTimeout(..., 1)`.
- JS `fetch`/XHR are asynchronous. A blocked or black-holed host yields a *pending background request that eventually fails* — it does **not** freeze the main thread or block rendering. A `setTimeout(0)` wrapper around init therefore changes essentially nothing about render-blocking.

Initialize each SDK canonically: Sentry as early as possible (a first-imported `instrument.ts`), PostHog at startup via `PostHogProvider` (the provider renders children regardless of init state, so the app never waits on it).

For a genuinely geo-blocked region, use the **documented mitigation**, not a timing hack: a PostHog reverse proxy (e.g. a Netlify rewrite) or the Sentry `tunnel` option, routing events through your own domain. Caveat to record next to it: this only helps if *your* domain is reachable from the blocked region — if it isn't, no client-side change fixes it and users still need a VPN.

**(b) Meta — verify third-party-library timing/network claims against source before designing around them.**

> A plausible-sounding claim about a third-party library's timing or network behavior is a claim to **verify against the library's docs or source**, not to accept on plausibility.

Reading the Sentry/PostHog docs is exactly what disproved the render-blocking premise. The same principle has bitten this repo from the opposite direction — see Related.

## Why This Matters

The wrong fix was worse than doing nothing:

- **It did not help the target region.** The SDK hosts were still unreachable; users still needed a VPN. It addressed a render-blocking problem that never existed.
- **It degraded coverage for everyone else.** Wrapping init in `setTimeout(0)` dropped or delayed early analytics events and early error reports for *all* users — exactly the initial-load window where startup errors and first-touch funnel data matter most.
- **It left misleading artifacts.** Code comments asserting the deferral "prevents synchronous network requests from blocking React rendering" encode a false mental model the next engineer inherits and may extend.
- **Net: wasted effort plus a regression**, requiring a partial revert and a planned full revert + modernization to undo.

## When to Apply

- You're about to add a workaround justified by a claim about a third-party library's startup timing, network, or blocking behavior — verify the claim against docs/source first.
- You're initializing Sentry, PostHog, or any analytics/error SDK and are tempted to defer, gate, or reorder init for performance or geo reasons.
- You're addressing regional reachability for a third-party service — reach for the documented proxy/tunnel mitigation, and confirm your own domain is reachable from the region before assuming it helps.
- Code review: a diff defers/reorders SDK init "to avoid blocking render", or a comment makes an unverified timing/network assertion.

## Examples

**Anti-pattern** (what was in `src/main.tsx`, simplified) — deferring init on a false premise:

```ts
// WRONG: defer init to "avoid blocking render" for geo-blocked regions.
// Premise is false: init does no blocking I/O; a blocked host just produces
// a pending background request that fails later. This drops early events for
// everyone and does nothing for the blocked region.
createRoot(el).render(<App />);
setTimeout(() => {
  initPostHog();
  initWebVitals();
}, 0);
```

**Correct pattern** — init the documented way; mitigate geo-blocking with a proxy/tunnel through your own domain:

```ts
// instrument.ts — imported FIRST in the entry file, before the app renders.
// Sentry.init() does no network I/O at init; events go out on a background queue.
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Geo mitigation via your own reachable domain (not a timing hack):
  tunnel: "/api/sentry-tunnel",
});
```

```tsx
// main.tsx — PostHog via the provider; it renders children regardless of
// init state, so the app never waits on PostHog.
import "./instrument";
import { PostHogProvider } from "@posthog/react";

createRoot(el).render(
  <PostHogProvider
    apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
    options={{ api_host: "/ingest" /* reverse proxy through your own domain */ }}
  >
    <App />
  </PostHogProvider>
);
```

**Caveat on a constant super-property (e.g. `app`) and the `loaded` callback:** do **not** reach for `loaded` to register a super-property you need on the initial `$pageview`. `loaded` fires after the `/flags` network round-trip — *later* than the macrotask-deferred initial pageview — so it would drop the tag on that first event. Register synchronously after `init()`, or set the property in `before_send` (timing-independent). See Related.

## Related

- `docs/solutions/best-practices/posthog-register-super-properties-timing.md` — the companion timing doc. Both share the meta-principle of verifying library timing/network behavior against source. That doc proves the initial pageview is a deferred macrotask (`setTimeout(…, 1)`) and that `loaded` fires after the network round-trip; this doc proves init does no blocking network I/O. Together: init is non-blocking, the initial pageview is deferred ~1ms, and `loaded` is later still.
- `docs/plans/2026-06-14-001-refactor-analytics-init-modernization-plan.md` — the planned revert + standard-init modernization.
- Commit history: `ab1016e` (introduced the deferral), `f07def1` (reverted the Sentry half to synchronous init).
