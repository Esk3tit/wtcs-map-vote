---
status: complete
priority: p3
issue_id: "012"
tags: [code-review, quality, testing]
dependencies: []
---

# Fix test describe naming and use createDeletedSessionId helper

## Problem Statement

Two minor inconsistencies in `convex/voting.test.ts` for the `forceRandomSelection` test suite:
1. Describe block uses `"forceRandomSelection"` instead of `"voting.forceRandomSelection"` (convention from `sessions.test.ts` uses module-qualified names)
2. The "rejects non-existent session" test creates and deletes a session inline instead of using the shared `createDeletedSessionId` helper from `test.factories.ts`

## Findings

- **Location:** `convex/voting.test.ts:2734` (describe name), `convex/voting.test.ts:2878-2891` (inline delete pattern)
- **Agents:** pattern-recognition-specialist
- **Context:** `sessions.test.ts` uses patterns like `describe("sessions.endSession", ...)` and `createDeletedSessionId(t)` consistently.

## Proposed Solutions

### Option 1: Fix both (Recommended)
- Rename describe to `"voting.forceRandomSelection"`
- Import and use `createDeletedSessionId` from `test.factories`
- **Pros:** Consistent with established test conventions
- **Cons:** None
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 1: Fix describe naming to `"voting.forceRandomSelection"` and use `createDeletedSessionId` helper.

## Technical Details

- **Affected Files:** `convex/voting.test.ts`
- **Related Components:** Test suite
- **Database Changes:** No

## Acceptance Criteria

- [ ] Describe block renamed to `"voting.forceRandomSelection"`
- [ ] `createDeletedSessionId` used in non-existent session test
- [ ] All tests pass

## Work Log

### 2026-02-12 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (approve all)
- Status changed from pending to ready

### 2026-02-12 - Created from code review
**By:** Claude Review System
**Actions:**
- Identified by pattern-recognition agent during PR #62 review

## Resources

- PR #62: https://github.com/Esk3tit/wtcs-map-vote/pull/62
