---
status: complete
priority: p3
issue_id: "010"
tags: [performance, voting, query]
dependencies: []
---

# allVotesSubmitted check queries all session players

## Problem Statement

The "all players voted" check in `submitVote` queries all `sessionPlayers` for the session and iterates with `.every()` to check `hasVotedThisRound`. This is O(N) where N is the player count. While acceptable for the current 2-8 player range, this is worth noting for future reference.

## Findings

- `convex/voting.ts:358-362` — queries all players and checks `.every(p => p.hasVotedThisRound)`
- Current sessions have 2-8 players, so this is negligible
- Alternative: maintain a `votesThisRound` counter on the session, but that adds complexity

## Assessment

**No action needed at current scale.** This is documented for awareness. If player counts grow significantly (e.g., 50+ player sessions), consider adding a `votesSubmittedThisRound` counter on the `sessions` table that increments atomically with each vote, avoiding the full player scan.

## Files to Modify

- None (informational only, revisit if player scale changes)
