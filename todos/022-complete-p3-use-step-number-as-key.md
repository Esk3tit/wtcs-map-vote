---
status: complete
priority: p3
issue_id: "022"
tags: [code-review, react, best-practice]
dependencies: []
---

# Use `step.step` Instead of `index` as React Key

## Problem Statement
`ABBAProgressTracker.tsx` uses `key={index}` for step items in both desktop and mobile layouts. While not a bug (the array is fixed-length and never reorders), using `step.step` (the 1-based step number) is a more stable and self-documenting key.

## Findings
- Location: `src/components/session/ABBAProgressTracker.tsx` lines 54, 130
- `banSteps` is a fixed 4-element array derived deterministically from session state
- Items never reorder, insert, or remove — they only transition from incomplete to complete
- `step.step` values are unique (1, 2, 3, 4) and stable

## Proposed Solutions

### Option 1: Replace `key={index}` with `key={step.step}`
- **Pros**: Self-documenting, follows React best practices
- **Cons**: None
- **Effort**: Small (2 minutes)
- **Risk**: Low

## Recommended Action
Change both `key={index}` to `key={step.step}`.

## Technical Details
- **Affected Files**: `src/components/session/ABBAProgressTracker.tsx`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria
- [ ] Both `key={index}` replaced with `key={step.step}`
- [ ] No visual or behavioral change

## Work Log

### 2026-02-24 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session (auto-approved all findings)
- Status: ready

## Notes
Source: PR #81 code review - flagged by pattern-recognition-specialist
