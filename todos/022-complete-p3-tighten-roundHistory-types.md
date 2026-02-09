# Tighten roundHistory Validator Types

**Priority:** P3
**Status:** ready
**Source:** WAR-35 review (architecture-strategist, data-integrity-guardian)
**Files:** `convex/sessions.ts`

## Problem

1. `buildRoundHistory` accepts `format` as `string` instead of `"ABBA" | "MULTIPLAYER"` union
2. `roundHistoryEntryValidator` uses `mapId: v.string()` instead of `v.id("sessionMaps")`

These are correctness issues that weaken type safety without causing runtime bugs today.

## Recommendation

```typescript
// 1. Use union type for format parameter
function buildRoundHistory(
  format: "ABBA" | "MULTIPLAYER",
  ...
)

// 2. Use v.id for mapId in validator
const roundHistoryEntryValidator = v.object({
  round: v.number(),
  turn: v.number(),
  mapId: v.id("sessionMaps"),  // was v.string()
  mapName: v.string(),
  bannedByTeamName: v.optional(v.string()),
});
```

## References

- `convex/sessions.ts` lines 147-150 (buildRoundHistory signature)
- `convex/sessions.ts` lines 1073-1082 (roundHistoryEntryValidator)
