---
status: complete
priority: p3
issue_id: "031"
tags: [code-review, architecture, constants]
dependencies: []
---

# Move TOKEN_REGEN_STATUSES to constants.ts

## Problem Statement

`TOKEN_REGEN_STATUSES` is defined inline in `sessions.ts` rather than in `convex/lib/constants.ts` where all other status sets are defined (`DELETABLE_STATUSES`, `EDITABLE_STATUSES`, etc.).

## Findings

- **Location**: `convex/sessions.ts` — `TOKEN_REGEN_STATUSES` definition
- **Raised by**: architecture-strategist, pattern-recognition-specialist (2/7 agents)
- All other status sets live in `constants.ts` — this one breaks the convention

## Proposed Solutions

### Option A: Move to constants.ts
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] `TOKEN_REGEN_STATUSES` defined in `convex/lib/constants.ts`
- [ ] `sessions.ts` imports from constants
- [ ] All tests pass

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-25 | Created | From PR #82 code review |
| 2026-02-25 | Approved | Triage: approved for work |
