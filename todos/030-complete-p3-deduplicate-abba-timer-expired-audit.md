---
status: complete
priority: p3
issue_id: "030"
tags: [code-review, duplication]
dependencies: []
---

# Deduplicate ABBA TIMER_EXPIRED Audit Log

## Problem Statement

The ABBA timer expiry path in `sessionCleanup.ts` logs a `TIMER_EXPIRED` audit entry that may be duplicated or inconsistent with the MULTIPLAYER path.

## Findings

- **Location**: `convex/sessionCleanup.ts` — ABBA timer expiry section
- **Raised by**: pattern-recognition-specialist (1/7 agents)
- Minor inconsistency in audit logging between ABBA and MULTIPLAYER timer paths

## Proposed Solutions

### Option A: Unify audit logging for both format paths
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] TIMER_EXPIRED audit log is consistent across formats
- [ ] All tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-25 | Created | From PR #82 code review |
| 2026-02-25 | Approved | Triage: approved for work |
