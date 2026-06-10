---
date: 2026-06-10
topic: wtcs-favicon-parity
---

# WTCS Favicon Parity

## Summary

Replace Map Vote's default Vercel/Next-template favicon with the branded WTCS favicon set already shipping in the sister app `wtcs-community-polls`, so both apps present the same mark in browser tabs, bookmarks, and home-screen icons.

## Problem Frame

`wtcs-map-vote` still ships the boilerplate favicon from its starter template: `public/icon.svg` is the adaptive black/white "V" triangle, alongside `icon-dark-32x32.png`, `icon-light-32x32.png`, and `apple-icon.png`. The sister app `wtcs-community-polls` already carries a proper RealFaviconGenerator-produced WTCS favicon set. Two WTCS apps showing different (and one unbranded) tab icons reads as inconsistent and unfinished. The branded assets already exist next door, so this is reuse, not design.

## Requirements

**Favicon assets**

R1. Copy the sister repo's branded favicon set into `public/`: `favicon.svg`, `favicon-32.png`, `favicon.ico`, `apple-touch-icon.png`.

R2. Update the `index.html` `<head>` to reference the new set with the same `rel` / `type` / `sizes` attributes the sister app uses (SVG icon, 32×32 PNG icon, `.ico` fallback, 180×180 apple-touch-icon).

R3. Remove the superseded template icons from `public/` so no boilerplate assets remain: `icon.svg`, `icon-dark-32x32.png`, `icon-light-32x32.png`, `apple-icon.png`.

**App identity preserved**

R4. Keep Map Vote's own `<title>` ("WTCS Map Vote") and `<meta name="description">`. Parity covers iconography only, not page identity.

## Scope Boundaries

- Do **not** copy the polls app's `<title>` or `<meta name="description">` — those are app-specific.
- No web app manifest / PWA setup — neither app has one today; out of scope.
- `src/assets/wtcs-logo.png` is already byte-identical across both repos; leave it untouched.

## Success Criteria

- Both apps display the same WTCS mark in a browser tab and when bookmarked / added to a home screen.
- No starter-template icon files remain in `wtcs-map-vote/public/`.

## Sources / Research

- Current head: `index.html` references only `/icon.svg` and `/apple-icon.png`.
- A repo-wide grep confirms `icon-dark-32x32.png` and `icon-light-32x32.png` are referenced **nowhere** (orphaned), so deleting them per R3 is safe.
- Sister assets to reuse: `wtcs-community-polls/public/{favicon.svg,favicon-32.png,favicon.ico,apple-touch-icon.png}` and its `index.html` head markup as the reference for R2.
- Sister `favicon.svg` is a 1000×1000 RealFaviconGenerator output on a `#0a0a0a` background; Map Vote's current `icon.svg` is the 180×180 adaptive template triangle — confirming the two differ and the swap is real.
