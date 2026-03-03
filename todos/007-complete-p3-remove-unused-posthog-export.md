---
status: complete
priority: p3
issue_id: "007"
tags: [code-review, simplicity, posthog]
dependencies: []
---

# Remove unused `export { posthog }` from posthog.ts

## Problem Statement

`src/lib/posthog.ts` exports the raw `posthog` instance via `export { posthog }`, but no file imports it. The React integration uses `usePostHog()` hook instead. The unused export is dead code.

## Findings

- `export { posthog }` at bottom of `src/lib/posthog.ts` is unused
- All consumers use `usePostHog()` from `@posthog/react`
- Found by: code-simplicity-reviewer agent

## Proposed Solutions

### Option 1: Remove the export line
- **Pros**: Less dead code
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action

Delete `export { posthog };` from `src/lib/posthog.ts`.

## Technical Details

- **Affected Files**: `src/lib/posthog.ts`
- **Database Changes**: No

## Acceptance Criteria

- [x] `export { posthog }` removed
- [x] No import breakage
- [x] Typecheck passes

## Work Log

### 2026-03-02 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved)

## Notes

Source: Triage session on 2026-03-02
