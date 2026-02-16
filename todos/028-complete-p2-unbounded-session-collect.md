---
status: ready
priority: p2
issue_id: "028"
tags: [code-review, performance, scalability, war-49]
dependencies: []
---

# Unbounded .collect() on IN_PROGRESS Sessions

## Problem Statement
`checkHeartbeatTimeouts` in `convex/sessionCleanup.ts:428-431` calls `.collect()` on all `IN_PROGRESS` sessions, then for each session queries all players. At scale (50+ concurrent sessions with many players), this could approach Convex transaction limits (8MB read, ~1024 documents, wall-clock timeout).

## Findings
- Source: Performance Oracle, Architecture Strategist agents
- Location: `convex/sessionCleanup.ts:428-431`
- Current pattern: `ctx.db.query("sessions").withIndex("by_status").collect()`
- Each session then queries all its players — O(sessions × players) document reads
- Convex transactions have hard limits on document reads and wall-clock time
- Current scale is small (likely <10 concurrent sessions), but design should consider growth

## Proposed Solutions

### Option 1: Add scale documentation comment (Recommended for now)
Document the known limitation with a comment and a threshold estimate.

- **Pros**: Acknowledges the constraint, no premature optimization
- **Cons**: Doesn't fix the underlying issue
- **Effort**: Small (5 minutes)
- **Risk**: None

### Option 2: Paginate with .take(N) and multiple cron invocations
Process sessions in batches, scheduling follow-up runs if more remain.

- **Pros**: Handles any scale, stays within transaction limits
- **Cons**: More complex, adds scheduler overhead
- **Effort**: Medium (1-2 hours)
- **Risk**: Low

### Option 3: One cron invocation per session
Instead of scanning all sessions in one mutation, schedule individual checks per session when they enter IN_PROGRESS.

- **Pros**: Perfect scaling, no unbounded queries
- **Cons**: More scheduler usage, harder to reason about
- **Effort**: Large (3-4 hours)
- **Risk**: Medium

## Recommended Action
Option 1 for now — add a comment documenting the limitation. This is not a real concern at current scale. Revisit if the app grows to 50+ concurrent sessions.

## Technical Details
- **Affected files**: `convex/sessionCleanup.ts`
- **Database changes**: None

## Acceptance Criteria
- [ ] Comment added documenting the scaling limitation
- [ ] Threshold estimate included (e.g., "safe up to ~100 concurrent sessions")

## Work Log
| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-15 | Created from PR #68 code review | Performance Oracle flagged |
| 2026-02-15 | Approved during triage (pending → ready) | Bulk-approved with all WAR-49 findings |

## Resources
- PR #68: https://github.com/Esk3tit/wtcs-map-vote/pull/68
- Convex transaction limits documentation
