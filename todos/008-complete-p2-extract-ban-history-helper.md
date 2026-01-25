---
status: ready
priority: p2
issue_id: "008"
tags: [code-review, dry, convex, war-11]
dependencies: []
---

# Extract Shared Ban History Builder in sessions.ts

## Problem Statement

The ban history building logic is duplicated between `getSessionResultsByToken` and `getSessionResults` queries in `convex/sessions.ts`. Both queries contain ~40 identical lines for fetching players/maps, building the player lookup map, finding the winner, and constructing the ban history array.

## Findings

### Duplicated ban history logic
- `convex/sessions.ts:883-903` (in `getSessionResultsByToken`)
- `convex/sessions.ts:1007-1020` (in `getSessionResults`)
- Identical filtering, sorting, and mapping logic

### Duplicated code pattern
```typescript
// Identical in both functions:
const banHistory = maps
  .filter((m) => m.state === "BANNED" && m.bannedByPlayerId)
  .sort((a, b) => (a.bannedAtTurn ?? 0) - (b.bannedAtTurn ?? 0))
  .map((m, index) => {
    const bannedBy = m.bannedByPlayerId
      ? playerMap.get(m.bannedByPlayerId.toString())
      : undefined;
    return {
      order: index + 1,
      teamName: bannedBy?.teamName ?? "Unknown",
      mapName: m.name,
      mapImage: m.imageUrl,
    };
  });
```

### Additional duplicated logic
- Player/map fetching with `Promise.all` (~10 lines)
- Building `playerMap` for lookups (~2 lines)
- Finding winner map (~1 line)
- Teams extraction (~1 line)
- Response object construction (~20 lines)

### Total duplication
Approximately 50-60 lines duplicated between the two queries.

## Proposed Solutions

### Solution A: Extract buildSessionResults helper (Recommended)
Create a private helper function that both queries can call.

```typescript
// Private helper at top of file or in lib/
async function buildSessionResults(
  ctx: QueryCtx,
  session: Doc<"sessions">
) {
  const [players, maps] = await Promise.all([
    ctx.db.query("sessionPlayers")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect(),
    ctx.db.query("sessionMaps")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
      .collect(),
  ]);

  const playerMap = new Map(players.map((p) => [p._id.toString(), p]));
  const teams = [...new Set(players.map((p) => p.teamName))];
  const winnerMap = maps.find((m) => m.state === "WINNER");

  const banHistory = maps
    .filter((m) => m.state === "BANNED" && m.bannedByPlayerId)
    .sort((a, b) => (a.bannedAtTurn ?? 0) - (b.bannedAtTurn ?? 0))
    .map((m, index) => ({
      order: index + 1,
      teamName: playerMap.get(m.bannedByPlayerId!.toString())?.teamName ?? "Unknown",
      mapName: m.name,
      mapImage: m.imageUrl,
    }));

  return { players, maps, teams, winnerMap, banHistory };
}
```

- **Pros:** Single source of truth, ~40 LOC reduction, easier to maintain
- **Cons:** Minor: need to pass ctx and session
- **Effort:** Small
- **Risk:** Low

### Solution B: Remove getSessionResultsByToken entirely
The results page uses `getSessionResults` (public). If token-based results aren't needed, delete the duplicate.

- **Pros:** ~125 LOC reduction, simplest
- **Cons:** May be needed for future features
- **Effort:** Small
- **Risk:** Medium (may need it later)

### Solution C: Keep duplicated for now
Document the duplication with a TODO for future refactoring.

- **Pros:** No code changes
- **Cons:** Continued maintenance burden, risk of drift
- **Effort:** None
- **Risk:** Low (just tech debt)

## Recommended Action

Solution A — extract `buildSessionResults` helper function. Keep both queries since `getSessionResultsByToken` may be useful for authenticated results access.

## Technical Details

**Affected files:**
- `convex/sessions.ts` (add helper, refactor both queries)

**Helper location options:**
1. Private function in sessions.ts (recommended for now)
2. `convex/lib/sessionResults.ts` if used elsewhere in future

## Acceptance Criteria

- [ ] `buildSessionResults` helper function exists
- [ ] `getSessionResultsByToken` uses the helper
- [ ] `getSessionResults` uses the helper
- [ ] Both queries return identical data structure as before
- [ ] TypeScript typecheck passes
- [ ] Existing tests still pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #38 code review |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/38
- Architecture agent finding
- Code simplicity agent finding
- Performance agent finding
