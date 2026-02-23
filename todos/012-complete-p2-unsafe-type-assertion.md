---
status: complete
priority: p2
issue_id: "012"
tags: [code-review, type-safety, typescript]
dependencies: ["011"]
---

# Unsafe `as` Type Assertion on auth.status for DisconnectedOverlay

## Problem Statement

Both route files use `auth.status as "reconnecting" | "disconnected"` when passing props to `DisconnectedOverlay`. This bypasses TypeScript's type narrowing and could silently pass an invalid status value if the guard logic changes.

## Findings

- **Source:** pattern-recognition-specialist, kieran-typescript-reviewer
- **Location:** `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx` — DisconnectedOverlay render blocks
- **Evidence:** `status={auth.status as "reconnecting" | "disconnected"}`

## Proposed Solutions

### Option 1: Fix via #011 (Recommended)
If #011 is implemented (derived properties on hook), the `isDisconnected` boolean and properly-typed `disconnectedStatus` can be provided directly, eliminating the assertion entirely.

- **Pros**: Cleanest solution; fixes root cause
- **Cons**: Depends on #011
- **Effort**: None (covered by #011)
- **Risk**: Low

### Option 2: Inline Type Narrowing
Replace the `as` assertion with explicit narrowing:
```tsx
{auth.status === "reconnecting" && <DisconnectedOverlay status="reconnecting" ... />}
{auth.status === "disconnected" && <DisconnectedOverlay status="disconnected" ... />}
```

- **Pros**: Type-safe; no dependency
- **Cons**: Duplicated JSX for the overlay
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Fix via #011. If #011 is deferred, use Option 2.

## Technical Details
- **Affected Files**: `src/routes/lobby.$token.tsx`, `src/routes/vote.$token.tsx`

## Acceptance Criteria
- [x] No `as` type assertions for auth.status in route files
- [x] TypeScript correctly narrows the status type for DisconnectedOverlay

## Work Log

### 2026-02-22 - Identified during code review
**By:** pattern-recognition-specialist, kieran-typescript-reviewer

## Resources
- PR #77: WAR-57 Player Reconnection Flow
