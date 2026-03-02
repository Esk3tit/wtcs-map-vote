---
status: complete
priority: p1
issue_id: "074"
tags: [code-review, sentry, architecture]
dependencies: ["073"]
---

# Eliminate triple-reporting of errors through boundary hierarchy

## Problem Statement
When a player route throws, the same error is captured up to 3 times:
1. Per-route `errorComponent` calls `Sentry.captureException` (during render)
2. React 19 `onCaughtError` hook fires `Sentry.reactErrorHandler()` because an error boundary caught it
3. If error propagates, `Sentry.ErrorBoundary` in `__root.tsx` captures it again

Sentry's `Dedupe` integration may catch some but not all of these, especially with timing jitter.

## Findings
- Flagged by: julik-frontend-races-reviewer, code-simplicity-reviewer, architecture-strategist
- The `onCaughtError` hook fires for ALL errors caught by ANY error boundary
- Per-route explicit capture + onCaughtError = minimum 2 events per error
- Free tier budget (5k/month) at risk

## Proposed Solutions

### Option 1: Single-responsibility model — remove explicit captureException from all errorComponents
- **Pros**: Clean separation — boundaries render UI, hooks/ErrorBoundary capture
- **Cons**: Need to verify onCaughtError reliably captures route-level errors
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1 — this is largely resolved by fixing #073. After removing captureException from per-route components, also consider whether the `ErrorCapture` useEffect in `router.ts` is still needed (since `onCaughtError` already captures).

## Technical Details
- **Affected Files**: `src/routes/vote.$token.tsx`, `src/routes/lobby.$token.tsx`, `src/routes/results.$sessionId.tsx`, `src/router.ts`
- **Related Components**: ErrorCapture, Sentry.ErrorBoundary, createRoot hooks
- **Database Changes**: No

## Acceptance Criteria
- [x] Each error produces exactly 1 Sentry event (verify with DSN enabled)
- [x] No explicit `captureException` in errorComponent render bodies
- [x] Error capture still works end-to-end

## Work Log

### 2026-03-01 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Depends on #073 being resolved first

## Notes
Source: PR #94 code review
