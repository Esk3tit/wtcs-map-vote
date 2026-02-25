---
status: complete
priority: p3
issue_id: "025"
tags: [code-review, backend, typescript]
dependencies: []
---

# Extract Named Type for buildRoundHistory Return

## Problem Statement
`convex/sessions.ts` spells out the `buildRoundHistory` return type inline twice — once in the function signature (lines 206-214) and once in the `result` variable (lines 228-236). With `voteCount` added, both blocks are now 8 lines each. Adding another field requires updating both in lockstep.

## Findings
- Location: `convex/sessions.ts` lines 206-214 and 228-236
- Identical inline type definitions duplicated
- Drift risk if only one is updated

## Proposed Solutions

### Option 1: Extract named interfaces
- **Pros**: Single source of truth, easier to extend
- **Cons**: Adds two interface definitions
- **Effort**: Small (10 minutes)
- **Risk**: Low

## Recommended Action
Extract `RoundHistoryBanEntry` and `RoundHistoryResult` interfaces in `convex/sessions.ts`.

## Technical Details
- **Affected Files**: `convex/sessions.ts`
- **Related Components**: buildRoundHistory function, roundHistoryEntryValidator
- **Database Changes**: No

## Acceptance Criteria
- [ ] Named interfaces replace both inline type definitions
- [ ] Function signature and result variable use the same type
- [ ] TypeScript strict mode passes (convex)
- [ ] Tests still pass

## Work Log

### 2026-02-24 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved all findings)
- Status: ready

## Notes
Source: PR #81 code review - flagged by kieran-typescript-reviewer
