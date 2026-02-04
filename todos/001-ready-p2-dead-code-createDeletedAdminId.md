---
status: complete
priority: p2
issue_id: "001"
tags: [dead-code, testing, cleanup]
dependencies: []
---

# Dead Code: `createDeletedAdminId` in test.factories.ts

## Problem Statement
After removing the `createdBy` client arg from session mutations, `createDeletedAdminId` in `convex/test.factories.ts` has zero consumers across the entire codebase. The import was removed from `sessions.test.ts` and no other test file references it.

## Findings
- Location: `convex/test.factories.ts:281`
- Found by: TypeScript reviewer, code simplicity reviewer
- The generic `createDeletedId` helper it delegates to is still used (via `createDeletedSessionId`), so only `createDeletedAdminId` should be removed

## Proposed Solutions

### Option 1: Delete the function
- **Pros**: Clean, removes dead code
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Delete `createDeletedAdminId` from `convex/test.factories.ts`.

## Technical Details
- **Affected Files**: `convex/test.factories.ts`
- **Related Components**: Test utilities
- **Database Changes**: No

## Resources
- Original finding: WAR-27 code review (PR #47)

## Acceptance Criteria
- [x] `createDeletedAdminId` removed from `convex/test.factories.ts`
- [x] No references remain in codebase
- [x] Tests pass
- [x] Typecheck passes

## Work Log

### 2026-02-04 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes
Source: Triage session on 2026-02-04
