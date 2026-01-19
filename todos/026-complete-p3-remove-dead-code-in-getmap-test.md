---
status: complete
priority: p3
issue_id: "026"
tags: [code-review, testing, maps, cleanup]
dependencies: []
---

# Remove Dead Code in getMap Test

## Problem Statement

The getMap test section contains unused variables or unnecessary setup that can be removed.

## Findings

**Source:** Kieran TypeScript Reviewer

**Location:** `convex/maps.test.ts` - getMap test section

**Evidence:**
Review identified potential dead code in the getMap tests where variables may be assigned but not meaningfully used in assertions.

## Proposed Solutions

### Option A: Audit and Remove Dead Code (Recommended)

Review each test in the getMap section and remove:
- Unused variable assignments
- Unnecessary setup steps
- Redundant assertions

**Pros:** Cleaner tests, reduced cognitive load
**Cons:** Requires careful review
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

Option A - Audit and remove dead code

## Technical Details

**Affected Files:**
- `convex/maps.test.ts`

## Acceptance Criteria

- [ ] Dead code identified and removed
- [ ] All tests still pass
- [ ] Tests remain readable and meaningful

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-19 | Created during PR #28 review | Dead code detected in test file |
| 2026-01-19 | Approved in triage | Ready to implement Option A |

## Resources

- PR #28: https://github.com/Esk3tit/wtcs-map-vote/pull/28
