---
status: complete
priority: p3
issue_id: "014"
tags: [code-review, quality, yagni]
dependencies: []
---

# Remove Dead Code: Unused Types and Constants

## Problem Statement

Several items were added speculatively and are never used:
- `TOKEN_VALIDATION_FAILED` audit action in `convex/lib/types.ts` and `convex/lib/validators.ts` (never emitted)
- `HEARTBEAT_TIMEOUT_MS` in `convex/lib/constants.ts` (no disconnect detection implemented)
- `HEARTBEAT_INTERVAL_MS` in `convex/lib/constants.ts` (never imported by backend code)
- `TokenValidationError` type export in `convex/playerAuth.ts` (never imported anywhere)

## Findings

- **Source agents:** code-simplicity-reviewer, kieran-typescript-reviewer, pattern-recognition-specialist, git-history-analyzer
- **Files:** `convex/lib/types.ts`, `convex/lib/validators.ts`, `convex/lib/constants.ts`, `convex/playerAuth.ts`

## Proposed Solutions

Remove all four items. Add them back when actually needed.
- **Effort:** Small | **Risk:** None

## Acceptance Criteria

- [ ] No unused type literals, constants, or type exports
- [ ] All tests still pass
- [ ] Typecheck passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | YAGNI violations flagged by 4 agents |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/45
