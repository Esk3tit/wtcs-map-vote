---
status: ready
priority: p3
issue_id: "026"
tags: [code-review, observability, war-47]
dependencies: []
---

# Enrich TIMER_EXPIRED Audit Log Details

## Problem Statement
The `TIMER_EXPIRED` audit log entries created in `handleTimerExpiry` include minimal details (turn/round and reason "AUTO_EXPIRED"). Adding more context (affected player, auto-selected map) would improve auditability and debugging.

## Findings
- Source: Security Sentinel agent (audit trail gaps)
- Location: `convex/sessionCleanup.ts:300-308` (ABBA) and `convex/sessionCleanup.ts:339-347` (MULTIPLAYER)
- ABBA path: logs `turn` and `reason` but not which player or which map was auto-banned
- MULTIPLAYER path: logs `round` and `reason` but not how many players were auto-voted
- The subsequent `MAP_BANNED` / `VOTE_SUBMITTED` audit logs from `executeBan` / `executeVote` do capture the specifics, so the info IS in the audit trail, just not in the TIMER_EXPIRED entry itself

## Proposed Solutions

### Option 1: Add player/map details to TIMER_EXPIRED log
Include `playerName`, `mapName`, and `affectedPlayerCount` in the audit details.

- **Pros**: Single audit entry tells the full story
- **Cons**: Duplicates info already in subsequent MAP_BANNED/VOTE_SUBMITTED logs
- **Effort**: Small (20 minutes)
- **Risk**: Low

### Option 2: Leave as-is (info exists in subsequent logs)
The TIMER_EXPIRED event marks the trigger; the consequences are logged separately by executeBan/executeVote.

- **Pros**: No redundancy, cleaner separation of concerns
- **Cons**: Requires reading multiple audit entries to understand full story
- **Effort**: None
- **Risk**: None

## Recommended Action
Use Option 1. Add player team name and unvoted player count to the TIMER_EXPIRED audit details for quick debugging without cross-referencing multiple log entries.

## Technical Details
- **Affected Files**: `convex/sessionCleanup.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] TIMER_EXPIRED audit log includes player context
- [ ] ABBA path includes affected player team name
- [ ] MULTIPLAYER path includes count of auto-voted players
- [ ] Tests pass
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
