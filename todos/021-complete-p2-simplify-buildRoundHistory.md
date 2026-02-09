# Simplify buildRoundHistory Implementation

**Priority:** P2
**Status:** ready
**Source:** WAR-35 review (code-simplicity-reviewer)
**Files:** `convex/sessions.ts`

## Problem

`buildRoundHistory` uses a Map-based grouping pattern (~50 lines) that builds an intermediate grouped structure, then flattens. This is over-engineered for the data sizes involved (max 15 maps, 8 players).

Additionally, `buildSessionResults` calls `buildRoundHistory` then immediately `flatMap`s the grouped result back into a flat array — a "build up then tear down" anti-pattern.

## Recommendation

**Option A:** Single-pass approach for `buildRoundHistory`:
```typescript
// Instead of Map grouping, iterate banned maps and build entries directly
const history = bannedMaps
  .sort((a, b) => (a.bannedAtRound ?? 0) - (b.bannedAtRound ?? 0))
  .map(m => ({
    round: m.bannedAtRound ?? 0,
    turn: m.bannedAtTurn ?? 0,
    mapId: m._id.toString(),
    mapName: m.mapName,
    bannedByTeamName: /* lookup */,
  }));
```

**Option B:** Create a separate flat helper for `buildSessionResults` that doesn't go through the grouped structure.

## References

- `convex/sessions.ts` `buildRoundHistory` (lines 147-198)
- `convex/sessions.ts` `buildSessionResults` (lines 207-236)
