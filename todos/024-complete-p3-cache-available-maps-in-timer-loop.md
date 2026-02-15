---
status: ready
priority: p3
issue_id: "024"
tags: [code-review, performance, war-47]
dependencies: []
---

# Cache Available Maps Query in MULTIPLAYER Timer Expiry Loop

## Problem Statement
In `handleTimerExpiry` MULTIPLAYER path, available maps are re-queried from the database for each unvoted player. Since `executeVote` only inserts vote records and marks players (it does NOT ban maps), maps don't actually change between iterations. The re-query is defensive but unnecessary until `resolveRound` fires on the last vote.

## Findings
- Source: Performance Oracle agent (flagged as N+1 pattern)
- Location: `convex/sessionCleanup.ts:351-358`
- The loop re-queries `sessionMaps` with `by_sessionId_and_state` index for each unvoted player
- Maps only change when `resolveRound` bans them (triggered by last `executeVote`)
- In practice, unvoted player count is small (2-10), so impact is minimal
- The re-query comment says "maps may be banned by resolveRound" but this only happens on the LAST iteration

## Proposed Solutions

### Option 1: Query maps once before the loop
Move the `availableMaps` query before the `for` loop and reuse the result.

- **Pros**: Eliminates N-1 redundant queries, cleaner code
- **Cons**: Loses defensive re-query (but it's unnecessary as analyzed)
- **Effort**: Small (10 minutes)
- **Risk**: Low (maps provably don't change mid-loop)

### Option 2: Keep current defensive re-query
Leave as-is since the performance impact is negligible at current scale.

- **Pros**: No change risk, defensive
- **Cons**: Technically wasteful, misleading comment
- **Effort**: None
- **Risk**: None

## Recommended Action
Use Option 1. Query maps once before the loop and update the comment to explain why a single query is sufficient.

## Technical Details
- **Affected Files**: `convex/sessionCleanup.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Available maps queried once before the loop
- [ ] Comment updated to explain why single query is sufficient
- [ ] All timer expiry tests still pass
- [ ] Code reviewed

## Work Log

### 2026-02-14 - Created from Code Review
**By:** Claude Review System
**Actions:** Finding identified during PR #66 review (WAR-47)

### 2026-02-14 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approve all)
- Status changed from pending → ready
- Ready to be picked up and worked on

## Resources
- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/66
