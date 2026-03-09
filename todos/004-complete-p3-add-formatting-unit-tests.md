---
status: complete
priority: p3
issue_id: "004"
tags: [code-review, testing]
dependencies: []
---

# Add Unit Tests for src/lib/formatting.ts

## Problem Statement
`src/lib/formatting.ts` is a pure utility module with no test coverage. It's an ideal candidate for unit tests given it has clear inputs/outputs.

## Findings
- `normalizeRole` and `humanizeRole` are pure functions
- Project uses vitest (configured in vitest.config.ts)
- Edge cases: idempotency, passthrough, custom roles

## Proposed Solutions

### Option 1: Add src/lib/formatting.test.ts
- Test cases:
  - `normalizeRole("Player A")` -> `"PLAYER_A"`
  - `normalizeRole("PLAYER_A")` -> `"PLAYER_A"` (idempotent)
  - `humanizeRole("PLAYER_A")` -> `"Player A"`
  - `humanizeRole("Player A")` -> `"Player A"` (passthrough)
  - `humanizeRole("Captain")` -> `"Captain"` (no underscore)
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Create test file with basic coverage.

## Technical Details
- **Affected Files**: `src/lib/formatting.test.ts` (new)

## Acceptance Criteria
- [ ] All edge cases covered
- [ ] Tests pass with `bun run test`

## Work Log

### 2026-03-09 - Approved for Work
**By:** Claude Triage System

## Resources
- PR #101: https://github.com/Esk3tit/wtcs-map-vote/pull/101
