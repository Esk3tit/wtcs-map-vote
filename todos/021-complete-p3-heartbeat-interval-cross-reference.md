---
status: complete
priority: p3
issue_id: "021"
tags: [code-review, quality]
dependencies: []
---

# Add Cross-Reference Comment for Duplicated Heartbeat Interval

## Problem Statement

`HEARTBEAT_INTERVAL_MS` is defined as `30_000` in `src/hooks/usePlayerAuth.ts` and as `30 * 1000` in `convex/lib/constants.ts`. The frontend cannot import from Convex lib, but the values must stay in sync. A comment linking them would prevent drift.

## Findings

- **Source agents:** pattern-recognition-specialist, kieran-typescript-reviewer, data-integrity-guardian
- **Files:** `src/hooks/usePlayerAuth.ts` line 5, `convex/lib/constants.ts` line 10

## Proposed Solutions

Add `// Must match HEARTBEAT_INTERVAL_MS in convex/lib/constants.ts` in the frontend file (and vice versa).
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] Both locations cross-reference each other

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Flagged by 3 agents |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
