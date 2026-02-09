---
status: complete
priority: p3
issue_id: "009"
tags: [refactoring, voting, duplication]
dependencies: []
---

# Map validation duplication between submitBan and submitVote

## Problem Statement

Both `submitBan` and `submitVote` contain identical map validation logic: fetch the map by ID, check it exists, verify it belongs to the same session, and confirm `state === "AVAILABLE"`. This 4-line block is duplicated verbatim.

## Findings

- `convex/voting.ts:147-154` (submitBan map validation)
- `convex/voting.ts:315-322` (submitVote map validation)
- Both return `MAP_UNAVAILABLE` on failure with identical conditions

## Proposed Fix

Extract a shared helper:
```typescript
async function validateTargetMap(
  ctx: MutationCtx,
  mapId: Id<"sessionMaps">,
  sessionId: Id<"sessions">
): Promise<Doc<"sessionMaps"> | null> {
  const map = await ctx.db.get(mapId);
  if (!map || map.sessionId !== sessionId || map.state !== "AVAILABLE") {
    return null;
  }
  return map;
}
```

Both mutations would then use:
```typescript
const targetMap = await validateTargetMap(ctx, mapId, player.sessionId);
if (!targetMap) {
  return { status: "error" as const, error: "MAP_UNAVAILABLE" as const };
}
```

## Files to Modify

- `convex/voting.ts` - Add helper, refactor both mutations
