---
status: complete
priority: p3
issue_id: "018"
tags: [code-review, security, data-integrity]
dependencies: []
---

# Add defense-in-depth duplicate vote guard at DB level

## Problem Statement

Double-vote prevention relies solely on the `hasVotedThisRound` boolean flag. While Convex's OCC prevents concurrent duplicates, there is no database-level uniqueness check on the `votes` table for `(playerId, round)`. If the flag-based guard is accidentally bypassed in future refactoring, duplicate votes could be inserted.

## Findings

- `convex/voting.ts:623` — Only check is `player.hasVotedThisRound`
- `convex/schema.ts:130` — `by_playerId_and_round` index exists but is not used as a uniqueness check
- Convex OCC prevents concurrent race conditions, so this is defense-in-depth only
- Source: Security Sentinel reviewer

## Proposed Fix

Add a redundant check before vote insertion:
```typescript
const existingVote = await ctx.db
  .query("votes")
  .withIndex("by_playerId_and_round", (q) =>
    q.eq("playerId", player._id).eq("round", currentRound)
  )
  .first();
if (existingVote) {
  return { status: "error" as const, error: "ALREADY_VOTED" as const };
}
```

## Files to Modify

- `convex/voting.ts` — Add check before `ctx.db.insert("votes", ...)`
