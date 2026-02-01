---
status: complete
priority: p3
issue_id: "019"
tags: [code-review, performance]
dependencies: []
---

# clearCompletedSessionIps Scans All Completed Sessions Unboundedly

## Problem Statement

The cleanup cron fetches ALL sessions with status `COMPLETE`, including already-cleaned ones. Over time, this set grows unboundedly, causing unnecessary reads on every cron tick.

## Findings

- **Source agents:** performance-oracle
- **File:** `convex/sessionCleanup.ts` lines 167-222

## Proposed Solutions

Add an `ipCleared: true` boolean field or timestamp check to skip already-cleaned sessions.
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Cleanup cron only processes sessions not yet cleaned

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Found by performance-oracle |

## Resources

- PR: [#45](https://github.com/Esk3tit/wtcs-map-vote/pull/45)
