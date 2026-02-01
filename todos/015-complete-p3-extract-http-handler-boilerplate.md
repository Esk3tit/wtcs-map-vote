---
status: complete
priority: p3
issue_id: "015"
tags: [code-review, quality]
dependencies: []
---

# Extract HTTP Handler Boilerplate

## Problem Statement

The validate-token and heartbeat POST handlers share identical structure (parse JSON, extract token, validate, extract IP, call mutation, format response). The two CORS OPTIONS handlers are completely identical. A helper would reduce ~80 lines to ~40.

## Findings

- **Source agents:** pattern-recognition-specialist, code-simplicity-reviewer
- **File:** `convex/http.ts` lines 47-75 and 92-119

## Proposed Solutions

Extract a `createPlayerEndpointHandler(mutationRef)` helper. Consider if a third endpoint is planned.
- **Effort:** Small | **Risk:** Low

## Acceptance Criteria

- [ ] Reduced duplication in HTTP handlers
- [ ] Both endpoints still work correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-01 | Created from PR #45 code review | Flagged by 2 agents |

## Resources

- PR: [#45](https://github.com/Esk3tit/wtcs-map-vote/pull/45)
