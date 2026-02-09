# Document completedRounds Semantic Divergence

**Priority:** P3
**Status:** ready
**Source:** WAR-35 review (architecture-strategist)
**Files:** `convex/sessions.ts`

## Problem

`completedRounds` has different semantics per format:
- **ABBA:** Number of maps with `state === "BANNED"` (each ban = one round)
- **MULTIPLAYER:** Highest `bannedAtRound` value among banned maps (round-based elimination)

This divergence is not documented, which could confuse future developers or frontend consumers.

## Recommendation

Add a JSDoc comment on the `completedRounds` field in the return validator and/or inline where it's computed explaining the semantic difference. Example:

```typescript
/**
 * Number of completed rounds.
 * - ABBA: Count of banned maps (each ban = 1 round)
 * - MULTIPLAYER: Highest bannedAtRound value (maps can be banned in batches per round)
 */
completedRounds: v.number(),
```

## References

- `convex/sessions.ts` `getSessionByToken` handler (completedRounds computation)
