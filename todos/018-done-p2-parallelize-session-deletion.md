---
status: done
priority: p2
issue_id: "018"
tags: [code-review, performance, convex]
dependencies: []
---

# Parallelize Session Deletion for Better Performance

## Problem Statement

The `deleteUserSessions` function in `convex/admins.ts` uses sequential `await` in a loop to delete auth sessions. Each delete operation is awaited before the next begins, adding unnecessary latency.

**Why it matters:** For users with multiple sessions, this adds 10-20ms per session in sequential operations when they could be done in parallel.

## Findings

**Source:** performance-oracle agent

**Evidence from `/convex/admins.ts` (lines 29-43):**
```typescript
async function deleteUserSessions(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<number> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  for (const session of sessions) {
    await ctx.db.delete(session._id);  // Sequential awaits
  }

  return sessions.length;
}
```

**Current Performance:**
- 5 sessions = 5 sequential database operations (~50-100ms)
- 20 sessions = 20 sequential operations (~200-400ms)

**Potential Improvement:**
- Parallel deletion could reduce to ~20-30ms regardless of session count

## Proposed Solutions

### Option 1: Use Promise.all for parallel deletion (Recommended)

**Approach:** Delete all sessions concurrently

```typescript
async function deleteUserSessions(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<number> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  await Promise.all(sessions.map((session) => ctx.db.delete(session._id)));

  return sessions.length;
}
```

| Aspect | Assessment |
|--------|------------|
| Effort | Small |
| Risk | Low - need to verify Convex supports this |
| Pros | ~80% latency reduction |
| Cons | May hit concurrent write limits |

### Option 2: Keep sequential (if required by Convex)

**Approach:** Document the limitation

| Aspect | Assessment |
|--------|------------|
| Effort | None |
| Risk | None |
| Pros | Known to work |
| Cons | Slower performance |

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected Files:**
- `convex/admins.ts` - `deleteUserSessions` function

**Database Changes:** None

## Acceptance Criteria

- [x] Session deletion uses `Promise.all` for parallel operations
- [x] Verify Convex supports concurrent mutations in same transaction
- [x] Test with user having multiple sessions
- [x] Measure latency improvement

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-27 | Created during PR #44 review | Parallel operations reduce latency |
| 2026-01-27 | Implemented Promise.all for parallel session deletion | Convex supports concurrent mutations within same transaction; all 47 admins tests pass |

## Resources

- PR #44: https://github.com/Esk3tit/wtcs-map-vote/pull/44
- Convex transactions: https://docs.convex.dev/database/advanced/transactions
