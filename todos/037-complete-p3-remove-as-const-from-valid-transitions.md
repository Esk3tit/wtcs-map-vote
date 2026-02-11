---
status: complete
priority: p3
issue_id: "037"
tags: [code-review, typescript]
dependencies: []
---

# Remove misleading `as const` from VALID_TRANSITIONS

## Problem Statement
`as const` on an object containing `Set` instances is misleading. Sets are mutable at runtime regardless of `as const`. The `ReadonlySet` type annotation already provides the compile-time immutability guarantee, making `as const` redundant and confusing.

## Findings
- Location: `convex/lib/constants.ts:61`
- Flagged by 2/6 review agents (TypeScript, Simplicity)
- `ReadonlySet<SessionStatus>` type already prevents `.add()` / `.delete()` at compile time
- `as const` provides no additional runtime protection for Set objects

## Proposed Solutions

### Option 1: Remove `as const`
- **Pros**: Removes false confidence, cleaner code
- **Cons**: None
- **Effort**: Small (1 line change)
- **Risk**: Low

## Recommended Action
Remove `as const` from line 61 of constants.ts.

## Technical Details
- **Affected Files**: `convex/lib/constants.ts`
- **Database Changes**: No

## Acceptance Criteria
- [ ] `as const` removed from `VALID_TRANSITIONS`
- [ ] `bun run typecheck` passes

## Work Log

### 2026-02-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)

## Notes
Source: PR #59 code review triage on 2026-02-11
