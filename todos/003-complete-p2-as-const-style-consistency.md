---
status: complete
priority: p2
issue_id: "003"
tags: [code-style, consistency, voting]
dependencies: []
---

# Add `as const` to voting.ts return values for consistency

## Problem Statement

`playerAuth.ts` and `sessions.ts` use `as const` assertions on return values (e.g., `{ status: "error" as const, error: "INVALID_TOKEN" as const }`), while `voting.ts` does not. Functionally benign since voting.ts has explicit TS types that handle narrowing, but stylistically inconsistent.

## Findings

- Location: `convex/voting.ts` — all return statements in `validatePlayerForVoting` and `submitBan`
- `playerAuth.ts` uses `as const` consistently on status/error fields
- `sessions.ts` also uses `as const` consistently
- `voting.ts` relies on explicit `SubmitBanSuccess | SubmitBanError` type annotations instead

## Proposed Solutions

### Option 1: Add `as const` to voting.ts return values
- Match the style of playerAuth.ts and sessions.ts
- **Pros**: Consistent style across all modules
- **Cons**: Slightly more verbose
- **Effort**: Small (15 minutes)
- **Risk**: Low

### Option 2: Remove `as const` from playerAuth.ts/sessions.ts
- Standardize on explicit type annotations instead
- **Pros**: Less boilerplate
- **Cons**: Larger change, touches stable code
- **Effort**: Medium
- **Risk**: Low-Medium

## Recommended Action

Option 1 — add `as const` to voting.ts to match existing convention.

## Technical Details

- **Affected Files**: `convex/voting.ts`
- **Related Components**: Return type narrowing
- **Database Changes**: No

## Resources

- Original finding: PR #52 multi-agent code review (pattern recognition reviewer)

## Acceptance Criteria

- [ ] All return values in voting.ts use `as const` where playerAuth.ts does
- [ ] Typecheck passes
- [ ] Tests pass

## Work Log

### 2026-02-08 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: **ready**

## Notes

Source: Triage session on 2026-02-08 (PR #52 review)
