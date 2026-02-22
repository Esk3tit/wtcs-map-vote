---
status: complete
priority: p2
issue_id: "013"
tags: [code-review, ux, frontend]
dependencies: []
---

# Full-Page Flash on Manual Retry — Convex Subscription Drops During Loading

## Problem Statement

When the user clicks "Retry Connection" (manual retry), `auth.status` transitions to `"loading"`. The Convex subscription gate skips the query during `"loading"`, so `data` becomes `undefined`. This triggers the loading spinner early return, causing a visible flash where the page content disappears and reappears.

The page content was previously visible (under the disconnect overlay), so this flash is jarring.

## Findings

- **Source:** julik-frontend-races-reviewer
- **Location:** `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx` — subscription gate and `data === undefined` early return
- **Evidence:** During manual retry: `disconnected` → `loading` (query skipped, data = undefined) → spinner → `authenticated` (query resumes) → content reappears

## Proposed Solutions

### Option 1: hasEverAuthed Ref (Recommended)
Add a `hasEverAuthed` ref that stays true once the user has been authenticated. Include it in the subscription gate:
```typescript
const hasEverAuthedRef = useRef(false);
if (auth.status === "authenticated") hasEverAuthedRef.current = true;

const data = useQuery(
  api.sessions.getSessionByToken,
  auth.status === "authenticated" || auth.status === "reconnecting" || auth.status === "disconnected" || hasEverAuthedRef.current
    ? { token }
    : "skip"
);
```

- **Pros**: Keeps subscription alive during retry; no flash; simple
- **Cons**: Convex query runs during loading (acceptable — it's readonly)
- **Effort**: Small
- **Risk**: Low

### Option 2: Keep Previous Data During Loading
Use a `useRef` to cache the last valid `data` value and display it during loading.

- **Pros**: Works even if subscription truly needs to be skipped
- **Cons**: More complex; stale data display
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
Option 1 — `hasEverAuthed` ref. Simplest fix with no downside.

## Technical Details
- **Affected Files**: `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx` (or `src/hooks/usePlayerAuth.ts` if added as derived property)

## Acceptance Criteria
- [ ] Manual retry does not cause page content to disappear and reappear
- [ ] Convex subscription stays active during the loading→authenticated transition
- [ ] Loading spinner only shown on initial page load (never authenticated before)

## Work Log

### 2026-02-22 - Identified during code review
**By:** julik-frontend-races-reviewer

## Resources
- PR #77: WAR-57 Player Reconnection Flow
