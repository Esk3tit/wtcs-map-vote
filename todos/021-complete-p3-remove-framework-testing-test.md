---
status: complete
priority: p3
issue_id: "021"
tags: [code-review, testing, simplification]
dependencies: []
---

# Remove Framework-Testing Test

## Problem Statement

The "can be called multiple times" test for `generateUploadUrl` tests Convex's internal `ctx.storage.generateUploadUrl()` behavior rather than application code. This tests the framework, not the codebase.

## Findings

**Source:** Code Simplicity Reviewer

**Location:** `convex/teams.test.ts` lines 709-719

**Evidence:**
```typescript
it("can be called multiple times", async () => {
  const t = createTestContext();

  const url1 = await t.mutation(api.teams.generateUploadUrl, {});
  const url2 = await t.mutation(api.teams.generateUploadUrl, {});

  expect(url1).toBeDefined();
  expect(url2).toBeDefined();
  // URLs should be different (unique per call)
  expect(url1).not.toBe(url2);
});
```

The assertion that URLs are unique tests Convex's implementation, not application logic.

## Proposed Solutions

### Option A: Remove the Test (Recommended)

Delete the test since it provides no application coverage.

**Pros:** Removes unnecessary test, faster test suite
**Cons:** One less test (but it adds no value)
**Effort:** Small (5 minutes)
**Risk:** Low

### Option B: Keep with Documentation

Add a comment explaining this is a framework validation test.

**Pros:** Explicit about intent
**Cons:** Still tests external framework
**Effort:** Small (5 minutes)
**Risk:** Low

## Recommended Action

Option A - Remove the test

## Technical Details

**Affected Files:**
- `convex/teams.test.ts`

## Acceptance Criteria

- [ ] "can be called multiple times" test removed
- [ ] Test count reduced by 1

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created during code review | Framework vs application testing |
| 2026-01-18 | Approved in triage | Ready to implement |

## Resources

- PR #27: https://github.com/Esk3tit/wtcs-map-vote/pull/27
