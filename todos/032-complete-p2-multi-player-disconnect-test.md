---
status: ready
priority: p2
issue_id: "032"
tags: [code-review, testing, war-49]
dependencies: []
---

# Missing Test for Multiple MULTIPLAYER Players Disconnecting Simultaneously

## Problem Statement
There is no test covering the scenario where multiple players in a MULTIPLAYER session disconnect at the same time. The current tests only cover single-player disconnect scenarios. This matters because the cron iterates all players and marks each as disconnected, but the `sessionNeedsPause` flag should only trigger pause once.

## Findings
- Source: Kieran TypeScript Reviewer, Architecture Strategist agents
- Location: `convex/sessionCleanup.test.ts` — gap in MULTIPLAYER test section
- The loop in `checkHeartbeatTimeouts` marks multiple players as disconnected individually
- `sessionNeedsPause` is set per-player but pause is applied once per session
- `disconnectedPlayerCount` should reflect all disconnected players, not just one
- Need to verify audit logs are created for each disconnected player

## Proposed Solutions

### Option 1: Add multi-player disconnect test (Recommended)
Create a MULTIPLAYER session with 3+ players, set 2 as stale, verify both are disconnected and session is paused once.

- **Pros**: Validates the per-session pause deduplication
- **Cons**: None
- **Effort**: Small (20 minutes)
- **Risk**: None

## Recommended Action
Option 1 — add the test.

## Technical Details
- **Affected files**: `convex/sessionCleanup.test.ts`
- **Database changes**: None

## Acceptance Criteria
- [ ] Test: 2+ players disconnect simultaneously → all marked disconnected
- [ ] Test: `disconnectedPlayerCount` reflects total (not just first)
- [ ] Test: `pausedSessionCount` is 1 (not N for N disconnected players)
- [ ] Test: audit log has one PLAYER_DISCONNECTED entry per player

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from PR #68 code review | TypeScript Reviewer flagged |
| 2026-02-15 | Approved during triage (pending → ready) | Bulk-approved with all WAR-49 findings |

## Resources
- PR #68: https://github.com/Esk3tit/wtcs-map-vote/pull/68
