---
status: complete
priority: p3
issue_id: "022"
tags: [code-review, architecture, planning]
dependencies: []
---

# Plan sessions.ts Module Decomposition

## Problem Statement
`convex/sessions.ts` is now 1,936 lines with 15+ exported mutations. While still manageable, it's approaching a threshold where navigation and code review become harder.

## Findings
- Current size: 1,936 lines
- Growth trend: +69 lines (WAR-45), +119 lines (WAR-46)
- Contains: CRUD, lifecycle, management, player, map, and query functions

## Proposed Solutions

### Option 1: Split into sub-modules when approaching 2,500 lines
Potential structure:
- `convex/sessions/crud.ts` — Basic CRUD
- `convex/sessions/lifecycle.ts` — State transitions
- `convex/sessions/management.ts` — Admin utilities (reset, clone)
- `convex/sessions.ts` — Re-export barrel file

- **Pros**: Better organization, parallel development, focused test files
- **Cons**: Migration effort, potential import changes
- **Effort**: Medium (4-6 hours)
- **Risk**: Low (barrel file preserves backward compat)

## Recommended Action
No immediate action. Plan decomposition when file approaches 2,500 lines or next major feature adds significant code.

## Technical Details
- **Affected Files**: `convex/sessions.ts` (split into multiple)
- **Database Changes**: No

## Acceptance Criteria
- [ ] Decision documented on when to trigger decomposition
- [ ] No immediate code changes needed

## Work Log

### 2026-02-14 - Approved for Work
**By:** Claude Triage System
**Notes:** This is a planning item, not an immediate action.

## Resources
- Source: Code review of PR #65 (WAR-46)
