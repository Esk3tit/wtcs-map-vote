---
status: pending
priority: p3
issue_id: "022"
tags: [code-review, testing, documentation]
dependencies: []
---

# Document Storage Testing Limitation

## Problem Statement

The `teams.ts` module has significant storage-related logic (logoStorageId handling, storage cleanup) that cannot be fully tested due to convex-test limitations. While the limitation is acknowledged in comments, it should be formally tracked.

## Findings

**Source:** Architecture Strategist, Security Sentinel

**Location:** `convex/teams.test.ts` lines 164-167, 569-570

**Untested Scenarios:**
- `logoStorageId` being set on create (lines 119-121 in teams.ts)
- `logoStorageId` update transitions (lines 256-278 in teams.ts)
- Old storage cleanup on update (lines 283-286 in teams.ts)
- Storage cleanup on delete (lines 332-340 in teams.ts)
- Mutual exclusivity error when both logoUrl AND logoStorageId provided

**Evidence:**
```typescript
// Line 164-167 in teams.test.ts
// Note: Testing "both logoUrl and logoStorageId" requires a real storage ID.
// The validator rejects invalid storage IDs before business logic runs.
```

## Proposed Solutions

### Option A: Add Skip Tests as Placeholders (Recommended)

Add `it.skip()` tests to document what should be tested:

```typescript
describe("storage handling", () => {
  it.skip("creates team with logoStorageId", () => {
    // Requires real storage ID - test in integration tests
  });

  it.skip("clears storage when switching to URL", () => {
    // Requires real storage ID - test in integration tests
  });
});
```

**Pros:** Documents gaps, visible in test output
**Cons:** Slightly noisy test output
**Effort:** Small (15 minutes)
**Risk:** Low

### Option B: Create Integration Test File

Create `teams.integration.test.ts` for storage tests against dev deployment.

**Pros:** Actual test coverage
**Cons:** Requires dev deployment, more complex setup
**Effort:** Medium (1 hour)
**Risk:** Low

### Option C: Document in README Only

Add testing limitations to documentation.

**Pros:** Simple
**Cons:** Not visible in test output
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

Option A - Add skip tests as placeholders, consider Option B for Phase 2

## Technical Details

**Affected Files:**
- `convex/teams.test.ts`

## Acceptance Criteria

- [ ] Storage test gaps documented as skipped tests
- [ ] Comment explains why tests are skipped

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-18 | Created during code review | Storage testing limitations in convex-test |

## Resources

- PR #27: https://github.com/Esk3tit/wtcs-map-vote/pull/27
- convex-test docs: https://docs.convex.dev/testing/convex-test
