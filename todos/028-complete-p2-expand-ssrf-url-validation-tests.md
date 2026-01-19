---
status: completed
priority: p2
issue_id: "028"
tags: [code-review, testing, maps, security]
dependencies: []
---

# Expand SSRF URL Validation Tests

## Problem Statement

The `maps.test.ts` file has basic SSRF protection tests but lacks comprehensive coverage of URL validation edge cases.

## Findings

**Source:** Security Sentinel

**Location:** `convex/maps.test.ts` - createMap and updateMap validation sections

**Current Coverage:**
- Tests internal address rejection (localhost, 127.0.0.1) ✓
- Missing: Other SSRF vectors

**Missing Test Cases:**
1. Private IP ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
2. IPv6 localhost (::1)
3. DNS rebinding patterns
4. Encoded URLs that decode to internal addresses

## Proposed Solutions

### Option A: Add Representative SSRF Tests (Recommended)

Add tests for key SSRF vectors:

```typescript
describe("SSRF protection", () => {
  it.each([
    ["localhost", "http://localhost/image.png"],
    ["127.0.0.1", "http://127.0.0.1/image.png"],
    ["private 10.x", "http://10.0.0.1/image.png"],
    ["private 192.168.x", "http://192.168.1.1/image.png"],
    ["private 172.16.x", "http://172.16.0.1/image.png"],
  ])("rejects %s URL", async (_, url) => {
    const t = createTestContext();
    await expect(
      t.mutation(api.maps.createMap, { name: "Map", imageUrl: url })
    ).rejects.toThrow();
  });
});
```

**Pros:** Comprehensive security coverage
**Cons:** More tests to maintain
**Effort:** Small (15 minutes)
**Risk:** Low

### Option B: Document in Existing Test

Add comment noting that `urlValidation.ts` has full coverage.

**Pros:** No new tests
**Cons:** Doesn't verify integration
**Effort:** Minimal
**Risk:** Low

## Recommended Action

Option A - Add representative SSRF tests. Security edge cases are important to verify at integration level.

## Technical Details

**Affected Files:**
- `convex/maps.test.ts`

**Reference:** `convex/lib/urlValidation.ts` contains the SSRF protection logic.

## Acceptance Criteria

- [x] Tests added for private IP ranges
- [x] All SSRF tests pass
- [x] Coverage documented

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-19 | Created during PR #28 review | Security coverage gap identified |
| 2026-01-19 | Approved in triage | Ready to implement Option A |
| 2026-01-19 | Implemented Option A | Expanded single SSRF test to `it.each` covering 5 SSRF vectors (localhost, 127.0.0.1, 10.x, 192.168.x, 172.16.x). All tests pass. |

## Resources

- PR #28: https://github.com/Esk3tit/wtcs-map-vote/pull/28
- OWASP SSRF Prevention Cheat Sheet
