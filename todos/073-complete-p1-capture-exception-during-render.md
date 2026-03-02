---
status: complete
priority: p1
issue_id: "073"
tags: [code-review, sentry, performance, bug]
dependencies: []
---

# Remove Sentry.captureException from render body in player route errorComponents

## Problem Statement
Three per-route `errorComponent` callbacks call `Sentry.captureException(error)` directly in the render body (not in a `useEffect`). Every React re-render sends a duplicate Sentry event. On the free tier (5k errors/month), a single sustained error could exhaust the budget.

This is inconsistent with `router.ts` which correctly uses `useEffect([error])`.

## Findings
- Location: `src/routes/vote.$token.tsx:49`, `src/routes/lobby.$token.tsx:30`, `src/routes/results.$sessionId.tsx:30`
- All 8 review agents flagged this unanimously
- React StrictMode in dev fires render twice per mount, doubling the issue
- Parent re-renders (auth heartbeat, overlay status, context changes) cause additional duplicates

## Proposed Solutions

### Option 1: Remove captureException entirely from per-route errorComponents
- **Pros**: Simplest fix; `onCaughtError` hook and `Sentry.ErrorBoundary` already capture these errors
- **Cons**: Slightly less explicit about where capture happens
- **Effort**: Small
- **Risk**: Low — error capture is already handled by other layers

### Option 2: Extract shared PlayerErrorCapture component with useEffect
- **Pros**: Explicit capture with deduplication, matches router.ts pattern
- **Cons**: Adds a component; may still double-report with `onCaughtError`
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — remove the explicit `captureException` calls. The `onCaughtError` hook and `Sentry.ErrorBoundary` already guarantee capture. Per-route components should only render UI.

## Technical Details
- **Affected Files**: `src/routes/vote.$token.tsx`, `src/routes/lobby.$token.tsx`, `src/routes/results.$sessionId.tsx`
- **Related Components**: PlayerErrorFallback, Sentry.ErrorBoundary
- **Database Changes**: No

## Acceptance Criteria
- [ ] No `Sentry.captureException` calls in render bodies of per-route errorComponents
- [ ] Errors in player routes are still captured by Sentry (via onCaughtError or ErrorBoundary)
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes

## Work Log

### 2026-03-01 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status set to ready

## Notes
Source: PR #94 code review — flagged by all 8 review agents
