---
status: complete
priority: p3
issue_id: "034"
tags: [security, auth, expiry]
dependencies: []
---

# Session expiresAt vs token tokenExpiresAt can diverge

## Problem Statement

Session-level `expiresAt` and player token `tokenExpiresAt` are set independently and can diverge. The voting path checks session `status` (set to EXPIRED by cleanup cron) but not `expiresAt` directly. There's a window between when a session passes its `expiresAt` and when the cron marks it `EXPIRED` where votes can still go through.

## Findings

- `convex/playerAuth.ts:185` — validates `tokenExpiresAt` only, does not check session expiry
- `convex/voting.ts:605` — checks `session.status !== "IN_PROGRESS"` but not `session.expiresAt`
- The cleanup cron (`sessionCleanup`) is the only mechanism that transitions expired sessions
- Between `expiresAt` passing and cron execution, the session remains `IN_PROGRESS`

## Proposed Solutions

### Option 1: Add expiresAt check in voting path (recommended)
- Add `if (Date.now() > session.expiresAt)` guard in `submitVote` and `submitBan`
- **Pros**: Closes the window completely, cheap check
- **Cons**: Slight duplication with cron logic
- **Effort**: Small (< 1 hour)
- **Risk**: Low

### Option 2: Add session status check in playerAuth
- Have `playerHeartbeat` check session expiry and disconnect players proactively
- **Pros**: Players get disconnected immediately at expiry
- **Cons**: More moving parts, heartbeat path becomes more complex
- **Effort**: Medium
- **Risk**: Low

## Recommended Action

Option 1 — add a `session.expiresAt` guard in the voting mutations. This is the cheapest fix that closes the gap.

## Technical Details

- **Affected Files**: `convex/voting.ts`, optionally `convex/playerAuth.ts`
- **Related Components**: `submitVote`, `submitBan`, `validatePlayerForVoting`
- **Database Changes**: No

## Acceptance Criteria

- [ ] Voting mutations reject submissions on expired sessions (even if status not yet updated)
- [ ] Tests cover the expiry window edge case
- [ ] Tests pass
- [ ] Code reviewed

## Work Log

### 2026-02-10 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Verified: `playerAuth.ts` checks `tokenExpiresAt` but not session expiry
- Verified: `voting.ts` checks session status but not `expiresAt` timestamp
- Confirmed cron-based expiry creates a real (if small) window

## Notes

Source: WAR-20 code review (PR #58), flagged by security-sentinel agent
