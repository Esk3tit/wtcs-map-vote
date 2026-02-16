---
status: ready
priority: p2
issue_id: "031"
tags: [code-review, testing, war-49]
dependencies: []
---

# Missing Boundary Test for lastHeartbeat at Exact Threshold

## Problem Statement
The heartbeat disconnect detection uses `player.lastHeartbeat >= now - HEARTBEAT_TIMEOUT_MS` as the "still alive" check, but there's no test verifying behavior when `lastHeartbeat` is exactly at the threshold boundary (`now - HEARTBEAT_TIMEOUT_MS`).

## Findings
- Source: Kieran TypeScript Reviewer, Pattern Recognition agents
- Location: `convex/sessionCleanup.ts:447` — threshold comparison
- Location: `convex/sessionCleanup.test.ts` — missing edge case
- Current tests cover: well-within threshold (fresh), well-past threshold (stale), undefined
- Missing: `lastHeartbeat === now - HEARTBEAT_TIMEOUT_MS` (exact boundary)
- The `>=` operator means exactly-at-threshold should be treated as "still alive"

## Proposed Solutions

### Option 1: Add boundary test (Recommended)
Add a test with `lastHeartbeat` set to exactly `now - HEARTBEAT_TIMEOUT_MS`.

- **Pros**: Validates the `>=` vs `>` boundary behavior
- **Cons**: None
- **Effort**: Small (15 minutes)
- **Risk**: None

## Recommended Action
Option 1 — simple test addition.

## Technical Details
- **Affected files**: `convex/sessionCleanup.test.ts`
- **Database changes**: None

## Acceptance Criteria
- [ ] Test: player with `lastHeartbeat === now - HEARTBEAT_TIMEOUT_MS` is NOT disconnected
- [ ] Test: player with `lastHeartbeat === now - HEARTBEAT_TIMEOUT_MS - 1` IS disconnected

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from PR #68 code review | TypeScript Reviewer flagged |
| 2026-02-15 | Approved during triage (pending → ready) | Bulk-approved with all WAR-49 findings |

## Resources
- PR #68: https://github.com/Esk3tit/wtcs-map-vote/pull/68
