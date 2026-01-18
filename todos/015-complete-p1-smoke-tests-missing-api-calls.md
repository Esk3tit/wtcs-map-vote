---
status: complete
priority: p1
issue_id: "015"
tags: [code-review, testing, convex]
dependencies: []
---

# Smoke Tests Missing Real Convex Function Calls

## Problem Statement

The smoke tests in `convex/smoke.test.ts` verify infrastructure setup (context creation, database access, identity) but do not actually test calling Convex queries/mutations through `t.query()` or `t.mutation()` with `api` references. This is the primary use case for convex-test and should be validated to ensure the complete integration works.

## Findings

**Source:** Architecture Strategist Review Agent

- Current smoke tests only use `t.run()` for direct database access
- No tests call actual Convex functions via `t.query(api.xxx)` or `t.mutation(api.xxx)`
- The primary purpose of convex-test is to test Convex functions, not just database access
- Without this validation, a configuration issue could cause all real function tests to fail

**Evidence:**
- `convex/smoke.test.ts` lines 20-35: Uses `t.run()` directly
- No imports of `api` from `_generated/api`

## Proposed Solutions

### Option A: Add API Query Test (Recommended)

Add a smoke test that calls a real Convex query:

```typescript
import { api } from "./_generated/api";

it("can call a real query via api", async () => {
  const t = createTestContext();
  const teams = await t.query(api.teams.list, { paginationOpts: { numItems: 10, cursor: null } });
  expect(teams.page).toEqual([]);
});
```

**Pros:** Validates the complete integration path
**Cons:** Requires understanding the actual API signature
**Effort:** Small (15 minutes)
**Risk:** Low

### Option B: Add API Mutation Test

Add a test that creates data via mutation and reads it back:

```typescript
it("can call mutations and queries via api", async () => {
  const t = createTestContext();
  // Note: Would need to handle authentication if required
  // This tests the full roundtrip
});
```

**Pros:** More comprehensive validation
**Cons:** May require auth setup depending on mutation requirements
**Effort:** Medium (30 minutes)
**Risk:** Low

## Recommended Action

Implement Option A as a minimum. This validates that:
1. The `api` imports work correctly with convex-test
2. Query functions can be called through the test harness
3. The modules glob pattern includes all necessary files

## Technical Details

**Affected Files:**
- `convex/smoke.test.ts`

**Components:**
- Test infrastructure validation

## Acceptance Criteria

- [x] At least one smoke test calls a Convex function via `api` reference
- [x] Test verifies the function returns expected data type
- [x] Test passes with current infrastructure

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created during code review | Identified gap in smoke test coverage |
| 2026-01-18 | Fixed - added API call test | Test calls `api.teams.listTeams` via `t.query()` |

## Resources

- PR #26: https://github.com/Esk3tit/wtcs-map-vote/pull/26
- convex-test docs: https://docs.convex.dev/testing/convex-test
