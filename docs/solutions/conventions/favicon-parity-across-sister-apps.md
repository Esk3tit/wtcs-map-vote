---
title: Favicon Parity Across Sister Vite Apps
date: 2026-06-12
category: docs/solutions/conventions
module: branding / static assets (index.html, public/)
problem_type: convention
component: tooling
severity: low
applies_when:
  - Adding or replacing a favicon in a Vite app
  - Giving related apps (e.g. wtcs-map-vote and wtcs-community-polls) a consistent brand mark
  - Onboarding a new sibling app that should share the WTCS identity
tags: [favicon, vite, branding, static-assets, public-dir, cross-repo, index-html]
---

# Favicon Parity Across Sister Vite Apps

## Context

`wtcs-map-vote` still shipped the starter-template favicon (the adaptive black/white "V" from the Vite/Next scaffold) while its sister app `wtcs-community-polls` already used a branded WTCS mark. Two related apps showing different tab icons — one of them unbranded — reads as unfinished. The branded, RealFaviconGenerator-produced set already existed next door, so this is asset *reuse*, not design.

## Guidance

Reuse the sister app's generated favicon set rather than regenerating one (avoids drift at the point of copy):

```bash
cp ../wtcs-community-polls/public/{favicon.svg,favicon-32.png,favicon.ico,apple-touch-icon.png} public/
```

Reference the full modern set in `index.html`'s `<head>`, mirroring the sister app:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

Key points:

- **`sizes="any"` on the `.ico`** marks it as a multi-size legacy fallback, so modern browsers prefer the scalable `favicon.svg` and skip the redundant `favicon.ico` download in Chrome. This is the one deviation worth making even from the parity source if the source omits it (then backport it there).
- **Keep each app's own `<title>` and `<meta name="description">`.** Parity is iconography only — copying the sister's page title/description would be wrong; the apps have different identities.
- **Remove the starter-template icons** (`icon.svg`, `icon-*-32x32.png`, `apple-icon.png`) so no boilerplate remains, and `grep` the repo first to confirm nothing else references them.

## Why This Matters

Consistent branding across related apps reads as professional and deliberate. The `sizes="any"` trick is a real micro-optimization (no redundant `.ico` fetch) recommended by modern favicon guidance. Reusing the sister app's already-generated set avoids re-running a favicon generator and producing a subtly different mark.

## When to Apply

- Any new or replacement favicon in `wtcs-map-vote` or `wtcs-community-polls`.
- Standing up a new sibling app that should carry the WTCS identity — copy the same four files and the same `<head>` block.

## Examples

Before (starter template):

```html
<link rel="icon" type="image/svg+xml" href="/icon.svg" />
<link rel="apple-touch-icon" href="/apple-icon.png" />
```

After: the four-link block above.

Gotchas observed:

- Vite serves `public/` verbatim at the site root, **unhashed**, and `bun run build` / `typecheck` does **not** validate that a `<link href>` resolves to a real file. Confirm each path manually, or browser-test the rendered tab icon (the favicon is a visual change — worth a quick `/dev-browser` check).
- The reused `favicon-32.png` is intrinsically 96×96 despite the `sizes="32x32"` hint — inherited verbatim from the sister app, cosmetic only (browsers scale by actual pixels). Don't "fix" the hint unless you also change it in the sister app, or you break the markup parity.
- Cross-repo reuse has **no automated sync** — if one app regenerates its favicon, the other drifts silently. Re-copy deliberately.

## Related

- The sister app's `<head>` omits `sizes="any"` on its `.ico`; backporting it there restores exact markup parity.
