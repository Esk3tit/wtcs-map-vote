---
status: complete
priority: p2
issue_id: "024"
tags: [code-review, testing, maps, validation]
dependencies: []
---

# Add Case-Sensitivity Test for Map Names

## Problem Statement

The `maps.test.ts` file lacks a test verifying case-sensitivity behavior for map name uniqueness. The codebase should have explicit tests documenting whether "Map" and "MAP" are treated as duplicates.

## Findings

**Source:** Kieran TypeScript Reviewer, Architecture Strategist

**Location:** `convex/maps.test.ts` - createMap and updateMap duplicate handling sections

**Current Coverage:**
- Tests exact duplicate: `"Map"` = `"Map"` ✓
- Tests trimmed duplicate: `"  Map  "` = `"Map"` ✓
- Missing: Case variation test: `"Map"` vs `"MAP"`

## Proposed Solutions

### Option A: Add Case-Sensitivity Test (Recommended)

Add test to document current behavior:

```typescript
it("treats different case as different names (case-sensitive)", async () => {
  const t = createTestContext();
  await t.run(async (ctx) => {
    await ctx.db.insert("maps", mapFactory({
      name: "Test Map",
      imageUrl: "https://example.com/map1.png",
    }));
  });

  // Should succeed if names are case-sensitive
  const result = await t.mutation(api.maps.createMap, {
    name: "TEST MAP",
    imageUrl: "https://example.com/map2.png",
  });

  expect(result.success).toBe(true);
});
```

**Pros:** Documents behavior, catches regressions
**Cons:** Adds one more test
**Effort:** Small (10 minutes)
**Risk:** Low

## Recommended Action

Option A - Add case-sensitivity test

## Technical Details

**Affected Files:**
- `convex/maps.test.ts`

## Acceptance Criteria

- [x] Case-sensitivity test added to createMap section
- [x] Test documents actual behavior (case-sensitive or insensitive)
- [x] All tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-19 | Created during PR #28 review | Missing boundary test identified |
| 2026-01-19 | Approved in triage | Ready to implement Option A |
| 2026-01-19 | Completed in PR #28 | Test added confirming names are case-sensitive |

## Resources

- PR #28: https://github.com/Esk3tit/wtcs-map-vote/pull/28
