# Remove allVoted Redundancy in voteProgress

**Priority:** P3
**Status:** ready
**Source:** WAR-35 review (code-simplicity-reviewer)
**Files:** `convex/sessions.ts`

## Problem

`voteProgress` computes both `votedCount`, `totalPlayers`, and `allVoted` where `allVoted` is just `votedCount === totalPlayers`. This iterates the players array twice — once to count voted, once to check `.every()`.

## Recommendation

Derive `allVoted` from the counts:
```typescript
const votedCount = activePlayers.filter(p => p.hasVotedThisRound).length;
const totalPlayers = activePlayers.length;
return {
  votedCount,
  totalPlayers,
  allVoted: votedCount === totalPlayers,
};
```

Or remove `allVoted` entirely and let consumers derive it.

## References

- `convex/sessions.ts` `getSessionByToken` handler (voteProgress computation)
