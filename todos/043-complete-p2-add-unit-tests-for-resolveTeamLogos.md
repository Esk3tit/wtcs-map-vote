---
status: complete
priority: p2
issue_id: "043"
tags: [code-review, testing, convex]
dependencies: []
---

# Add unit tests for resolveTeamLogos and logoMapToRecord

## Problem Statement

The new `convex/lib/teamLogos.ts` utility has no test coverage. The existing test suite (872 tests) covers other `convex/lib/` utilities, so this is a gap. The function has meaningful edge cases worth verifying.

## Findings

- **Source**: Architecture strategist, pattern recognition specialist (PR #86 review)
- **Location**: `convex/lib/teamLogos.ts` (lines 19-41 for `resolveTeamLogos`, lines 50-57 for `logoMapToRecord`)
- **Evidence**: `Glob("convex/**/teamLogos*.test.*")` returns no results

## Proposed Solutions

### Option A: Add `convex/teamLogos.test.ts` following existing patterns

- **Pros**: Follows existing test patterns (`convex/teams.test.ts`, `convex/maps.test.ts`), uses `convex-test` infrastructure
- **Cons**: None
- **Effort**: Small (1-2 hours)
- **Risk**: None

Test cases to cover:
1. Empty team names array returns empty map
2. Unknown team names return `undefined` values
3. Teams with only `logoUrl` resolve correctly
4. Teams with only `logoStorageId` resolve via `ctx.storage.getUrl()`
5. Teams with both prefer `logoStorageId` over `logoUrl`
6. `logoStorageId` present but `ctx.storage.getUrl()` returns `null` — falls back to `logoUrl`
7. Deduplication: `["TeamA", "TeamA"]` queries DB only once
8. `logoMapToRecord` filters out undefined entries
9. `logoMapToRecord` preserves entries with valid URLs

## Recommended Action

Go with Option A. Create `convex/teamLogos.test.ts` following existing test patterns. Cover all 9 edge cases listed above.

## Technical Details

- **Affected files**: `convex/lib/teamLogos.ts`, new `convex/teamLogos.test.ts`
- **Test infrastructure**: `convex-test`, `test.setup.ts`, `test.factories.ts`

## Acceptance Criteria

- [ ] All edge cases above have passing tests
- [ ] `bun run test` passes with new tests included
- [ ] Coverage for `convex/lib/teamLogos.ts` > 90%

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-28 | Created | Identified during PR #86 code review |
| 2026-02-28 | Approved | Approved during triage — ready to work on |

## Resources

- PR #86: https://github.com/Esk3tit/wtcs-map-vote/pull/86
- Similar test files: `convex/teams.test.ts`, `convex/maps.test.ts`
