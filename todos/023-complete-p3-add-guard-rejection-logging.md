---
status: ready
priority: p3
issue_id: "023"
tags: [code-review, observability, war-47]
dependencies: []
---

# Add Debug Logging for Guard Rejections in handleTimerExpiry

## Problem Statement
When `handleTimerExpiry` returns `{ processed: false }` due to a guard condition (session not found, wrong status, timerStartedAt changed, timer paused), no logging indicates which guard triggered the no-op. This makes production debugging harder when investigating why a timer didn't fire.

## Findings
- Source: Architecture Strategist agent (9.5/10 score, recommended this improvement)
- Location: `convex/sessionCleanup.ts:257-263`
- The guard-based no-op pattern is correct for Convex, but silent rejections make debugging difficult
- Currently 4 guard conditions return `{ processed: false }` with no logging

## Proposed Solutions

### Option 1: Add console.log for each guard rejection
Add a `console.log` with the specific reason before each `return { processed: false }`.

- **Pros**: Simple, immediate visibility in Convex logs
- **Cons**: Adds log noise for expected no-ops (e.g., player acted before timer)
- **Effort**: Small (15 minutes)
- **Risk**: Low

### Option 2: Add a single consolidated log with reason enum
Return a `reason` field alongside `processed: false` and log once.

- **Pros**: Cleaner, structured output
- **Cons**: Slightly more code
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Recommended Action
Use Option 1 (simple console.log per guard). Keep it lightweight — these are debug-level logs that help trace timer behavior in production.

## Technical Details
- **Affected Files**: `convex/sessionCleanup.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Each guard rejection in `handleTimerExpiry` logs a reason
- [ ] Logs include session ID and the guard condition that triggered
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
