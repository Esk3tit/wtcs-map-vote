---
status: ready
priority: p3
issue_id: "034"
tags: [code-review, performance, war-49]
dependencies: []
---

# Consider Batch Audit Logging for Player Disconnections

## Problem Statement
`checkHeartbeatTimeouts` creates one `PLAYER_DISCONNECTED` audit log entry per disconnected player via `logAction()`. For sessions with many players disconnecting simultaneously, this creates many individual inserts. A single batch audit entry per session would be more efficient.

## Findings
- Source: Performance Oracle agent
- Location: `convex/sessionCleanup.ts:452-457` (per-player audit log)
- Current approach: one `logAction()` call per disconnected player
- Each `logAction()` is a `ctx.db.insert()` — adds to transaction document writes
- For MULTIPLAYER with 8+ players all disconnecting, that's 8+ extra writes

## Proposed Solutions

### Option 1: Single batch audit entry per session (Recommended)
After processing all players in a session, create one audit entry with all disconnected team names.

- **Pros**: Fewer writes, cleaner audit trail
- **Cons**: Loses per-player timestamp granularity (negligible since they're in the same cron tick)
- **Effort**: Small (20 minutes)
- **Risk**: Low

### Option 2: Keep current per-player logging
Individual entries are more queryable and align with the existing audit pattern.

- **Pros**: Consistent with existing patterns, easier to filter
- **Cons**: More writes at scale
- **Effort**: None
- **Risk**: None

## Recommended Action
Option 2 for now — keep per-player logging for consistency. The scale concern is theoretical at current usage levels.

## Technical Details
- **Affected files**: `convex/sessionCleanup.ts`
- **Database changes**: None

## Acceptance Criteria
- [ ] Decision documented (either keep current or batch)

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from PR #68 code review | Performance Oracle flagged |
| 2026-02-15 | Approved during triage (pending → ready) | Bulk-approved with all WAR-49 findings |

## Resources
- PR #68: https://github.com/Esk3tit/wtcs-map-vote/pull/68
