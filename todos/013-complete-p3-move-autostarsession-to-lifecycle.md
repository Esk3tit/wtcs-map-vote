---
status: complete
priority: p3
issue_id: "013"
tags: [code-review, architecture, auto-start]
dependencies: []
---

# Move autoStartSession to lib/sessionLifecycle.ts

## Problem Statement

`autoStartSession` is exported from `convex/sessions.ts` and imported by `convex/playerAuth.ts`. This creates a new module coupling: playerAuth → sessions. The session lifecycle helpers (`validateTransition`, `guardStart`, `transitionSession`) already live in `convex/lib/sessionLifecycle.ts`.

## Findings

**Agent:** architecture-strategist

**Evidence:**
- `convex/playerAuth.ts:19` — `import { autoStartSession } from "./sessions"`
- `convex/lib/sessionLifecycle.ts` — existing home for session state machine helpers
- `autoStartSession` uses `validateTransition`, `guardStart`, `transitionSession` — all from sessionLifecycle.ts
- Moving it would make playerAuth depend on `lib/sessionLifecycle` (utility) instead of `sessions` (mutation module)

## Proposed Solutions

### Option A: Move to lib/sessionLifecycle.ts

Move `autoStartSession` to `convex/lib/sessionLifecycle.ts` alongside the other helpers it depends on.

- **Pros:** Cleaner dependency graph (utility → utility instead of module → module), co-locates related lifecycle logic
- **Cons:** `sessionLifecycle.ts` grows slightly, `scheduleTimerExpiry` may also need moving or importing
- **Effort:** Small
- **Risk:** Low

### Option B: Keep in sessions.ts

Current location is fine — `autoStartSession` is closely related to `startSession` mutation.

- **Pros:** No churn, co-located with similar logic
- **Cons:** playerAuth depends on sessions module directly
- **Effort:** None
- **Risk:** None

## Recommended Action

_To be decided during triage._

## Acceptance Criteria

- [ ] `autoStartSession` moved to `convex/lib/sessionLifecycle.ts`
- [ ] Import updated in `convex/playerAuth.ts`
- [ ] No circular dependencies introduced
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from code review of PR #98 | architecture-strategist flagged new playerAuth → sessions coupling |
| 2026-03-03 | Approved during triage — batch approved | Ready to work on |
| 2026-03-03 | Superseded by #014 (scheduler approach) | Scheduler uses internal.sessions.tryAutoStart — no direct import coupling |

## Resources

- PR #98: https://github.com/Esk3tit/wtcs-map-vote/pull/98
- `convex/sessions.ts` — current location of `autoStartSession`
- `convex/lib/sessionLifecycle.ts` — proposed destination
