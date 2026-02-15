---
status: ready
priority: p3
issue_id: "025"
tags: [code-review, data-integrity, war-47]
dependencies: []
---

# Add Defense-in-Depth Duplicate Vote Check in executeVote

## Problem Statement
The shared `executeVote` helper in `votingHelpers.ts` does not check whether a player has already voted this round before inserting a vote record. The caller mutations (`submitVote`, `adminVoteOnBehalf`) already perform this check, but since `executeVote` is now shared across player, admin, and system (timer expiry) paths, a defense-in-depth check would prevent accidental double-votes if a new caller is added without the guard.

## Findings
- Source: Data Integrity Guardian agent
- Location: `convex/lib/votingHelpers.ts:486-496`
- `submitVote` checks `player.hasVotedThisRound` before calling `executeVote`
- `adminVoteOnBehalf` also checks `player.hasVotedThisRound`
- `handleTimerExpiry` filters to `!p.hasVotedThisRound` players
- All three callers have the guard, but `executeVote` itself trusts the caller

## Proposed Solutions

### Option 1: Add early return if player already voted
Check `player.hasVotedThisRound` at the start of `executeVote` and throw/return early.

- **Pros**: Defense-in-depth, protects against future caller mistakes
- **Cons**: Redundant with existing caller guards
- **Effort**: Small (10 minutes)
- **Risk**: Low

### Option 2: Leave as-is (trust callers)
All current callers already check. Adding a check in the helper is defensive but unnecessary.

- **Pros**: No redundant code
- **Cons**: Fragile if new callers are added
- **Effort**: None
- **Risk**: Low (all callers currently check)

## Recommended Action
Use Option 1. Add a simple guard at the top of `executeVote` that throws if `player.hasVotedThisRound` is true. Cheap insurance for a shared helper.

## Technical Details
- **Affected Files**: `convex/lib/votingHelpers.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] `executeVote` validates player hasn't already voted this round
- [ ] Throws ConvexError if duplicate vote attempted
- [ ] All existing tests still pass
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
