---
status: complete
priority: p3
issue_id: "006"
tags: [code-style, dry, voting, typescript]
dependencies: []
---

# Remove redundant TS type aliases from voting.ts

## Problem Statement

`SubmitBanSuccess` and `SubmitBanError` type aliases (lines 31-54) duplicate the `returns` validator definition (lines 143-168). The Convex `returns` validator is the runtime source of truth; the TS types exist only for the explicit return annotation on the handler. Removing them eliminates 24 lines and a sync burden.

## Findings

- Location: `convex/voting.ts:31-54` (TS types) and `convex/voting.ts:143-168` (returns validator)
- The TS types are only used for the `: Promise<SubmitBanSuccess | SubmitBanError>` annotation on line 169
- Convex can infer the return type from the `returns` validator
- Removing the types and annotation eliminates dual maintenance

## Proposed Solutions

### Option 1: Remove TS types, rely on validator inference
- Delete `SubmitBanSuccess` and `SubmitBanError` types
- Remove explicit return annotation on handler
- **Pros**: -24 lines, single source of truth
- **Cons**: Slightly less explicit in IDE hover for handler return type
- **Effort**: Small (10 minutes)
- **Risk**: Low

### Option 2: Keep types for explicitness
- Document that types mirror the validator intentionally
- **Pros**: Explicit return type visible in code
- **Cons**: Must keep in sync manually
- **Effort**: None
- **Risk**: Low

## Recommended Action

Option 1 — remove redundant types.

## Technical Details

- **Affected Files**: `convex/voting.ts`
- **Database Changes**: No

## Acceptance Criteria

- [x] TS type aliases removed
- [x] Handler return annotation removed
- [x] Typecheck passes
- [x] Tests pass

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

## Notes

Source: Triage session on 2026-02-08 (PR #52 review)
