---
status: complete
priority: p2
issue_id: "020"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Remove `as string` Type Casts in RoundHistory.tsx

## Problem Statement
`RoundHistory.tsx` uses three unnecessary `as string` type assertions on `Id<"sessionMaps">` values. This is inconsistent with `ABBAProgressTracker.tsx` which uses the `Id` type directly as Map keys without casting. Flagged by 5/6 review agents.

## Findings
- Location: `src/components/session/RoundHistory.tsx` lines 23, 47, 50
- `ABBAProgressTracker.tsx` line 31 correctly uses `Id` directly: `new Map(maps.map((m) => [m._id, m]))`
- Convex `Id` types are branded strings that work as Map keys and React keys without casting
- The casts suppress type safety and create inconsistency between sibling components

## Proposed Solutions

### Option 1: Remove all three `as string` casts
- **Pros**: Consistent with ABBAProgressTracker, preserves type safety
- **Cons**: None
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Remove all three `as string` assertions. Use `Id<"sessionMaps">` directly.

## Technical Details
- **Affected Files**: `src/components/session/RoundHistory.tsx`
- **Related Components**: ABBAProgressTracker (reference for correct pattern)
- **Database Changes**: No

## Acceptance Criteria
- [ ] No `as string` casts remain in RoundHistory.tsx
- [ ] Map key type is `Id<"sessionMaps">` not `string`
- [ ] TypeScript strict mode passes
- [ ] Consistent with ABBAProgressTracker pattern

## Work Log

### 2026-02-24 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved all findings)
- Status: ready
**Learnings:**
- Convex Id types work directly as Map keys and React keys

## Notes
Source: PR #81 code review - flagged by security-sentinel, performance-oracle, architecture-strategist, pattern-recognition-specialist, kieran-typescript-reviewer
