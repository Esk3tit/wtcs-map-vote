---
status: complete
priority: p3
issue_id: "016"
tags: [code-review, patterns, duplication, auto-start]
dependencies: ["013"]
---

# Deduplicate startSession and autoStartSession Logic

## Problem Statement

`startSession` (admin mutation) and `autoStartSession` (helper) share ~25 lines of identical logic: validate transition, guard start, transition session, clear readyAt, schedule timer expiry. This duplication means changes to session start logic must be made in two places.

## Findings

**Agent:** pattern-recognition-specialist

**Evidence:**
- `convex/sessions.ts` `startSession` mutation — transition + patches + timer scheduling
- `convex/sessions.ts` `autoStartSession` function — same transition + patches + timer scheduling
- Both call `validateTransition`, `guardStart`, `transitionSession`, `scheduleTimerExpiry`
- Both clear `readyAt` on all players after starting

## Proposed Solutions

### Option A: Extract Shared Start Logic

Create a private `performSessionStart` helper that both `startSession` and `autoStartSession` call:

```typescript
async function performSessionStart(
  ctx: MutationCtx,
  session: Doc<"sessions">,
  actorType: "ADMIN" | "SYSTEM",
  actorId?: Id<"admins">,
  auditDetails?: Record<string, string>,
): Promise<void> {
  validateTransition(session.status, "IN_PROGRESS");
  await guardStart(ctx, session);
  const now = Date.now();
  await transitionSession(ctx, session, "IN_PROGRESS", { ... });
  // clear readyAt, schedule timer
}
```

- **Pros:** Single source of truth for start logic, changes apply to both paths
- **Cons:** Slightly more abstraction
- **Effort:** Small-Medium
- **Risk:** Low

### Option B: Keep Separate Implementations

Both functions are short and serve different contexts (admin vs system). Duplication is manageable.

- **Pros:** No indirection, each path is self-documenting
- **Cons:** Must remember to update both when start logic changes
- **Effort:** None
- **Risk:** Low (drift risk is small)

## Recommended Action

_To be decided during triage._

## Technical Details

**Depends on:** #013 (if autoStartSession moves to sessionLifecycle.ts, extract shared logic there)

## Acceptance Criteria

- [ ] Shared start helper extracted (if Option A)
- [ ] Both `startSession` and `autoStartSession` use shared helper
- [ ] No behavior change
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from code review of PR #98 | ~25 lines duplicated across two start paths |
| 2026-03-03 | Approved during triage — batch approved | Ready to work on |

## Resources

- PR #98: https://github.com/Esk3tit/wtcs-map-vote/pull/98
- `convex/sessions.ts` — both `startSession` and `autoStartSession`
