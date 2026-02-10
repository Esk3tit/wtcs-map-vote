---
status: complete
priority: p2
issue_id: "029"
tags: [performance, convex, code-review]
dependencies: []
---

# Parallelize playerVotedMapId lookup in Promise.all

## Problem Statement

The `getSessionByToken` query in `convex/sessions.ts` performs the `playerVotedMapId` vote lookup sequentially after the existing `Promise.all([allPlayers, maps])` batch. This adds an extra database round trip (~10-30ms latency) when the query could run in parallel with the other lookups.

## Findings

- Location: `convex/sessions.ts:1197-1264`
- The existing `Promise.all` at line 1198 fetches `allPlayers` and `maps` in parallel
- The new vote lookup at line 1253 runs after the Promise.all resolves (sequential)
- The vote lookup only depends on `player._id` and `session.currentRound`, both available before the Promise.all
- Adding it to the existing batch would eliminate one network round trip

## Proposed Solutions

### Option 1: Add to existing Promise.all
- Move the vote query into the existing `Promise.all` batch as a third element
- **Pros**: Zero-cost latency improvement (~10-30ms), minimal code change
- **Cons**: Slightly more complex destructuring
- **Effort**: Small (5 minutes)
- **Risk**: Low

```typescript
const [allPlayers, maps, playerVote] = await Promise.all([
  ctx.db.query("sessionPlayers").withIndex("by_sessionId", ...).collect(),
  ctx.db.query("sessionMaps").withIndex("by_sessionId", ...).collect(),
  session.format === "MULTIPLAYER" && player.hasVotedThisRound
    ? ctx.db.query("votes").withIndex("by_playerId_and_round", ...).first()
    : Promise.resolve(null),
]);
const playerVotedMapId = playerVote?.mapId ?? undefined;
```

## Recommended Action

Option 1 — straightforward parallelization.

## Technical Details

- **Affected Files**: `convex/sessions.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Vote lookup runs in parallel with allPlayers and maps queries
- [ ] `playerVotedMapId` still returns correct value
- [ ] `bun run typecheck && bun run lint` passes
- [ ] Existing tests pass

## Work Log

### 2026-02-10 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (WAR-37 review findings)
- Performance oracle identified sequential query that could be parallelized
- Estimated ~10-30ms latency improvement per query execution
- Status: ready

### 2026-02-10 - Resolved
**By:** Claude (resolve_todo_parallel)
**Actions:**
- Moved vote query into existing `Promise.all` as third element
- Sequential vote lookup eliminated — saves ~10-30ms per query
- All 588 tests pass, typecheck and lint clean
- Status: complete

## Notes
Source: WAR-37 code review — Performance oracle agent
