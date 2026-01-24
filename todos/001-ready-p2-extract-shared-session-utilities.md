---
status: done
priority: p2
issue_id: "001"
tags: [code-review, architecture, dry]
dependencies: []
---

# Extract Shared Session Utilities (DRY Violation)

## Problem Statement

`getStatusColor`, `formatStatus`, and `formatRelativeTime` are duplicated between `session.$sessionId.tsx` and `session-card.tsx`. If one is updated without the other, status badges will display inconsistent colors across the dashboard and detail pages.

## Findings

### Duplicate `getStatusColor`
- `src/routes/admin/session.$sessionId.tsx:47-64`
- `src/components/session/session-card.tsx:24-41`
- Byte-for-byte identical implementations

### Duplicate `formatStatus`
- `src/routes/admin/session.$sessionId.tsx:66-68`
- `src/components/session/session-card.tsx:55-57`
- Identical logic: `status.replace(/_/g, " ")`

### Near-duplicate relative time formatters
- `src/routes/admin/session.$sessionId.tsx:81-92` (`formatRelativeTime`)
- `src/components/session/session-card.tsx:43-53` (`formatTimestamp`)
- Semantically identical, just different variable names

### Existing shared utility file
- `src/components/session/utils.ts` already exists with `formatTeamDisplay`
- Natural home for these shared functions

## Proposed Solutions

### Solution A: Extract to existing utils.ts (Recommended)
Move `getStatusColor`, `formatStatus`, and `formatRelativeTime` to `src/components/session/utils.ts`. Import from both consumers.

- **Pros:** Single source of truth, minimal file changes, uses existing pattern
- **Cons:** None significant
- **Effort:** Small
- **Risk:** Low

### Solution B: Create a dedicated session-status.ts
Create `src/lib/session-status.ts` for status-specific utilities.

- **Pros:** Clearer separation of concerns
- **Cons:** Adds another file, utils.ts already exists for this purpose
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Solution A — add to existing `src/components/session/utils.ts`.

## Technical Details

**Affected files:**
- `src/components/session/utils.ts` (add exports)
- `src/routes/admin/session.$sessionId.tsx` (remove local defs, add imports)
- `src/components/session/session-card.tsx` (remove local defs, add imports)

## Acceptance Criteria

- [ ] `getStatusColor` defined once in `utils.ts` and imported by both files
- [ ] `formatStatus` defined once in `utils.ts` and imported by both files
- [ ] `formatRelativeTime` defined once and imported by both files
- [ ] `SessionStatus` type exported from `utils.ts` (derived from `Doc<"sessions">["status"]`)
- [ ] TypeScript typecheck passes
- [ ] No visual regressions in status badges

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-24 | Created | From PR #37 code review |
| 2026-01-24 | Approved | Triage: approved for fixing |

## Resources

- PR: https://github.com/Esk3tit/wtcs-map-vote/pull/37
- Pattern reference: `src/components/session/utils.ts`
