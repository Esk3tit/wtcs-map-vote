---
status: complete
priority: p2
issue_id: "025"
tags: [code-review, testing, maps, simplification]
dependencies: []
---

# Simplify Maps Tests - Remove Redundant Tests

## Problem Statement

The `maps.test.ts` file contains redundant tests that could be consolidated or removed. Specifically:
1. Multiple timestamp tests that verify the same behavior
2. Overlapping validation tests
3. Tests that duplicate coverage from other tests

## Findings

**Source:** Code Simplicity Reviewer

**Location:** `convex/maps.test.ts`

**Redundant Tests Identified:**

### 1. Timestamp Tests (~30 LOC)
Multiple functions test "updates updatedAt timestamp" separately. This is implementation detail testing.

```typescript
// These all test the same thing:
it("sets updatedAt timestamp", ...) // createMap
it("updates updatedAt timestamp", ...) // updateMap
it("updates updatedAt timestamp", ...) // deactivateMap
it("updates updatedAt timestamp", ...) // reactivateMap
```

**Recommendation:** Keep one representative timestamp test, remove others.

### 2. Similar Validation Tests (~20 LOC)
Empty name and whitespace-only name tests are nearly identical validations.

### 3. Session Blocking Pattern
Already uses representative testing (good), but could add comment explaining why.

## Proposed Solutions

### Option A: Remove Redundant Timestamp Tests (Recommended)

Keep `createMap` timestamp test as representative, remove from other functions.

**Pros:** ~30 LOC saved, faster tests
**Cons:** Slightly less explicit coverage
**Effort:** Small (15 minutes)
**Risk:** Low

### Option B: Consolidate with Comments

Keep tests but add comments explaining they test infrastructure.

**Pros:** Maintains coverage
**Cons:** No LOC reduction
**Effort:** Minimal
**Risk:** None

## Recommended Action

Option A - Remove redundant timestamp tests, add comment explaining representative testing

## Technical Details

**Affected Files:**
- `convex/maps.test.ts`

**Estimated LOC Reduction:** ~50 lines

## Acceptance Criteria

- [ ] Redundant timestamp tests removed (keep one representative)
- [ ] Comment added explaining representative testing pattern
- [ ] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-19 | Created during PR #28 review | Identified test redundancy |
| 2026-01-19 | Approved in triage | Ready to implement Option A |

## Resources

- PR #28: https://github.com/Esk3tit/wtcs-map-vote/pull/28
