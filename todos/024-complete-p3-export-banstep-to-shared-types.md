---
status: complete
priority: p3
issue_id: "024"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# Export BanStep Interface to Shared Types

## Problem Statement
`BanStep` is defined locally in `ABBAProgressTracker.tsx` but constructed in the parent `vote.$token.tsx`. TypeScript structural typing handles this today, but if a field is added to `BanStep`, the parent won't get a compile error — it will just be `undefined` at runtime.

## Findings
- Location: `src/components/session/ABBAProgressTracker.tsx` lines 6-10
- Data constructed in: `src/routes/vote.$token.tsx` lines 276-283
- Currently relies on structural typing (works but fragile)

## Proposed Solutions

### Option 1: Move BanStep to `types.ts` and import in both files
- **Pros**: Explicit contract, compile-time safety if fields change
- **Cons**: Slightly more imports
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action
Export `BanStep` from `src/components/session/types.ts`, import in both ABBAProgressTracker and vote.$token.tsx.

## Technical Details
- **Affected Files**: `src/components/session/types.ts`, `src/components/session/ABBAProgressTracker.tsx`, `src/routes/vote.$token.tsx`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria
- [ ] BanStep exported from types.ts
- [ ] Imported and used in both consumer files
- [ ] TypeScript strict mode passes

## Work Log

### 2026-02-24 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved all findings)
- Status: ready

## Notes
Source: PR #81 code review - flagged by kieran-typescript-reviewer
