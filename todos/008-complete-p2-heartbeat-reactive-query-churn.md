---
status: complete
priority: p2
issue_id: "008"
tags: [code-review, performance]
dependencies: []
---

# Heartbeat Mutations Trigger Unnecessary Reactive Query Re-computation

## Problem Statement

Every 30-second heartbeat patches `lastHeartbeat` and `isConnected` on `sessionPlayers` documents. The `getSessionByToken` reactive query reads from the same table. In Convex, any mutation modifying a document in a table a query reads from invalidates and re-executes that query. With N players, the query re-fires N times per 30 seconds per connected client. Additionally, heartbeats write unconditionally even when nothing meaningful changed.

## Findings

- **Source agents:** performance-oracle
- **File:** `convex/playerAuth.ts` lines 200-204
- **Current impact:** 2-player session = 4 re-executions/min per client. 8-player = 16/min.
- **Each re-execution:** 3+ database reads (player by token, session by ID, all players + maps)

## Proposed Solutions

### Solution A: Guard heartbeat writes with staleness check (Recommended)
```typescript
const HEARTBEAT_SKIP_MS = 15_000;
if (player.isConnected && player.lastHeartbeat && now - player.lastHeartbeat < HEARTBEAT_SKIP_MS) {
  return { status: "ok" as const };
}
```
- **Effort:** Small | **Risk:** None (2-min disconnect threshold still works with 15s resolution)

### Solution B: Separate heartbeat data into its own table
Move `lastHeartbeat` and `isConnected` to a `playerHeartbeats` table so mutations don't invalidate `sessionPlayers`-dependent queries.
- **Effort:** High (schema migration) | **Risk:** Low

### Solution C: Add visibility-state awareness to frontend
Stop heartbeats when browser tab is hidden; resume when visible.
- **Effort:** Medium | **Risk:** Low

## Technical Details

- **Affected files:** `convex/playerAuth.ts`, `src/hooks/usePlayerAuth.ts`

## Acceptance Criteria

- [ ] Heartbeat writes are reduced by ~50% under normal operation
- [ ] Disconnect detection still works within 2-minute window

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by performance-oracle |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
