---
status: complete
priority: p3
issue_id: "014"
tags: [code-review, architecture, error-handling, auto-start]
dependencies: []
---

# Isolate Auto-Start Failure from Ready Toggle Success

## Problem Statement

In `playerReady`, if `autoStartSession` throws (e.g., `guardStart` fails due to missing maps), the entire mutation fails — including the player's ready toggle. The player intended to toggle ready, which succeeded, but the auto-start side-effect failing rolls back everything.

## Findings

**Agent:** architecture-strategist

**Evidence:**
- `convex/playerAuth.ts:429-432` — `autoStartSession` called without try-catch
- If `guardStart` throws (e.g., no maps assigned), the mutation rolls back including the `readyAt` patch
- Player sees an error instead of "Ready" confirmation
- Convex mutations are transactional — any throw rolls back all writes

## Proposed Solutions

### Option A: Wrap autoStartSession in Try-Catch

```typescript
if (allAssigned && allReady && allConnected) {
  try {
    await autoStartSession(ctx, session);
    ev.set("autoStarted", true);
  } catch (err) {
    ev.set("autoStartFailed", true);
    ev.set("autoStartError", String(err));
    // Don't rethrow — player's ready toggle should succeed
  }
}
```

- **Pros:** Player's ready state is preserved even if auto-start fails, better UX
- **Cons:** In Convex, catching within a mutation still rolls back if the DB write in autoStartSession partially completed (Convex transactions are all-or-nothing at the mutation level). This approach may not actually work as expected.
- **Effort:** Small
- **Risk:** Medium (Convex transaction semantics may make this ineffective)

### Option B: Schedule Auto-Start as Separate Mutation

Instead of calling `autoStartSession` inline, schedule it as a separate internal mutation:

```typescript
if (allAssigned && allReady && allConnected) {
  await ctx.scheduler.runAfter(0, internal.sessions.tryAutoStart, {
    sessionId: session._id,
  });
}
```

- **Pros:** Truly isolates auto-start failure from ready toggle, auto-start retries independently
- **Cons:** Adds latency (separate mutation), more complex flow, needs new internal mutation
- **Effort:** Medium
- **Risk:** Low

### Option C: Keep Current Behavior

Current `autoStartSession` already has defensive checks (re-reads session, validates state). Failures should be rare.

- **Pros:** Simple, transactional consistency
- **Cons:** Rare edge case where ready toggle fails due to auto-start error
- **Effort:** None
- **Risk:** Low (failures are rare in practice)

## Recommended Action

_To be decided during triage._

## Acceptance Criteria

- [ ] Player's ready toggle succeeds even if auto-start fails
- [ ] Auto-start failure is logged/observed
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from code review of PR #98 | Convex transaction semantics mean try-catch within mutations may not isolate writes |
| 2026-03-03 | Approved during triage — batch approved | Ready to work on |

## Resources

- PR #98: https://github.com/Esk3tit/wtcs-map-vote/pull/98
- `convex/playerAuth.ts:429-432` — auto-start call site
- `convex/sessions.ts` — `autoStartSession` implementation
