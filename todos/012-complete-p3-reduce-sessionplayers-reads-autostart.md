---
status: complete
priority: p3
issue_id: "012"
tags: [code-review, performance, auto-start]
dependencies: []
---

# Reduce Triple sessionPlayers Read in Auto-Start Path

## Problem Statement

When a player readies up and triggers auto-start, the `sessionPlayers` table is read 3 times in the same transaction:

1. `lookupAndValidatePlayer` (token lookup)
2. `playerReady` handler (query all players for `allReady`/`allConnected` check)
3. `autoStartSession` (re-query all players for invariant validation + `guardStart`)

While Convex transactions are serialized and reads are cheap within a transaction, this is more reads than necessary.

## Findings

**Agent:** performance-oracle

**Evidence:**
- `playerAuth.ts:417-420` — `ctx.db.query("sessionPlayers").withIndex("by_sessionId").collect()`
- `sessions.ts` `autoStartSession` — same query repeated for re-validation
- `guardStart` also reads sessionPlayers internally
- All within a single Convex mutation (serialized, consistent reads)

## Proposed Solutions

### Option A: Pass allPlayers Array to autoStartSession

Modify `autoStartSession` to accept the already-fetched players array:

```typescript
export async function autoStartSession(
  ctx: MutationCtx,
  session: Doc<"sessions">,
  allPlayers: Doc<"sessionPlayers">[]
): Promise<void> { ... }
```

- **Pros:** Eliminates 1 redundant read, simpler data flow
- **Cons:** Slightly less defensive (data could be stale if something mutated between lines, though impossible within single mutation)
- **Effort:** Small
- **Risk:** Low

### Option B: Keep Defensive Re-Reads

Current approach is intentionally defensive — `autoStartSession` re-validates all invariants independently.

- **Pros:** Each function is self-contained, no coupling to caller's data
- **Cons:** Extra reads (minor cost within Convex transaction)
- **Effort:** None
- **Risk:** None

## Recommended Action

_To be decided during triage._

## Acceptance Criteria

- [ ] `autoStartSession` accepts pre-fetched players (if Option A)
- [ ] No change in behavior or correctness
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-03 | Created from code review of PR #98 | Convex transactions make redundant reads cheap but unnecessary |
| 2026-03-03 | Approved during triage — batch approved | Ready to work on |
| 2026-03-03 | Superseded by #014 (scheduler approach) | Scheduled mutation must re-read anyway, making this optimization moot |

## Resources

- PR #98: https://github.com/Esk3tit/wtcs-map-vote/pull/98
- `convex/playerAuth.ts:417-420` — first allPlayers read
- `convex/sessions.ts` — `autoStartSession` second read
