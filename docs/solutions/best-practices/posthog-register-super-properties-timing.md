---
title: PostHog Super-Property Timing — Register Synchronously After init()
date: 2026-06-13
category: docs/solutions/best-practices
module: src/lib/posthog.ts (PostHog analytics init)
problem_type: best_practice
component: tooling
severity: medium
applies_when:
  - "Calling posthog.register() to stamp a super property (e.g. app, env, version) on every event"
  - "Sharing one PostHog project across multiple apps and filtering events per-app"
  - "A reviewer (human or bot) recommends moving register() into the loaded callback"
  - "posthog.init() runs once at app startup, not inside a React component"
tags: [posthog, analytics, super-properties, async-timing, pageview, integration, multi-app]
related_components:
  - "src/lib/posthog.ts"
---

# PostHog Super-Property Timing — Register Synchronously After init()

## Context

`wtcs-map-vote` and its sister app `wtcs-community-polls` share a single PostHog
project (one project is cheaper than two). To filter events per app, every event
is stamped with an `app` super property — `app: "map-vote-ban"` here,
`app: "community-polls"` next door — via `posthog.register()`.

The question that surfaced in code review: **where in the init sequence should
`register()` be called?** An automated reviewer (gemini-code-assist) flagged the
synchronous-after-`init()` placement as a "high" risk and recommended two changes
— move `register()` into the `loaded` callback to avoid an "initial-pageview
race", and add `persistence_name` to avoid a "localStorage collision". Both were
investigated against the posthog-js source and **declined as incorrect**. This
documents why, so the same plausible-but-wrong suggestion isn't re-applied.

## Guidance

Call `posthog.register()` **synchronously, immediately after `posthog.init()`**,
inside the same no-op guard block:

```ts
// src/lib/posthog.ts
if (!POSTHOG_KEY) return null;

posthog.init(POSTHOG_KEY, { /* …config… */ });

// Super property is set at T=0, before the deferred initial pageview.
posthog.register({ app: "map-vote-ban" });
```

Do **not** move it into the `loaded` callback. Do **not** add `persistence_name`
unless the apps are served from the exact same origin (they aren't — separate
Netlify deployments have different origins).

## Why This Matters

Verified against the bundled SDK (`node_modules/posthog-js/dist/module.js`, `LIB_VERSION` `1.357.1`). The minified helper names below (`lr`, `rr`) are build-specific — the durable claim is the behavior, not the symbol names:

1. `posthog.init(...)` returns synchronously at **T=0**.
2. The initial pageview is scheduled as a **macrotask**: `setTimeout(() => this.lr(), 1)`,
   where `lr()` is `this.capture("$pageview", …, { send_instantly: true })`. It
   fires at roughly **T≈1ms**.
3. The `loaded` callback (`config.loaded`, invoked via the internal post-bootstrap
   handler `rr()`) runs only after the remote-config (`/flags`) **network round-trip**
   returns — **well after T≈1ms**.

Super properties are merged into event properties **at capture time**, not at
registration time. Therefore:

- **Synchronous `register()` at T=0** → `app` is already set when the initial
  pageview is captured at ~T≈1ms. The tag is present on every event including the
  first pageview. ✅
- **`register()` inside `loaded`** → `app` is set only after the network
  round-trip, which lands *after* the initial pageview is captured → the first
  pageview **drops the tag**. The "race" the reviewer warned about is *created*,
  not prevented, by their suggested fix. ❌

On the `persistence_name` concern: PostHog's default localStorage key is
`ph_<project_api_key>_posthog`. localStorage is partitioned by **origin**
(scheme + host + port); subdomains do **not** share it, only identical origins do.
Two apps on separate Netlify deployments have separate origins → separate
localStorage namespaces → no key collision. Adding `persistence_name` would also
reset existing users' anonymous `distinct_id`s (an analytics discontinuity) for
zero benefit here.

The broader lesson: a "high-priority" review flag on third-party-library timing
is a claim to verify against the library's source, not to accept or reject on
plausibility. Reading the bundle settled it in minutes and revealed the proposed
fix was a regression.

## When to Apply

- You share one PostHog project across multiple apps and need per-app filtering.
- You want a super property stamped on every event including the very first pageview.
- The apps are on **different origins** — the normal case for separate deployments.

Reach for `persistence_name` **only** if two apps that share a PostHog project key
are deployed to the **same origin** (rare in practice).

## Examples

**Correct — synchronous register after init:**

```ts
posthog.init(POSTHOG_KEY, {
  api_host: POSTHOG_HOST,
  capture_pageview: "history_change", // enables the initial pageview; the SDK defers it via setTimeout(…,1) regardless of this value
});
// Registered at T=0 — before that deferred pageview is captured (~T=1ms).
posthog.register({ app: "map-vote-ban" });
```

**Incorrect — register inside the loaded callback:**

```ts
// WRONG: `loaded` fires after the /flags network round-trip.
posthog.init(POSTHOG_KEY, {
  api_host: POSTHOG_HOST,
  loaded: (ph) => {
    ph.register({ app: "map-vote-ban" }); // too late — initial pageview already captured
  },
});
```

**Verification method** (reproducible against the bundled SDK; symbol names are build-specific — re-locate them by behavior after an SDK upgrade):

1. Open `node_modules/posthog-js/dist/module.js`.
2. Search for `send_instantly` / `lr(` → find `this.config.capture_pageview && setTimeout(() => … this.lr(), 1)`. This proves the initial pageview is deferred one macrotask past synchronous code.
3. Search for `config.loaded` / `rr(` → confirm `loaded` runs from the remote-config response handler (a network round-trip), i.e. later than the deferred pageview.

## Related

- `docs/solutions/conventions/favicon-parity-across-sister-apps.md` — the other
  documented `wtcs-map-vote` ↔ `wtcs-community-polls` parity convention. Shares the
  "keep sister apps in sync" framing; no technical overlap. Note that for *this*
  learning, parity is a side effect — the correct placement is dictated by
  posthog-js timing, not by matching the sister app.
- PR #107 (`feat/analytics: tag PostHog events with app identifier`) — where the
  review discussion and source verification happened.
