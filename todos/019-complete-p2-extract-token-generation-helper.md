---
status: complete
priority: p2
issue_id: "019"
tags: [code-review, architecture, dry, refactor]
dependencies: []
---

# Extract Token Generation Helper to Reduce Duplication

## Problem Statement
The token generation pattern (Set-based batch dedup + DB uniqueness check + insert) is duplicated across 3 locations in `convex/sessions.ts`. This creates maintenance risk — future changes to token format or collision handling must be applied in 3 places.

## Findings
- `assignPlayer` (line ~720): Single token generation, no Set-based batch dedup
- `createSessionFull` (lines ~1013-1046): Batch token generation with local Set
- `cloneSession` (lines ~1403-1430): Batch token generation with local Set (identical to createSessionFull)
- ~27 lines of identical logic between `createSessionFull` and `cloneSession`

## Proposed Solutions

### Option 1: Extract to `convex/lib/tokenGeneration.ts`
Create a `generateUniqueToken(ctx, generatedTokens)` helper that handles UUID generation, in-batch dedup, and DB uniqueness check.

- **Pros**: Single source of truth, testable in isolation, reduces 27 lines of duplication
- **Cons**: New file to maintain
- **Effort**: Small (1-2 hours)
- **Risk**: Low

## Recommended Action
Extract helper function and refactor all 3 call sites to use it.

## Technical Details
- **Affected Files**: `convex/sessions.ts`, new `convex/lib/tokenGeneration.ts`
- **Related Components**: assignPlayer, createSessionFull, cloneSession
- **Database Changes**: No

## Acceptance Criteria
- [ ] `generateUniqueToken()` helper created in `convex/lib/tokenGeneration.ts`
- [ ] `assignPlayer`, `createSessionFull`, and `cloneSession` refactored to use helper
- [ ] All existing tests pass
- [ ] No new test file needed (existing tests cover behavior)

## Work Log

### 2026-02-14 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Resources
- Source: Code review of PR #65 (WAR-46)
- Pattern reference: `createSessionFull` lines 1013-1046
